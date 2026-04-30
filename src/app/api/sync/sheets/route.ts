import { prisma } from "@/lib/prisma";
import { getSheetsClient, getRefreshToken, SPREADSHEET_ID } from "@/lib/google";
import { NextRequest } from "next/server";

// Bros Warehouse sheet — CHỈ ĐỌC, không bao giờ ghi vào
const BROS_SPREADSHEET_ID = "1I_IQNSq8iZPM-MqyjswYN5juJo6xadudRBU8Pwcj5WI";

// Tất cả ghi đều vào sheet của mình (SPREADSHEET_ID)
async function ensureSheet(sheets: Awaited<ReturnType<typeof getSheetsClient>>, title: string) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const exists = meta.data.sheets?.some((s) => s.properties?.title === title);
  if (!exists) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: { requests: [{ addSheet: { properties: { title } } }] },
    });
  }
}

async function clearAndWrite(
  sheets: Awaited<ReturnType<typeof getSheetsClient>>,
  sheetTitle: string,
  rows: (string | number | boolean | null)[][]
) {
  await ensureSheet(sheets, sheetTitle);
  await sheets.spreadsheets.values.clear({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetTitle}!A:AZ`,
  });
  if (rows.length > 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetTitle}!A1`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: rows },
    });
  }
}

// Đọc data từ Bros sheet (read-only)
async function readBrosSheet(
  sheets: Awaited<ReturnType<typeof getSheetsClient>>,
  sheetTitle: string
): Promise<string[][]> {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: BROS_SPREADSHEET_ID,
    range: `${sheetTitle}!A:Z`,
  });
  return (res.data.values ?? []) as string[][];
}

function toSellingUnits(quantity: number, unit: string, gramsPerUnit: number | null) {
  if (gramsPerUnit && unit === "kg") return Math.floor((quantity * 1000) / gramsPerUnit);
  return quantity;
}

