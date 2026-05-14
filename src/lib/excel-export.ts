/**
 * Excel/CSV export utilities using SheetJS (xlsx)
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<string, any>;

async function getXLSX() {
  return import("xlsx");
}

function download(wb: AnyRecord, filename: string) {
  // Use dynamic xlsxWrite
  const XLSX = wb._XLSX;
  const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const blob = new Blob([wbout], { type: "application/octet-stream" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function buildWorkbook(XLSX: AnyRecord, sheets: { name: string; data: AnyRecord[] }[]) {
  const wb = XLSX.utils.book_new();
  wb._XLSX = XLSX;
  for (const { name, data } of sheets) {
    const ws = XLSX.utils.json_to_sheet(data);
    // Auto-width
    const colWidths = Object.keys(data[0] ?? {}).map((k) => ({
      wch: Math.max(k.length, ...data.map((r) => String(r[k] ?? "").length)) + 2,
    }));
    ws["!cols"] = colWidths;
    XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31));
  }
  return wb;
}

export async function exportSalesExcel(salesItems: AnyRecord[]) {
  const XLSX = await getXLSX();
  const data = salesItems.map((item) => ({
    "Mã đơn": item.orderName ?? item.orderId,
    "Ngày": item.orderDate ? new Date(item.orderDate).toLocaleDateString("vi-VN") : "",
    "SKU": item.sku ?? "",
    "Sản phẩm": item.productName ?? "",
    "Số lượng": item.quantity,
    "Đơn giá (USD)": item.priceUsd,
    "Doanh thu (USD)": item.subtotalUsd,
    "Kênh": item.channel ?? "",
  }));

  const totalRow = {
    "Mã đơn": "TỔNG",
    "Ngày": "",
    "SKU": "",
    "Sản phẩm": `${salesItems.length} dòng`,
    "Số lượng": salesItems.reduce((s, i) => s + i.quantity, 0),
    "Đơn giá (USD)": "",
    "Doanh thu (USD)": salesItems.reduce((s, i) => s + i.subtotalUsd, 0),
    "Kênh": "",
  };

  const wb = buildWorkbook(XLSX, [
    { name: "Bán hàng", data: [...data, totalRow] },
  ]);
  download(wb, `sales_${new Date().toISOString().split("T")[0]}.xlsx`);
}

export async function exportPurchasesExcel(purchases: AnyRecord[]) {
  const XLSX = await getXLSX();
  const data = purchases.map((p) => ({
    "Mã đơn": p.code,
    "Ngày đặt": p.orderDate ? new Date(p.orderDate).toLocaleDateString("vi-VN") : "",
    "Nhà cung cấp": p.supplier?.name ?? "",
    "Trạng thái": p.status,
    "Tổng tiền (VND)": p.totalVnd,
    "Đã trả NCC (VND)": p.payments?.filter((x: AnyRecord) => x.direction === "to_supplier").reduce((s: number, x: AnyRecord) => s + x.amount, 0) ?? 0,
    "Đơn mua hộ": p.isBuyOnBehalf ? "Có" : "Không",
    "Giá bán lại (VND)": p.sellingPriceVnd ?? "",
    "Mã vận đơn": p.shippingCode ?? "",
    "Ghi chú": p.notes ?? "",
  }));

  const wb = buildWorkbook(XLSX, [{ name: "Thu mua", data }]);
  download(wb, `purchases_${new Date().toISOString().split("T")[0]}.xlsx`);
}

export async function exportInventoryExcel(inventory: AnyRecord[]) {
  const XLSX = await getXLSX();
  const data = inventory.map((item) => ({
    "Sản phẩm": item.product?.nameVi ?? item.product?.name ?? item.productName ?? "",
    "SKU Shopify": item.product?.skuShopify ?? item.skuShopify ?? "",
    "Danh mục": item.product?.category ?? item.category ?? "",
    "Tồn kho": item.quantity ?? item.currentStock ?? 0,
    "Đơn vị": item.product?.unit ?? item.unit ?? "",
    "Kho": item.location ?? item.warehouse ?? "",
    "Ghi chú": item.notes ?? "",
  }));

  const wb = buildWorkbook(XLSX, [{ name: "Tồn kho", data }]);
  download(wb, `inventory_${new Date().toISOString().split("T")[0]}.xlsx`);
}

export async function exportAnalyticsExcel(products: AnyRecord[], totals: AnyRecord) {
  const XLSX = await getXLSX();
  const data = products.map((p) => ({
    "Sản phẩm": p.nameVi ?? p.name,
    "SKU": p.skuShopify ?? "",
    "Danh mục": p.category ?? "",
    "Đã mua (input)": p.totalBought,
    "Giá vốn TB (VND)": Math.round(p.avgCostPerUnitVnd),
    "Đã bán": p.totalSold,
    "Doanh thu (USD)": p.totalRevenueUsd.toFixed(2),
    "Doanh thu (VND)": Math.round(p.totalRevenueVnd),
    "COGS (VND)": Math.round(p.cogsVnd),
    "Lợi nhuận gộp (VND)": Math.round(p.grossProfitVnd),
    "Margin (%)": p.marginPct.toFixed(1),
  }));

  const totalRow = {
    "Sản phẩm": "TỔNG CỘNG",
    "SKU": "",
    "Danh mục": "",
    "Đã mua (input)": "",
    "Giá vốn TB (VND)": "",
    "Đã bán": "",
    "Doanh thu (USD)": "",
    "Doanh thu (VND)": Math.round(totals.totalRevenueVnd),
    "COGS (VND)": Math.round(totals.totalCogsVnd),
    "Lợi nhuận gộp (VND)": Math.round(totals.totalProfitVnd),
    "Margin (%)": totals.totalRevenueVnd > 0 ? ((totals.totalProfitVnd / totals.totalRevenueVnd) * 100).toFixed(1) : "0",
  };

  const wb = buildWorkbook(XLSX, [{ name: "Profit Analytics", data: [...data, totalRow] }]);
  download(wb, `analytics_${new Date().toISOString().split("T")[0]}.xlsx`);
}
