/**
 * PDF Export utilities using jsPDF + jspdf-autotable
 * For purchase orders and packing slips
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<string, any>;

export async function exportPurchaseOrderPDF(order: AnyRecord, usdToVnd = 25500) {
  // Dynamic import to avoid SSR issues
  const { default: jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  const pageW = doc.internal.pageSize.getWidth();
  const margin = 15;

  // ─── Header ───────────────────────────────────────────────────────────────
  doc.setFillColor(17, 24, 39); // gray-900
  doc.rect(0, 0, pageW, 28, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(255, 255, 255);
  doc.text("THE RIKE SUPPLY", margin, 12);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(156, 163, 175); // gray-400
  doc.text("Purchase Order / Don Mua Hang", margin, 19);

  // Order code top-right
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.text(order.code, pageW - margin, 12, { align: "right" });
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(156, 163, 175);
  doc.text(new Date(order.orderDate).toLocaleDateString("vi-VN"), pageW - margin, 18, { align: "right" });

  // ─── Info boxes ───────────────────────────────────────────────────────────
  const infoY = 35;
  doc.setTextColor(17, 24, 39);

  // Supplier box
  doc.setFillColor(249, 250, 251);
  doc.roundedRect(margin, infoY, 80, 28, 2, 2, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(107, 114, 128);
  doc.text("NHA CUNG CAP / SUPPLIER", margin + 4, infoY + 6);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(17, 24, 39);
  doc.text(order.supplier?.name ?? "—", margin + 4, infoY + 13);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(75, 85, 99);
  if (order.supplier?.phone) doc.text(order.supplier.phone, margin + 4, infoY + 19);
  if (order.supplier?.location) doc.text(order.supplier.location, margin + 4, infoY + 24);

  // Status box
  const midX = margin + 85;
  doc.setFillColor(249, 250, 251);
  doc.roundedRect(midX, infoY, 55, 28, 2, 2, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(107, 114, 128);
  doc.text("THONG TIN DON", midX + 4, infoY + 6);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(75, 85, 99);
  const statusMap: Record<string, string> = {
    draft: "Nhap", confirmed: "Da xac nhan", shipping: "Dang giao",
    arrived: "Da nhan", completed: "Hoan thanh", cancelled: "Da huy",
  };
  doc.text(`TT: ${statusMap[order.status] ?? order.status}`, midX + 4, infoY + 13);
  if (order.expectedDate) doc.text(`Du kien: ${new Date(order.expectedDate).toLocaleDateString("vi-VN")}`, midX + 4, infoY + 19);
  if (order.shippingUnit) doc.text(`Vc: ${order.shippingUnit}`, midX + 4, infoY + 24);

  // Total box
  const totalBoxX = midX + 60;
  doc.setFillColor(17, 24, 39);
  doc.roundedRect(totalBoxX, infoY, pageW - totalBoxX - margin, 28, 2, 2, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(156, 163, 175);
  doc.text("TONG GIA VON", totalBoxX + 4, infoY + 6);
  doc.setFontSize(13);
  doc.setTextColor(255, 255, 255);
  doc.text(formatVND(order.totalVnd), totalBoxX + 4, infoY + 16);

  // ─── Items table ──────────────────────────────────────────────────────────
  const tableY = infoY + 34;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(17, 24, 39);
  doc.text("DANH SACH HANG HOA", margin, tableY);

  autoTable(doc, {
    startY: tableY + 4,
    margin: { left: margin, right: margin },
    head: [["San pham", "SKU", "DVT", "So luong", "Don gia (VND)", "Thanh tien (VND)"]],
    body: order.items.map((item: AnyRecord) => [
      (item.product?.nameVi ?? item.product?.name ?? "—"),
      item.product?.skuShopify ?? "—",
      item.product?.unit ?? "—",
      item.quantity.toLocaleString("vi-VN"),
      formatVND(item.priceVnd),
      formatVND(item.subtotalVnd),
    ]),
    foot: [["", "", "", "", "TONG CONG", formatVND(order.totalVnd)]],
    styles: { font: "helvetica", fontSize: 8, cellPadding: 3, textColor: [17, 24, 39] },
    headStyles: { fillColor: [17, 24, 39], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 7.5 },
    footStyles: { fillColor: [243, 244, 246], textColor: [17, 24, 39], fontStyle: "bold" },
    columnStyles: {
      0: { cellWidth: "auto" },
      1: { cellWidth: 28 },
      2: { cellWidth: 12 },
      3: { cellWidth: 18, halign: "right" },
      4: { cellWidth: 30, halign: "right" },
      5: { cellWidth: 32, halign: "right" },
    },
    alternateRowStyles: { fillColor: [249, 250, 251] },
  });

  // ─── Payment section ──────────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const afterTable = (doc as any).lastAutoTable?.finalY ?? tableY + 40;
  const payY = afterTable + 8;

  if (order.payments && order.payments.length > 0) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(17, 24, 39);
    doc.text("LICH SU THANH TOAN", margin, payY);

    autoTable(doc, {
      startY: payY + 4,
      margin: { left: margin, right: margin },
      head: [["Ngay", "Loai", "Phuong thuc", "Ghi chu", "So tien (VND)"]],
      body: order.payments.map((p: AnyRecord) => [
        new Date(p.paidAt).toLocaleDateString("vi-VN"),
        p.direction === "to_supplier" ? "Tra NCC" : "Khach tra lai",
        p.method ?? "—",
        p.notes ?? "—",
        formatVND(p.amount),
      ]),
      styles: { font: "helvetica", fontSize: 8, cellPadding: 2.5, textColor: [17, 24, 39] },
      headStyles: { fillColor: [55, 65, 81], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 7.5 },
      columnStyles: { 4: { halign: "right" } },
      alternateRowStyles: { fillColor: [249, 250, 251] },
    });
  }

  // ─── Footer ───────────────────────────────────────────────────────────────
  const pageH = doc.internal.pageSize.getHeight();
  doc.setDrawColor(229, 231, 235);
  doc.line(margin, pageH - 12, pageW - margin, pageH - 12);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(156, 163, 175);
  doc.text(`The Rike Supply Chain · In luc: ${new Date().toLocaleString("vi-VN")}`, margin, pageH - 7);
  doc.text(`Trang 1`, pageW - margin, pageH - 7, { align: "right" });

  doc.save(`${order.code}_purchase_order.pdf`);
}

export async function exportPackingSlipPDF(order: AnyRecord) {
  const { default: jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 15;

  // Header
  doc.setFillColor(16, 185, 129); // emerald-500
  doc.rect(0, 0, pageW, 24, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  doc.text("PHIEU DONG HANG / PACKING SLIP", margin, 10);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(209, 250, 229);
  doc.text(`${order.code} · ${new Date(order.orderDate).toLocaleDateString("vi-VN")}`, margin, 17);

  if (order.productionOrder) {
    const po = order.productionOrder;
    doc.setFillColor(243, 244, 246);
    doc.roundedRect(margin, 30, pageW - margin * 2, 14, 2, 2, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(17, 24, 39);
    doc.text(`Lenh san xuat: ${po.code}`, margin + 4, 37);
    const statusLabelMap: Record<string, string> = {
      pending: "Cho dong goi", in_production: "Dang dong goi", done: "Hoan thanh", cancelled: "Da huy",
    };
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(75, 85, 99);
    doc.text(`TT: ${statusLabelMap[po.status] ?? po.status}`, pageW - margin - 4, 37, { align: "right" });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(17, 24, 39);
    doc.text("CHI TIET DONG GOI", margin, 52);

    autoTable(doc, {
      startY: 56,
      margin: { left: margin, right: margin },
      head: [["San pham (Thanh pham)", "Quy cach", "Ke hoach (goi)", "Thuc te (goi)", "Trang thai"]],
      body: po.items.map((pi: AnyRecord) => [
        pi.product?.nameVi ?? pi.product?.name ?? "—",
        pi.gramsPerPack ? `${pi.gramsPerPack}g/goi` : "—",
        Math.round(pi.plannedQty).toLocaleString("vi-VN"),
        pi.actualQty != null ? Math.round(pi.actualQty).toLocaleString("vi-VN") : "Chua cap nhat",
        pi.actualQty != null && pi.actualQty >= pi.plannedQty ? "Dat" : "Chua dat",
      ]),
      styles: { font: "helvetica", fontSize: 8.5, cellPadding: 3.5 },
      headStyles: { fillColor: [5, 150, 105], textColor: [255, 255, 255], fontStyle: "bold" },
      columnStyles: {
        2: { halign: "right" },
        3: { halign: "right" },
        4: { halign: "center" },
      },
      alternateRowStyles: { fillColor: [236, 253, 245] },
    });
  }

  // Raw materials section
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lastY = (doc as any).lastAutoTable?.finalY ?? 80;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(17, 24, 39);
  doc.text("NGUYEN LIEU DAU VAO", margin, lastY + 10);

  autoTable(doc, {
    startY: lastY + 14,
    margin: { left: margin, right: margin },
    head: [["Nguyen lieu (Mua vao)", "DVT", "So luong mua", "Don gia (VND)", "Thanh tien (VND)"]],
    body: order.items.map((item: AnyRecord) => [
      item.product?.nameVi ?? item.product?.name ?? "—",
      item.product?.unit ?? "—",
      item.quantity.toLocaleString("vi-VN"),
      formatVND(item.priceVnd),
      formatVND(item.subtotalVnd),
    ]),
    foot: [["", "", "", "TONG", formatVND(order.totalVnd)]],
    styles: { font: "helvetica", fontSize: 8.5, cellPadding: 3 },
    headStyles: { fillColor: [107, 114, 128], textColor: [255, 255, 255], fontStyle: "bold" },
    footStyles: { fillColor: [243, 244, 246], fontStyle: "bold" },
    columnStyles: { 2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right" } },
    alternateRowStyles: { fillColor: [249, 250, 251] },
  });

  // Signature area
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sigY = (doc as any).lastAutoTable?.finalY ?? lastY + 60;
  const sigAreaY = sigY + 12;
  doc.setDrawColor(209, 213, 219);
  doc.rect(margin, sigAreaY, 55, 25);
  doc.rect(margin + 62, sigAreaY, 55, 25);
  doc.rect(margin + 124, sigAreaY, 55, 25);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(107, 114, 128);
  doc.text("Nguoi dong hang", margin + 27, sigAreaY + 4, { align: "center" });
  doc.text("Kiem tra chat luong", margin + 62 + 27, sigAreaY + 4, { align: "center" });
  doc.text("Thu kho / Nhan hang", margin + 124 + 27, sigAreaY + 4, { align: "center" });

  const pageH = doc.internal.pageSize.getHeight();
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(156, 163, 175);
  doc.text(`The Rike Supply Chain · In luc: ${new Date().toLocaleString("vi-VN")}`, margin, pageH - 7);

  doc.save(`${order.code}_packing_slip.pdf`);
}

function formatVND(value: number): string {
  if (!isFinite(value)) return "0 ₫";
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(value);
}