/** Chuẩn hóa tên để so sánh với Bros nameMap */
function normalizeName(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/^\d+[\s\-x]*\d*\s*(gram|g|kg|oz|lb|pack|pcs|pieces?)\s*/i, "")
    .replace(/\s*[\|\-]\s*.*/g, "")
    .replace(/[®™©]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export async function POST(req: NextRequest) {
  const token = await getRefreshToken();
  if (!token) {
    return Response.json({ error: "Chưa kết nối Google. Vào Cài đặt → Kết nối Google để lấy token." }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  // targets: "summary" | "purchases" | "products" | "inventory" | "sales" | "bros_inventory" | "inbound" | "fbm" | "production" | "nhung" | "nhung_orders" | "all"
  const target: string = body.target ?? "all";

  try {
    const sheets = await getSheetsClient();
    const synced: string[] = [];

    // ─── THU MUA ─────────────────────────────────────────────────────────────
    if (target === "all" || target === "purchases") {
      const orders = await prisma.purchaseOrder.findMany({
        orderBy: { orderDate: "desc" },
        include: { supplier: true, items: { include: { product: true } }, payments: true },
      });
      const rows: (string | number | null)[][] = [
        ["Mã đơn", "NCC", "Mua hộ", "Ngày mua", "Dự kiến", "Ngày đến", "Trạng thái", "Vận chuyển", "Mã VĐ", "Giá vốn (VND)", "Giá bán (VND)", "Đã trả NCC", "Khách đã trả"],
        ...orders.map((o) => {
          const paidSupplier = o.payments.filter((p) => p.direction === "to_supplier").reduce((s, p) => s + p.amount, 0);
          const paidCustomer = o.payments.filter((p) => p.direction === "from_customer").reduce((s, p) => s + p.amount, 0);
          return [
            o.code, o.supplier.name, o.isBuyOnBehalf ? "Có" : "",
            o.orderDate.toISOString().split("T")[0],
            o.expectedDate?.toISOString().split("T")[0] ?? "",
            o.arrivedDate?.toISOString().split("T")[0] ?? "",
            o.status, o.shippingUnit ?? "", o.shippingCode ?? "",
            o.totalVnd, o.sellingPriceVnd ?? "", paidSupplier, paidCustomer,
          ];
        }),
      ];
      await clearAndWrite(sheets, "Thu mua", rows);
      synced.push("purchases");
    }

    // ─── SẢN PHẨM ────────────────────────────────────────────────────────────
    if (target === "all" || target === "products") {
      const products = await prisma.product.findMany({ orderBy: [{ nameVi: "asc" }, { name: "asc" }] });
      const rows: (string | number | null)[][] = [
        ["Tên (VN)", "Tên (EN)", "SKU Shopify", "SKU TikTok", "SKU AMZ", "Đơn vị", "g/gói", "Danh mục", "Ghi chú"],
        ...products.map((p) => [
          p.nameVi ?? "", p.name,
          p.skuShopify ?? "", p.skuTiktok ?? "", p.skuAmz ?? "",
          p.unit, p.gramsPerUnit ?? "", p.category ?? "", p.notes ?? "",
        ]),
      ];
      await clearAndWrite(sheets, "Sản phẩm", rows);
      synced.push("products");
    }

    // ─── TỒN KHO (app + Shopify qty) ─────────────────────────────────────────
    if (target === "all" || target === "inventory") {
      // Fetch Shopify inventory
      const settings = await prisma.setting.findMany();
      const config = settings.reduce((acc, s) => ({ ...acc, [s.key]: s.value }), {} as Record<string, string>);
      const domainRaw = config.shopifyStoreDomain || process.env.SHOPIFY_STORE_DOMAIN;
      const domain = domainRaw?.replace(/^https?:\/\//, "").replace(/\/$/, "");
      const accessToken = config.shopifyAccessToken || config.shopifyApiSecret || process.env.SHOPIFY_API_SECRET;

      const shopifyQtyMap: Record<string, number> = {};
      if (domain && accessToken) {
        try {
          let pageUrl: string | null = `https://${domain}/admin/api/2024-01/products.json?limit=250&fields=id,title,variants`;
          while (pageUrl) {
            const resp: Response = await fetch(pageUrl, { headers: { "X-Shopify-Access-Token": accessToken } });
            if (!resp.ok) break;
            const data = await resp.json();
            for (const product of data.products ?? []) {
              for (const variant of product.variants ?? []) {
                if (variant.sku) {
                  shopifyQtyMap[variant.sku] = (shopifyQtyMap[variant.sku] ?? 0) + (variant.inventory_quantity ?? 0);
                }
              }
            }
            const link: string = resp.headers.get("Link") ?? "";
            const next: RegExpMatchArray | null = link.match(/<([^>]+)>;\s*rel="next"/);
            pageUrl = next ? next[1] : null;
          }
        } catch { /* Shopify optional */ }
      }

      const products = await prisma.product.findMany({
        orderBy: [{ nameVi: "asc" }, { name: "asc" }],
        include: {
          purchaseItems: { include: { purchaseOrder: { select: { status: true } } } },
          salesItems: { select: { quantity: true } },
        },
      });

      const rows: (string | number | null)[][] = [
        ["Tên (VN)", "Tên (EN)", "SKU Shopify", "SKU AMZ", "Đơn vị", "g/gói",
          "Tồn kho (App)", "Đã mua về", "Đã bán", "Shopify Qty", "Ngưỡng", "Trạng thái", "Danh mục"],
      ];
      for (const p of products) {
        const arrivedStatuses = ["arrived", "completed"];
        const purchasedUnits = p.purchaseItems
          .filter((pi) => arrivedStatuses.includes(pi.purchaseOrder.status))
          .reduce((sum, pi) => sum + toSellingUnits(pi.quantity, p.unit, p.gramsPerUnit), 0);
        const soldUnits = p.salesItems.reduce((sum, si) => sum + si.quantity, 0);
        const stockUnits = purchasedUnits - soldUnits;
        const threshold = p.restockThreshold ?? 10;
        const shopifyQty = p.skuShopify ? (shopifyQtyMap[p.skuShopify] ?? "") : "";
        let status = "Còn hàng";
        if (purchasedUnits === 0) status = "Chờ hàng về";
        else if (stockUnits <= 0) status = "Hết hàng";
        else if (stockUnits <= threshold) status = "Sắp hết";
        rows.push([p.nameVi ?? "", p.name, p.skuShopify ?? "", p.skuAmz ?? "",
          p.unit, p.gramsPerUnit ?? "", stockUnits, purchasedUnits, soldUnits,
          shopifyQty, threshold, status, p.category ?? ""]);
      }
      await clearAndWrite(sheets, "Tồn kho", rows);
      synced.push("inventory");
    }

    // ─── BÁN HÀNG ────────────────────────────────────────────────────────────
    if (target === "all" || target === "sales") {
      const orders = await prisma.shopifyOrder.findMany({
        where: { financialStatus: "paid" },
        orderBy: { createdAtShopify: "desc" },
      });
      const rows: (string | number | null)[][] = [
        ["Mã đơn", "Tên đơn", "Ngày", "Kênh", "Sản phẩm", "SKU", "Số lượng", "Đơn giá (USD)", "Thành tiền (USD)"],
      ];
      for (const order of orders) {
        let lineItems: { id: number; title: string; sku: string; quantity: number; price: string; variant_title?: string }[] = [];
        try { lineItems = JSON.parse(order.lineItemsJson || "[]"); } catch { continue; }
        const channel = order.sourceName === "tiktok" || order.paymentGateway?.toLowerCase().includes("tiktok") ? "TikTok" : "Shopify";
        for (const item of lineItems) {
          const productName = item.title + (item.variant_title && item.variant_title !== "Default Title" ? ` - ${item.variant_title}` : "");
          rows.push([order.shopifyId, order.orderName, order.createdAtShopify.toISOString().split("T")[0],
            channel, productName, item.sku || "", item.quantity,
            parseFloat(item.price || "0"), parseFloat(item.price || "0") * item.quantity]);
        }
      }
      await clearAndWrite(sheets, "Bán hàng", rows);
      synced.push("sales");
    }

    // ─── TÊN VN (MASTER) ─────────────────────────────────────────────────────
    // Tab gốc để mua hàng tại VN: 1 tên VN = nhiều SKU variant
    if (target === "all" || target === "vi_names") {
      const allProds = await prisma.product.findMany({
        orderBy: [{ nameVi: "asc" }, { name: "asc" }],
      });

      // Lấy Shopify qty map
      const settings3 = await prisma.setting.findMany();
      const cfg3 = settings3.reduce((acc, s) => ({ ...acc, [s.key]: s.value }), {} as Record<string, string>);
      const dom3 = (cfg3.shopifyStoreDomain || process.env.SHOPIFY_STORE_DOMAIN)?.replace(/^https?:\/\//, "").replace(/\/$/, "");
      const tok3 = cfg3.shopifyAccessToken || cfg3.shopifyApiSecret || process.env.SHOPIFY_API_SECRET;
      const sqMap: Record<string, number> = {};
      if (dom3 && tok3) {
        try {
          let pu: string | null = `https://${dom3}/admin/api/2024-01/products.json?limit=250&fields=id,variants`;
          while (pu) {
            const r3: Response = await fetch(pu, { headers: { "X-Shopify-Access-Token": tok3 } });
            if (!r3.ok) break;
            const d3 = await r3.json();
            for (const sp of d3.products ?? []) for (const sv of sp.variants ?? []) if (sv.sku) sqMap[sv.sku] = (sqMap[sv.sku] ?? 0) + (sv.inventory_quantity ?? 0);
            const lk3: string = r3.headers.get("Link") ?? "";
            const nx3: RegExpMatchArray | null = lk3.match(/<([^>]+)>;\s*rel="next"/);
            pu = nx3 ? nx3[1] : null;
          }
        } catch { /* optional */ }
      }

      // Đọc ghi chú mua hàng hiện có trước khi ghi đè (cột index 5 = "Ghi chú mua hàng")
      const savedNotes = new Map<string, string>();
      try {
        await ensureSheet(sheets, "★ Tên VN (Gốc)");
        const existingRes = await sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: "★ Tên VN (Gốc)!A:F",
        });
        const existingRows = (existingRes.data.values ?? []) as string[][];
        for (let i = 1; i < existingRows.length; i++) {
          const nameKey = String(existingRows[i][0] ?? "").trim();
          const note    = String(existingRows[i][5] ?? "").trim();
          if (nameKey && note) savedNotes.set(nameKey, note);
        }
      } catch { /* sheet may not exist yet */ }

      // Group theo nameVi — sản phẩm không có nameVi vẫn xuất hiện riêng
      type ProdRow = typeof allProds[number];
      const grouped = new Map<string, ProdRow[]>();

      for (const p of allProds) {
        const key = p.nameVi ?? `__no_vi__${p.id}`;
        if (!grouped.has(key)) grouped.set(key, []);
        grouped.get(key)!.push(p);
      }

      // Header: cột cố định + tối đa MAX_VARIANTS nhóm cột variant
      const MAX_VARIANTS = 6;
      const fixedHeader = [
        "Tên VN", "Danh mục", "Đơn vị mua (VN)",
        "Tổng Shopify Qty", "Số variants",
        "Ghi chú mua hàng",
      ];
      const variantHeaders: string[] = [];
      for (let i = 1; i <= MAX_VARIANTS; i++) {
        variantHeaders.push(`SKU Shopify ${i}`, `SKU AMZ ${i}`, `Tên EN ${i}`, `g/gói ${i}`, `Shopify Qty ${i}`);
      }
      const header = [...fixedHeader, ...variantHeaders];

      const viRows: (string | number | null)[][] = [header];

      for (const [key, variants] of grouped) {
        const isNoVi = key.startsWith("__no_vi__");
        const nameVi = isNoVi ? "" : key;

        // Tổng shopify qty của cả nhóm
        const totalShopifyQty = variants.reduce((sum, p) => {
          return sum + (p.skuShopify ? (sqMap[p.skuShopify] ?? 0) : 0);
        }, 0);

        const unit = variants[0]?.unit ?? "";
        const category = variants[0]?.category ?? "";

        // Khôi phục ghi chú mua hàng người dùng đã điền trước đó
        const savedNote = nameVi ? (savedNotes.get(nameVi) ?? "") : "";

        const row: (string | number | null)[] = [
          nameVi,
          category,
          unit,
          totalShopifyQty || "",
          variants.length,
          savedNote,
        ];

        // Điền từng variant
        for (let i = 0; i < MAX_VARIANTS; i++) {
          const p = variants[i];
          if (p) {
            const shopifyQty = p.skuShopify ? (sqMap[p.skuShopify] ?? "") : "";
            row.push(p.skuShopify ?? "", p.skuAmz ?? "", p.name, p.gramsPerUnit ?? "", shopifyQty);
          } else {
            row.push("", "", "", "", "");
          }
        }

        viRows.push(row);
      }

      await clearAndWrite(sheets, "★ Tên VN (Gốc)", viRows);
      synced.push("vi_names");
    }

    // ─── KHO BROS (đọc từ Bros sheet → ghi vào sheet của mình) ──────────────
    // Đọc các tab có data từ Bros sheet và copy nguyên sang sheet của mình
    if (target === "all" || target === "bros_inventory") {
      const tabsToSync = [
        "Inbound Information",
        "FBM Order",
        "Inventory",       // nếu có tab Inventory trong Bros sheet
        "Current Inventory", // tên có thể khác
      ];

      // Lấy danh sách tab thực sự tồn tại trong Bros sheet
      const brosMeta = await sheets.spreadsheets.get({ spreadsheetId: BROS_SPREADSHEET_ID });
      const brosSheetTitles = (brosMeta.data.sheets ?? [])
        .map((s) => s.properties?.title ?? "")
        .filter(Boolean);

      for (const tabTitle of tabsToSync) {
        if (!brosSheetTitles.includes(tabTitle)) continue;
        const data = await readBrosSheet(sheets, tabTitle);
        if (data.length === 0) continue;
        // Ghi vào sheet của mình với prefix "Bros - " để phân biệt
        const destTitle = `Bros - ${tabTitle}`;
        await clearAndWrite(sheets, destTitle, data as (string | number | boolean | null)[][]);
        synced.push(`bros:${tabTitle}`);
      }
    }

    // ─── INBOUND (thông tin lô hàng từ app → sheet của mình) ─────────────────
    if (target === "inbound") {
      const shipments = await prisma.shipmentBatch.findMany({
        where: { status: { in: ["packing", "in_transit", "arrived_us", "received_by_td", "done"] } },
        include: {
          orders: { include: { purchaseOrder: { include: { items: { include: { product: true } } } } } },
        },
      });
      const rows: (string | number | null)[][] = [
        ["AMZ Barcode/UPC", "Quantity", "Unit", "Product Type", "Product Description", "Tracking Number", "Date", "Note"],
      ];
      for (const shipment of shipments) {
        for (const batchOrder of shipment.orders) {
          for (const item of batchOrder.purchaseOrder.items) {
            const p = item.product;
            rows.push([p.skuAmz ?? p.skuShopify ?? "", item.quantity, p.unit, p.category ?? "",
              p.nameVi ?? p.name, shipment.trackingCode ?? "",
              shipment.departedVnDate?.toISOString().split("T")[0] ?? shipment.createdAt.toISOString().split("T")[0],
              shipment.notes ?? ""]);
          }
        }
      }
      await clearAndWrite(sheets, "Inbound Information", rows);
      synced.push("inbound");
    }

    // ─── FBM (lệnh đóng hàng từ app → sheet của mình) ────────────────────────
    if (target === "fbm") {
      const fulfillmentOrders = await prisma.fulfillmentOrder.findMany({
        where: { status: { notIn: ["cancelled", "done"] } },
        orderBy: { createdAt: "desc" },
        include: { items: { include: { product: true } } },
      });
      const rows: (string | number | null)[][] = [
        ["Order Number", "Order Date", "Name", "Street Line 1", "Street Number", "Street Line 2",
          "City", "State", "Zip", "Country", "Item Title", "UPC/AMZ Barcode/SKU", "Quantity",
          "Item Price", "Order Amount", "Currency", "WH Note"],
      ];
      for (const fo of fulfillmentOrders) {
        const addr = fo.customerAddress ?? "";
        const parts = addr.split(",").map((s) => s.trim());
        const stateZipMatch = (parts[2] ?? "").match(/^([A-Z]{2})\s+(\d{5}(?:-\d{4})?)$/);
        for (const item of fo.items) {
          rows.push([fo.shopifyOrderId ?? fo.code, fo.createdAt.toISOString().split("T")[0],
            fo.customerName ?? "", parts[0] ?? addr, "", "", parts[1] ?? "",
            stateZipMatch ? stateZipMatch[1] : (parts[2] ?? ""),
            stateZipMatch ? stateZipMatch[2] : "", "US",
            item.productName, item.skuRaw ?? item.product?.skuAmz ?? item.product?.skuShopify ?? "",
            item.quantity, "", "", "USD", fo.noteSentToTd ?? ""]);
        }
      }
      await clearAndWrite(sheets, "FBM Order", rows);
      synced.push("fbm");
    }

    // ─── TỔNG HỢP (tab chính — gộp tất cả nguồn) ─────────────────────────────
    if (target === "all" || target === "summary") {
      // 1. Shopify inventory qty (per SKU)
      const settings2 = await prisma.setting.findMany();
      const config2 = settings2.reduce((acc, s) => ({ ...acc, [s.key]: s.value }), {} as Record<string, string>);
      const domainRaw2 = config2.shopifyStoreDomain || process.env.SHOPIFY_STORE_DOMAIN;
      const domain2 = domainRaw2?.replace(/^https?:\/\//, "").replace(/\/$/, "");
      const accessToken2 = config2.shopifyAccessToken || config2.shopifyApiSecret || process.env.SHOPIFY_API_SECRET;

      const shopifyMap: Record<string, number> = {}; // sku → qty
      if (domain2 && accessToken2) {
        try {
          let pageUrl: string | null = `https://${domain2}/admin/api/2024-01/products.json?limit=250&fields=id,title,variants`;
          while (pageUrl) {
            const resp: Response = await fetch(pageUrl, { headers: { "X-Shopify-Access-Token": accessToken2 } });
            if (!resp.ok) break;
            const data = await resp.json();
            for (const product of data.products ?? []) {
              for (const variant of product.variants ?? []) {
                if (variant.sku) {
                  shopifyMap[variant.sku] = (shopifyMap[variant.sku] ?? 0) + (variant.inventory_quantity ?? 0);
                }
              }
            }
            const link: string = resp.headers.get("Link") ?? "";
            const next: RegExpMatchArray | null = link.match(/<([^>]+)>;\s*rel="next"/);
            pageUrl = next ? next[1] : null;
          }
        } catch { /* optional */ }
      }

      // 2. Bros warehouse qty (đọc từ Bros sheet — tìm tab có cột SKU + Qty + Name)
      const brosMap: Record<string, number> = {};     // sku → qty (exact match)
      const brosNameMap: Record<string, number> = {}; // normalized name → qty (fallback)
      try {
        const brosMeta2 = await sheets.spreadsheets.get({ spreadsheetId: BROS_SPREADSHEET_ID });
        const brosTabs = (brosMeta2.data.sheets ?? []).map((s) => s.properties?.title ?? "").filter(Boolean);

        const inventoryTabCandidates = ["Inventory", "Current Inventory", "Stock", "Tồn kho", "inventory"];
        for (const tabName of inventoryTabCandidates) {
          if (!brosTabs.includes(tabName)) continue;
          const brosData = await readBrosSheet(sheets, tabName);
          if (brosData.length < 2) continue;
          const header = brosData[0].map((h) => String(h).toLowerCase().trim());
          const skuCol  = header.findIndex((h) => h.includes("amz barcode") || h.includes("barcode") || h.includes("sku") || h.includes("upc") || h.includes("asin"));
          // Ưu tiên "description" (Bros dùng "Product Description" cho tên thực)
          const nameCol = header.findIndex((h) => h.includes("description")) !== -1
            ? header.findIndex((h) => h.includes("description"))
            : header.findIndex((h) => h.includes("title") || h.includes("name") || h.includes("product") || h === "item");
          const qtyCol  = header.findIndex((h) => h.includes("total in stock")) !== -1
            ? header.findIndex((h) => h.includes("total in stock"))
            : header.findIndex((h) => h.includes("in stock") || h.includes("instock") || h.includes("available") || h.includes("qty") || h.includes("quantity") || h.includes("stock"));
          if (qtyCol === -1) continue;
          for (let i = 1; i < brosData.length; i++) {
            const row  = brosData[i];
            const sku  = skuCol  !== -1 ? String(row[skuCol]  ?? "").trim() : "";
            const name = nameCol !== -1 ? String(row[nameCol] ?? "").trim() : "";
            const qty  = parseFloat(String(row[qtyCol] ?? "0").replace(/,/g, "")) || 0;
            if (sku)  brosMap[sku] = (brosMap[sku] ?? 0) + qty;
            if (name) brosNameMap[normalizeName(name)] = qty;
          }
          break;
        }
      } catch { /* Bros sheet optional */ }

      // 3. App data — tính tồn kho theo purchase status
      const allProducts = await prisma.product.findMany({
        orderBy: [{ nameVi: "asc" }, { name: "asc" }],
        include: {
          purchaseItems: {
            include: { purchaseOrder: { select: { status: true } } },
          },
          salesItems: { select: { quantity: true } },
        },
      });

      // 4. Tính "đang về" = đã mua nhưng chưa arrived
      // status: draft/confirmed/in_transit → chưa về kho US
      const inTransitStatuses = ["confirmed", "in_transit", "packing"];
      const arrivedStatuses = ["arrived", "completed"];

      // Build rows
      const summaryRows: (string | number | null)[][] = [
        [
          "Tên (VN)", "Tên (EN)", "SKU Shopify", "SKU AMZ",
          "Đơn vị", "g/gói", "Danh mục",
          // Từng nguồn
          "Shopify Qty", // Shopify báo cáo (nhiều kho, có thể sai)
          "Bros Qty",    // Kho Bros thực tế
          "Đang về (VN→US)", // Đã mua, chưa ship sang US
          "App: Đã về", // Đã về kho (arrived/completed)
          "App: Đã bán", // Đã bán trên Shopify
          // Tính toán
          "Tồn kho thực tế",   // Bros Qty + Đã về - Đã bán
          "Chênh lệch Shopify", // Shopify Qty - Tồn kho thực tế → >0: Shopify đang thừa, <0: thiếu
          // Gợi ý
          "Cần sửa Shopify?",
          "Ghi chú",
        ],
      ];

      for (const p of allProducts) {
        const inTransitQty = p.purchaseItems
          .filter((pi) => inTransitStatuses.includes(pi.purchaseOrder.status))
          .reduce((sum, pi) => sum + toSellingUnits(pi.quantity, p.unit, p.gramsPerUnit), 0);

        const arrivedQty = p.purchaseItems
          .filter((pi) => arrivedStatuses.includes(pi.purchaseOrder.status))
          .reduce((sum, pi) => sum + toSellingUnits(pi.quantity, p.unit, p.gramsPerUnit), 0);

        const soldQty = p.salesItems.reduce((sum, si) => sum + si.quantity, 0);

        // Tìm qty trong Bros map — thử SKU trước, sau đó fallback qua tên (normalized)
        const brosQty = (p.skuAmz ? (brosMap[p.skuAmz] ?? null) : null)
          ?? (p.skuShopify ? (brosMap[p.skuShopify] ?? null) : null)
          ?? (p.nameVi ? (brosNameMap[normalizeName(p.nameVi)] ?? null) : null)
          ?? (brosNameMap[normalizeName(p.name)] ?? null)
          ?? null;

        const shopifyQty = p.skuShopify ? (shopifyMap[p.skuShopify] ?? null) : null;

        // Tồn kho thực tế = Bros qty (nếu có) + arrivedQty - soldQty
        // Nếu không có Bros data thì dùng arrivedQty - soldQty
        const actualStock = brosQty !== null
          ? brosQty  // Bros là nguồn tin cậy nhất (hàng đang ở kho)
          : arrivedQty - soldQty;

        const shopifyDiff = shopifyQty !== null ? shopifyQty - actualStock : null;

        let needFix = "";
        if (shopifyDiff !== null) {
          if (shopifyDiff > 0) needFix = `Shopify thừa ${shopifyDiff} — giảm xuống`;
          else if (shopifyDiff < 0) needFix = `Shopify thiếu ${Math.abs(shopifyDiff)} — tăng lên`;
          else needFix = "✓ Đồng bộ";
        }

        summaryRows.push([
          p.nameVi ?? "", p.name,
          p.skuShopify ?? "", p.skuAmz ?? "",
          p.unit, p.gramsPerUnit ?? "", p.category ?? "",
          shopifyQty ?? "",
          brosQty ?? "",
          inTransitQty || "",
          arrivedQty || "",
          soldQty || "",
          actualStock,
          shopifyDiff ?? "",
          needFix,
          "", // Ghi chú — để trống cho người dùng tự điền
        ]);
      }

      await clearAndWrite(sheets, "★ Tổng hợp", summaryRows);
      synced.push("summary");
    }

    // ─── SẢN XUẤT ────────────────────────────────────────────────────────────
    if (target === "all" || target === "production") {
      const prodOrders = await prisma.productionOrder.findMany({
        orderBy: { createdAt: "desc" },
        include: {
          purchaseOrder: { include: { supplier: true } },
          items: { include: { product: true, purchaseItem: true } },
          costs: { orderBy: { createdAt: "asc" } },
        },
      });

      const PROD_STATUS_LABELS: Record<string, string> = {
        pending: "Chờ sản xuất",
        in_production: "Đang sản xuất",
        done: "Hoàn tất",
        cancelled: "Đã hủy",
      };

      const prodRows: (string | number | null)[][] = [
        [
          "Mã lệnh", "Mã đơn mua", "Nhà cung cấp", "Trạng thái",
          "Ngày tạo", "Ngày bắt đầu", "Ngày hoàn tất",
          "Sản phẩm", "Dự kiến (gói)", "Thực tế (gói)", "Hao hụt (gói)",
          "Tổng chi phí (VND)", "Giá vốn/gói (VND)", "Ghi chú chi phí",
        ],
      ];

      for (const order of prodOrders) {
        const totalCost = order.costs.reduce((s, c) => s + c.amountVnd, 0);
        const totalPlanned = order.items.reduce((s, i) => s + i.plannedQty, 0);
        const totalActual = order.items.reduce((s, i) => s + (i.actualQty ?? 0), 0);
        const totalMaterialBase = order.items.reduce((s, i) => s + i.purchaseItem.subtotalVnd, 0);
        const costSummary = order.costs.map((c) => `${c.description}: ${c.amountVnd.toLocaleString("vi-VN")}đ`).join(" | ");

        if (order.items.length === 0) {
          prodRows.push([
            order.code, order.purchaseOrder.code, order.purchaseOrder.supplier.name,
            PROD_STATUS_LABELS[order.status] ?? order.status,
            order.createdAt.toISOString().split("T")[0],
            order.startedAt?.toISOString().split("T")[0] ?? "",
            order.completedAt?.toISOString().split("T")[0] ?? "",
            "(không có sản phẩm)", 0, 0, 0,
            totalCost || "", "", costSummary,
          ]);
          continue;
        }

        for (const item of order.items) {
          const ratio = totalMaterialBase > 0 ? item.purchaseItem.subtotalVnd / totalMaterialBase : 1 / order.items.length;
          const allocatedCost = Math.round(totalCost * ratio);
          const costPerPack = item.actualQty ? Math.round(allocatedCost / item.actualQty) : null;
          const waste = item.actualQty != null ? item.plannedQty - item.actualQty : null;

          prodRows.push([
            order.code, order.purchaseOrder.code, order.purchaseOrder.supplier.name,
            PROD_STATUS_LABELS[order.status] ?? order.status,
            order.createdAt.toISOString().split("T")[0],
            order.startedAt?.toISOString().split("T")[0] ?? "",
            order.completedAt?.toISOString().split("T")[0] ?? "",
            item.product.nameVi ?? item.product.name,
            item.plannedQty,
            item.actualQty ?? "",
            waste ?? "",
            allocatedCost || "",
            costPerPack ?? "",
            costSummary,
          ]);
        }
      }

      await clearAndWrite(sheets, "Sản xuất", prodRows);
      synced.push("production");
    }

    // ─── KHO NHUNG ───────────────────────────────────────────────────────────
    if (target === "all" || target === "nhung") {
      const products = await prisma.product.findMany({
        orderBy: [{ nameVi: "asc" }, { name: "asc" }],
        select: { id: true, name: true, nameVi: true, skuShopify: true, skuAmz: true, nhungQty: true },
      });

      // Kho Bros
      const brosStocks = await prisma.warehouseStock.findMany({ where: { warehouse: "bros" } });
      const brosMap: Record<string, number> = {};
      for (const s of brosStocks) brosMap[s.sku] = (brosMap[s.sku] ?? 0) + s.inStock;

      const nhungRows: (string | number | null)[][] = [
        ["Tên (VN)", "Tên (EN)", "SKU Shopify", "SKU AMZ", "Kho Nhung (VN)", "Kho Bros (US)", "Tổng → Shopify", "Ghi chú"],
      ];
      for (const p of products) {
        const brosQty = (p.skuAmz ? brosMap[p.skuAmz] : null) ?? (p.skuShopify ? brosMap[p.skuShopify] : null) ?? 0;
        const total = p.nhungQty + brosQty;
        nhungRows.push([
          p.nameVi ?? "", p.name,
          p.skuShopify ?? "", p.skuAmz ?? "",
          p.nhungQty,
          brosQty,
          total,
          total > 0 ? "" : "⚠ Hết hàng",
        ]);
      }
      await clearAndWrite(sheets, "Kho Nhung", nhungRows);
      synced.push("nhung");
    }

    // ─── ĐƠN KHO NHUNG (pending orders routed to Nhung) ─────────────────────
    if (target === "all" || target === "nhung_orders") {
      const orders = await prisma.fulfillmentOrder.findMany({
        where: {
          status: { notIn: ["done", "cancelled"] },
          warehouseSource: { in: ["nhung", "mixed"] },
        },
        orderBy: { createdAt: "desc" },
        include: { items: { include: { product: true } } },
      });

      const WH_LABEL: Record<string, string> = { nhung: "Kho Nhung", bros: "Kho Bros", mixed: "Hỗn hợp" };
      const orderRows: (string | number | null)[][] = [
        ["Mã lệnh", "Nguồn", "Kho", "Khách hàng", "Địa chỉ", "Sản phẩm", "SL", "Kho item",
          "Trạng thái", "Báo Nhung lúc", "Nhung ship lúc", "Tracking Nhung", "Ngày tạo"],
      ];

      for (const o of orders) {
        for (const item of o.items) {
          if (item.warehouseSource !== "nhung") continue;
          orderRows.push([
            o.code, o.source,
            WH_LABEL[o.warehouseSource ?? "nhung"] ?? o.warehouseSource ?? "",
            o.customerName ?? "", o.customerAddress ?? "",
            item.product?.nameVi ?? item.productName,
            item.quantity,
            "Kho Nhung",
            o.status,
            o.nhungNotifiedAt ? o.nhungNotifiedAt.toISOString().replace("T", " ").slice(0, 16) : "",
            o.nhungShippedAt ? o.nhungShippedAt.toISOString().replace("T", " ").slice(0, 16) : "",
            o.nhungTrackingCode ?? "",
            o.createdAt.toISOString().split("T")[0],
          ]);
        }
      }

      await clearAndWrite(sheets, "Đơn Kho Nhung", orderRows);
      synced.push("nhung_orders");
    }

    return Response.json({ ok: true, synced });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return Response.json({ error: msg }, { status: 500 });
  }
}
