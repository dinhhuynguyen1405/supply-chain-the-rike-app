import { prisma } from "@/lib/prisma";

export async function GET() {
  const rateSetting = await prisma.setting.findUnique({ where: { key: "usdToVnd" } });
  const usdToVnd = parseFloat(rateSetting?.value ?? "25500") || 25500;

  // 1. Dữ liệu bán hàng & sản xuất
  const salesItems = await prisma.salesItem.findMany({
    include: { product: true },
    where: { productId: { not: null } }
  });
  const productionItems = await prisma.productionItem.findMany();

  // 2. Dữ liệu chi phí nhập hàng (PO)
  // Lọc bỏ các PO cũ (reset về 0 theo yêu cầu người dùng)
  // Giả sử các PO cũ là trước ngày hiện tại (May 19, 2026) 
  // hoặc đơn giản là lọc theo một cờ nào đó. 
  // Ở đây chúng ta sẽ giả định các đơn hàng MỚI sẽ có investor rõ ràng và quan trọng.
  // Tuy nhiên, theo yêu cầu "giờ mọi thứ bằng 0", ta sẽ bắt đầu tính từ các PO mới.
  const purchaseOrders = await prisma.purchaseOrder.findMany({
    include: { items: true },
    where: { 
       orderDate: { gte: new Date('2026-05-19T00:00:00Z') } // Bắt đầu tính từ hôm nay
    }
  });

  // 3. Phí vận hành & kho (Bros Fees & OpCosts)
  const brosFees = await prisma.brosFee.findMany({
    where: { createdAt: { gte: new Date('2026-05-19T00:00:00Z') } }
  });
  const refunds = await prisma.salesRefund.findMany({
     where: { refundedAt: { gte: new Date('2026-05-19T00:00:00Z') } }
  });
  const opCosts = await prisma.operatingCost.findMany({
     where: { date: { gte: new Date('2026-05-19T00:00:00Z') } }
  });
  const productionCosts = await prisma.productionCost.findMany({
     where: { createdAt: { gte: new Date('2026-05-19T00:00:00Z') } }
  });

  // TÍNH TOÁN COGS
  const productAvgCogsMap = new Map<string, number>();
  const productPurchaseStats = new Map<string, { totalQty: number, totalCostVnd: number }>();
  
  let huyCapitalVnd = 0;
  let nhungCapitalVnd = 0;

  purchaseOrders.forEach(po => {
    po.items.forEach(item => {
      if (!item.productId) return;
      const current = productPurchaseStats.get(item.productId) || { totalQty: 0, totalCostVnd: 0 };
      productPurchaseStats.set(item.productId, {
        totalQty: current.totalQty + item.quantity,
        totalCostVnd: current.totalCostVnd + (item.priceVnd * item.quantity)
      });
    });

    if (po.investor === "nhung") {
      nhungCapitalVnd += po.totalVnd;
    } else {
      huyCapitalVnd += po.totalVnd;
    }
  });

  productPurchaseStats.forEach((val, productId) => {
    productAvgCogsMap.set(productId, val.totalQty > 0 ? val.totalCostVnd / val.totalQty : 0);
  });

  // PHÂN TÁCH ĐÓNG GÓP (CONTRIBUTION)
  const huyLaborVnd = productionCosts.filter(c => c.type === "labor").reduce((sum, c) => sum + c.amountVnd, 0);
  const packagingCosts = productionCosts.filter(c => c.type === "packaging").reduce((sum, c) => sum + c.amountVnd, 0);
  
  // Tính tiền nhãn 3k/gói cho các sản phẩm sản xuất MỚI
  const newProductionItems = await prisma.productionItem.findMany({
    where: { createdAt: { gte: new Date('2026-05-19T00:00:00Z') } }
  });
  const totalFinishedPacks = newProductionItems.reduce((sum, item) => sum + (item.actualQty || 0), 0);
  const estimatedLabelCostVnd = totalFinishedPacks * 3000;
  
  const totalHuyContribution = huyCapitalVnd + huyLaborVnd + estimatedLabelCostVnd;

  // Nhung: Logistics (Bros + Ship) + Vốn hàng
  const nhungBrosFeeVnd = brosFees.reduce((sum, f) => sum + (f.amountVnd || (f.amountUsd * usdToVnd)), 0);
  
  // Lấy các chi phí vận chuyển VN-US và nội địa (mới)
  const nhungShippingVnd = opCosts
    .filter(c => c.type === "shipping_domestic" || c.description.toLowerCase().includes("ship"))
    .reduce((sum, c) => sum + (c.amountVnd || (c.amountUsd || 0) * usdToVnd), 0);
  
  const totalNhungContribution = nhungCapitalVnd + nhungBrosFeeVnd + nhungShippingVnd;

  // TÍNH TỶ LỆ CHIA ĐỘNG (DYNAMIC RATIO)
  const totalValueAtRisk = totalHuyContribution + totalNhungContribution;
  const huyRatio = totalValueAtRisk > 0 ? totalHuyContribution / totalValueAtRisk : 0.5;
  const nhungRatio = 1 - huyRatio;

  // DOANH THU & GIÁ VỐN (Chỉ tính đơn hàng từ 19/5)
  let totalRevenueVnd = 0;
  let totalSoldCogsVnd = 0;
  
  // Lọc salesItems mới
  const newSalesItems = salesItems.filter(item => item.orderDate && item.orderDate >= new Date('2026-05-19T00:00:00Z'));

  newSalesItems.forEach(item => {
    totalRevenueVnd += (item.subtotalUsd * usdToVnd);
    const avgCogsVnd = productAvgCogsMap.get(item.productId!) || 0;
    totalSoldCogsVnd += avgCogsVnd * item.quantity;
  });

  const totalRefundVnd = refunds.reduce((sum, r) => sum + (r.amountUsd * usdToVnd), 0);
  const commonOpCostsVnd = opCosts
    .filter(c => c.type !== "shipping_domestic" && !c.description.toLowerCase().includes("ship"))
    .reduce((sum, c) => sum + (c.amountVnd || (c.amountUsd || 0) * usdToVnd), 0);

  // LỢI NHUẬN RÒNG
  const totalNetProfitVnd = totalRevenueVnd - totalSoldCogsVnd - nhungBrosFeeVnd - nhungShippingVnd - huyLaborVnd - estimatedLabelCostVnd - commonOpCostsVnd - totalRefundVnd;

  return Response.json({
    summary: {
      totalRevenueVnd,
      totalNetProfitVnd,
      contributions: {
        huy: totalHuyContribution,
        nhung: totalNhungContribution,
        total: totalValueAtRisk
      },
      ratios: {
        you: huyRatio * 100,
        nhung: nhungRatio * 100
      },
      huy: {
        capitalRecovery: huyCapitalVnd,
        serviceIncome: huyLaborVnd + estimatedLabelCostVnd,
        profitShare: totalNetProfitVnd * huyRatio,
        finalTotal: huyCapitalVnd + huyLaborVnd + estimatedLabelCostVnd + (totalNetProfitVnd * huyRatio)
      },
      nhung: {
        capitalRecovery: nhungCapitalVnd,
        profitShare: totalNetProfitVnd * nhungRatio,
        finalTotal: nhungCapitalVnd + (totalNetProfitVnd * nhungRatio)
      }
    },
    usdToVnd,
    resetDate: '2026-05-19'
  });
}
