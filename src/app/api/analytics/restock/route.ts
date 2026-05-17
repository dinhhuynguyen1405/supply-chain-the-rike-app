/**
 * GET /api/analytics/restock
 * ─────────────────────────────────────────────────────────────────────────────
 * Phân tích tồn kho theo NHÓM SẢN PHẨM (ProductGroup).
 * Nếu 1 nhóm có nhiều mã SKU, tồn kho được tính TỔNG cộng toàn nhóm.
 * → Nếu bất kỳ mã nào đang có hàng, nhóm đó KHÔNG bị xếp "critical".
 */

import { prisma } from "@/lib/prisma";

interface LineItem {
  sku?: string;
  title?: string;
  quantity?: number;
  price?: string;
}

// ── Exported interfaces ───────────────────────────────────────────────────────

export interface MonthlyData {
  month: string;
  label: string;
  sold: number;
  revenueUsd: number;
  activeDays: number;
  soldPer30Days: number;
}

export interface TrendAnalysis {
  months: MonthlyData[];
  numMonths: number;
  recentVelocity: number;
  avgVelocity: number;
  momChangePct: number | null;
  trend: "growing" | "declining" | "stable" | "new";
  forecastNext1M: number;
  forecastNext3M: number;
  forecastNext6M: number;
  peakMonth: string | null;
  peakSold: number;
}

export interface PackagingInfo {
  gramsPerUnit: number | null;
  piecesPerUnit: number | null;
  piecesPerPack: number | null;
  unit: string;
  packsPerRawUnit: number | null;
  packagingFormula: string | null;
}

export interface CostInfo {
  groupName: string | null;
  baseCostVnd: number | null;
  costUnit: string | null;
  costPerPack: number | null;
}

export interface RestockRecommendation {
  targetDays: number;
  gapDays: number;
  suggestedPacks: number;
  suggestedRawAmount: number | null;
  suggestedRawUnit: string | null;
  estimatedCostVnd: number | null;
  recommendation: string | null;
  reason: string;
  basis: "trend" | "avg";
}

/** Per-variant (SKU / product) detail — used inside GroupedRestockItem.variants */
export interface RestockItem {
  sku: string;
  title: string;
  productId: string | null;
  groupId: string | null;
  localName: string | null;

  totalSold: number;
  numOrders: number;
  revenueUsd: number;
  firstSale: string;
  lastSale: string;
  daysTracked: number;
  soldPerMonth: number;
  soldPerDay: number;

  nhungQty: number;
  brosQty: number;
  totalStock: number;
  pipelinePacks: number;
  effectiveStock: number;

  daysLeft: number | null;
  monthsLeft: number | null;

  totalPurchasedRaw: number;
  totalProducedPacks: number;
  inProductionPacks: number;    // packs in production orders with status "in_production"
  pendingProductionPacks: number; // packs in production orders with status "pending"

  urgency: "critical" | "warning" | "healthy" | "overstocked" | "no_sales" | "unmapped";
  priceUsd: number | null;

  trend: TrendAnalysis;
  packaging: PackagingInfo;
  cost: CostInfo;
  restock: RestockRecommendation;
}

/** Group-level item — ONE row per ProductGroup in the main table */
export interface GroupedRestockItem {
  id: string;                 // groupId or fallback key
  groupId: string | null;
  name: string;               // group name or product name

  // Aggregated across all variants
  totalSold: number;
  revenueUsd: number;
  numOrders: number;
  nhungQty: number;
  brosQty: number;
  totalStock: number;         // sum across variants
  pipelinePacks: number;      // sum across variants
  effectiveStock: number;     // totalStock + pipelinePacks
  inProductionPacks: number;    // sum of variants' inProductionPacks
  pendingProductionPacks: number; // sum of variants' pendingProductionPacks
  totalProducedPacks: number;    // sum of variants' totalProducedPacks (all-time, including done)
  hasAnyStock: boolean;
  variantsWithStock: string[];// variant names that have effective stock

  firstSale: string;
  lastSale: string;
  daysTracked: number;
  soldPerMonth: number;

  daysLeft: number | null;
  monthsLeft: number | null;

  urgency: RestockItem["urgency"];

  // Combined trend (merged soldByMonth across all variants)
  trend: TrendAnalysis;

  // Cost from ProductGroup record
  cost: CostInfo;

  // Group-level restock summary
  totalSuggestedPacks: number;
  totalEstimatedCostVnd: number | null;
  restock: RestockRecommendation;

  // Individual variants for detail view
  variants: RestockItem[];

  // Purchase orders liên kết với group này (non-cancelled, gần nhất)
  linkedPurchases: LinkedPurchaseInfo[];
}

export interface LinkedPurchaseInfo {
  id: string;
  status: string;
  supplierName: string | null;
  totalVnd: number;
  /** Tổng đã trả cho nhà cung cấp (to_supplier payments) */
  paidToSupplierVnd: number;
  /** Tổng đã nhận từ Nhung / khách mua hộ (from_customer payments) */
  receivedFromCustomerVnd: number;
  rawQty: number;
  rawUnit: string | null;
  /** Số gói đã sản xuất từ đơn mua này */
  producedPacks: number;
  productionStatus: string | null;
  createdAt: string;
}

export interface ShoppingListGroup {
  groupName: string;
  groupId: string | null;
  items: {
    sku: string;
    localName: string;
    urgency: RestockItem["urgency"];
    suggestedPacks: number;
    suggestedRawAmount: number | null;
    suggestedRawUnit: string | null;
    estimatedCostVnd: number | null;
    packagingFormula: string | null;
    trend: TrendAnalysis["trend"];
    forecastNext3M: number;
    totalStock?: number;
    pipelinePacks?: number;
    totalProducedPacks?: number;
    totalPurchasedRaw?: number;
    daysLeft?: number | null;
  }[];
  totalRawAmount: number | null;
  rawUnit: string | null;
  totalCostVnd: number | null;
}

export interface RestockSummary {
  totalOrders: number;
  totalRevenueUsd: number;
  periodDays: number;
  ordersPerDay: number;
  revenuePerDay: number;
  oldestOrder: string;
  newestOrder: string;
  totalRestockCostVnd: number;
  totalRestockPacks: number;
}

export interface RestockResponse {
  summary: RestockSummary;
  items: GroupedRestockItem[];
  shoppingList: ShoppingListGroup[];
  targetDays: number;
  leadDays: number;
  generatedAt: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function linearSlope(values: number[]): number {
  const n = values.length;
  if (n < 2) return 0;
  const xs = values.map((_, i) => i);
  const xMean = xs.reduce((a, b) => a + b, 0) / n;
  const yMean = values.reduce((a, b) => a + b, 0) / n;
  const num = xs.reduce((s, x, i) => s + (x - xMean) * (values[i] - yMean), 0);
  const den = xs.reduce((s, x) => s + (x - xMean) ** 2, 0);
  return den === 0 ? 0 : num / den;
}

function monthRange(first: Date, last: Date): string[] {
  const keys: string[] = [];
  const cur = new Date(first.getFullYear(), first.getMonth(), 1);
  const end = new Date(last.getFullYear(), last.getMonth(), 1);
  while (cur <= end) {
    keys.push(`${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}`);
    cur.setMonth(cur.getMonth() + 1);
  }
  return keys;
}

function monthLabel(key: string): string {
  const [y, m] = key.split("-");
  return `T${parseInt(m)}/${y.slice(2)}`;
}

function activeDaysInMonth(monthKey: string, firstSale: Date, now: Date): number {
  const [y, m] = monthKey.split("-").map(Number);
  const monthStart = new Date(y, m - 1, 1);
  const monthEnd   = new Date(y, m, 0);
  const from = new Date(Math.max(monthStart.getTime(), firstSale.getTime()));
  const to   = new Date(Math.min(monthEnd.getTime(), now.getTime()));
  if (to < from) return 0;
  return Math.round((to.getTime() - from.getTime()) / 86400000) + 1;
}

function buildTrendAnalysis(
  soldByMonth: Record<string, number>,
  revByMonth: Record<string, number>,
  firstSale: Date,
  lastSale: Date,
  now: Date,
): TrendAnalysis {
  const allKeys = monthRange(firstSale, lastSale);
  const numMonths = allKeys.length;

  const months: MonthlyData[] = allKeys.map(k => {
    const sold = soldByMonth[k] ?? 0;
    const rev  = revByMonth[k]  ?? 0;
    const days = activeDaysInMonth(k, firstSale, now);
    const soldPer30 = days > 0 ? (sold / days) * 30 : 0;
    return { month: k, label: monthLabel(k), sold, revenueUsd: rev, activeDays: days, soldPer30Days: Math.round(soldPer30 * 10) / 10 };
  });

  const recentCutoff = new Date(now.getTime() - 60 * 86400000);
  const recentKeys = allKeys.filter(k => {
    const [y, m] = k.split("-").map(Number);
    return new Date(y, m - 1, 1) >= recentCutoff || new Date(y, m, 0) >= recentCutoff;
  });
  const recentSold = recentKeys.reduce((s, k) => s + (soldByMonth[k] ?? 0), 0);
  const recentDays = recentKeys.reduce((s, k) => s + activeDaysInMonth(k, firstSale, now), 0);
  const recentVelocity = recentDays > 0 ? (recentSold / recentDays) * 30 : 0;

  const totalDays = Math.max(1, Math.round((lastSale.getTime() - firstSale.getTime()) / 86400000)) + 1;
  const totalSold = Object.values(soldByMonth).reduce((a, b) => a + b, 0);
  const avgVelocity = (totalSold / totalDays) * 30;

  const velocities = months.map(m => m.soldPer30Days).filter(v => v > 0);
  const slope = velocities.length >= 2 ? linearSlope(velocities) : 0;
  const baseVelocity = velocities[velocities.length - 1] ?? recentVelocity;
  const momChangePct = baseVelocity > 0 ? Math.round((slope / baseVelocity) * 100) : null;

  let trend: TrendAnalysis["trend"] = "stable";
  if (numMonths <= 1) trend = "new";
  else if (momChangePct !== null && momChangePct >= 10) trend = "growing";
  else if (momChangePct !== null && momChangePct <= -10) trend = "declining";

  function forecastMonth(monthOffset: number): number {
    return Math.max(0, Math.round((baseVelocity + slope * monthOffset) * 10) / 10);
  }

  const forecastNext1M = forecastMonth(1);
  const forecastNext3M = Math.round(forecastMonth(1) + forecastMonth(2) + forecastMonth(3));
  const forecastNext6M = Math.round(
    forecastMonth(1) + forecastMonth(2) + forecastMonth(3) +
    forecastMonth(4) + forecastMonth(5) + forecastMonth(6)
  );

  const peakM = months.reduce((best, m) => m.soldPer30Days > (best?.soldPer30Days ?? 0) ? m : best, months[0]);

  return {
    months, numMonths,
    recentVelocity: Math.round(recentVelocity * 10) / 10,
    avgVelocity:    Math.round(avgVelocity    * 10) / 10,
    momChangePct, trend, forecastNext1M, forecastNext3M, forecastNext6M,
    peakMonth: peakM?.month ?? null,
    peakSold:  peakM?.sold  ?? 0,
  };
}

function buildPackagingInfo(p: {
  gramsPerUnit: number | null;
  piecesPerUnit: number | null;
  piecesPerPack: number | null;
  unit: string;
}): PackagingInfo {
  const { gramsPerUnit, piecesPerUnit, piecesPerPack, unit } = p;
  let packsPerRawUnit: number | null = null;
  let packagingFormula: string | null = null;

  if (gramsPerUnit && gramsPerUnit > 0) {
    packsPerRawUnit = 1000 / gramsPerUnit;
    const ppk = packsPerRawUnit % 1 === 0 ? packsPerRawUnit : packsPerRawUnit.toFixed(1);
    packagingFormula = `1 kg → ${ppk} gói ${gramsPerUnit}g`;
  } else if (piecesPerUnit && piecesPerPack && piecesPerUnit > 0 && piecesPerPack > 0) {
    packsPerRawUnit = piecesPerUnit / piecesPerPack;
    packagingFormula = `1 ${unit} (${piecesPerUnit.toLocaleString("vi-VN")} hạt) → ${Math.floor(packsPerRawUnit)} gói ${piecesPerPack.toLocaleString("vi-VN")} hạt`;
  }

  return { gramsPerUnit, piecesPerUnit, piecesPerPack, unit, packsPerRawUnit, packagingFormula };
}

function buildCostInfo(
  p: { gramsPerUnit: number | null; piecesPerUnit: number | null; piecesPerPack: number | null },
  group: { name: string; baseCostVnd: number | null; costUnit: string } | null,
): CostInfo {
  if (!group) return { groupName: null, baseCostVnd: null, costUnit: null, costPerPack: null };
  let costPerPack: number | null = null;
  if (group.baseCostVnd != null) {
    if (p.gramsPerUnit && group.costUnit === "kg") {
      costPerPack = (group.baseCostVnd / 1000) * p.gramsPerUnit;
    } else if (p.piecesPerPack && p.piecesPerUnit && p.piecesPerUnit > 0) {
      costPerPack = group.baseCostVnd * (p.piecesPerPack / p.piecesPerUnit);
    } else if (group.costUnit === "gói" || group.costUnit === "pack") {
      costPerPack = group.baseCostVnd;
    }
  }
  return { groupName: group.name, baseCostVnd: group.baseCostVnd, costUnit: group.costUnit, costPerPack: costPerPack != null ? Math.round(costPerPack) : null };
}

function buildRecommendation(
  effectiveStock: number,
  trendAnalysis: TrendAnalysis,
  daysLeft: number | null,
  urgency: RestockItem["urgency"],
  packaging: PackagingInfo,
  cost: CostInfo,
  targetDays: number,
  leadDays: number,
): RestockRecommendation {
  const { forecastNext3M, forecastNext1M, recentVelocity, avgVelocity, trend } = trendAnalysis;
  const basis: "trend" | "avg" = (trend === "growing" || trend === "declining") ? "trend" : "avg";
  const totalDaysNeeded = targetDays + leadDays;

  let demandInPeriod: number;
  if (basis === "trend") {
    demandInPeriod = Math.ceil((forecastNext3M / 90) * totalDaysNeeded);
  } else {
    const velocityPerDay = (recentVelocity > 0 ? recentVelocity : avgVelocity) / 30;
    demandInPeriod = Math.ceil(velocityPerDay * totalDaysNeeded);
  }

  const suggestedPacks = Math.max(0, demandInPeriod - effectiveStock);
  const gapDays = daysLeft != null ? Math.max(0, totalDaysNeeded - daysLeft) : totalDaysNeeded;

  let suggestedRawAmount: number | null = null;
  let suggestedRawUnit: string | null = null;
  let estimatedCostVnd: number | null = null;

  if (suggestedPacks > 0 && packaging.packsPerRawUnit && packaging.packsPerRawUnit > 0) {
    if (packaging.gramsPerUnit) {
      suggestedRawAmount = Math.ceil((suggestedPacks / packaging.packsPerRawUnit) * 2) / 2;
      suggestedRawUnit = "kg";
    } else if (packaging.piecesPerPack && packaging.piecesPerUnit) {
      suggestedRawAmount = Math.ceil((suggestedPacks / packaging.packsPerRawUnit) * 10) / 10;
      suggestedRawUnit = packaging.unit;
    }
  }

  if (suggestedRawAmount != null && cost.baseCostVnd != null) {
    estimatedCostVnd = Math.round(suggestedRawAmount * cost.baseCostVnd);
  } else if (suggestedPacks > 0 && cost.costPerPack != null) {
    estimatedCostVnd = Math.round(suggestedPacks * cost.costPerPack);
  }

  let recommendation: string | null = null;
  if (suggestedPacks > 0) {
    const basisNote = basis === "trend"
      ? (trend === "growing" ? ` (xu hướng tăng +${trendAnalysis.momChangePct}%/tháng)` : ` (xu hướng giảm ${trendAnalysis.momChangePct}%/tháng)`)
      : "";
    if (suggestedRawAmount != null && suggestedRawUnit) {
      const raw = suggestedRawAmount % 1 === 0 ? suggestedRawAmount.toFixed(0) : suggestedRawAmount.toFixed(1);
      recommendation = `Mua ${raw} ${suggestedRawUnit} → đóng ~${suggestedPacks} gói · đủ dùng ${targetDays} ngày${basisNote}`;
    } else {
      recommendation = `Mua thêm ~${suggestedPacks} gói · đủ dùng ${targetDays} ngày${basisNote}`;
    }
  } else if (urgency === "overstocked") {
    recommendation = `Tồn kho đủ dùng${daysLeft != null ? ` ${Math.round(daysLeft / 30)} tháng` : ""}, không cần mua thêm`;
  } else {
    recommendation = `Tồn kho ổn, không cần mua ngay`;
  }

  const velNote = `dự báo ${forecastNext1M} gói/tháng tới`;
  let reason: string;
  if (urgency === "critical") {
    reason = effectiveStock === 0
      ? `Hết hàng · ${velNote}`
      : `Còn ${effectiveStock} gói · hết sau ${daysLeft ?? "?"} ngày · ${velNote}`;
  } else if (urgency === "warning") {
    reason = `Còn ${daysLeft} ngày · ${velNote} · cần đặt hàng trước ${leadDays} ngày ship`;
  } else if (urgency === "overstocked") {
    reason = `Tồn ${effectiveStock} gói · đủ ${daysLeft != null ? Math.round(daysLeft / 30) : "?"}+ tháng`;
  } else if (urgency === "no_sales") {
    reason = `Chưa có doanh thu`;
  } else {
    reason = `Tồn kho ổn định · ${velNote}`;
  }

  return { targetDays, gapDays, suggestedPacks, suggestedRawAmount, suggestedRawUnit, estimatedCostVnd, recommendation, reason, basis };
}

// ── Main handler ──────────────────────────────────────────────────────────────

export async function GET(req: Request) {
  try {
  const url = new URL(req.url);
  const targetDays = parseInt(url.searchParams.get("targetDays") ?? "90", 10);
  const leadDays   = parseInt(url.searchParams.get("leadDays")   ?? "21", 10);

  // 1. Orders
  const orders = await prisma.shopifyOrder.findMany({
    select: { lineItemsJson: true, createdAtShopify: true },
    orderBy: { createdAtShopify: "asc" },
  });

  // 2. Products
  const products = await prisma.product.findMany({
    select: {
      id: true, name: true, nameVi: true, skuShopify: true,
      skuAmz: true, skuBros: true,          // ← needed for Bros stock lookup
      nhungQty: true, priceUsd: true,
      gramsPerUnit: true, piecesPerUnit: true, piecesPerPack: true, unit: true,
      groupId: true,
    },
  });
  const productBySku: Record<string, typeof products[0]> = {};
  for (const p of products) {
    if (p.skuShopify) p.skuShopify.split(',').forEach((s: string) => { productBySku[s.trim()] = p; });
  }

  // 3. Groups
  const allGroups = await prisma.productGroup.findMany({
    select: { id: true, name: true, baseCostVnd: true, costUnit: true },
  });
  const groupById = new Map(allGroups.map(g => [g.id, g]));

  // 4. Bros stock
  // WarehouseStock.sku for "bros" warehouse is keyed by Amazon ASIN (skuAmz),
  // NOT by skuShopify. Match via product.skuAmz → product.skuBros fallback.
  const brosStocks = await prisma.warehouseStock.findMany({
    where: { warehouse: "bros", inStock: { gt: 0 } },
    select: { sku: true, inStock: true },
  });
  const brosMap: Record<string, number> = {};
  for (const s of brosStocks) brosMap[s.sku] = (brosMap[s.sku] ?? 0) + s.inStock;

  // Helper: look up Bros stock for a product using skuAmz first, then skuBros
  function getBrosQty(product: typeof products[0] | null, fallbackSku?: string): number {
    if (!product) return brosMap[fallbackSku ?? ""] ?? 0;
    // skuAmz is the primary key for WarehouseStock (Amazon ASIN)
    const keys = [product.skuAmz, product.skuBros].filter(Boolean) as string[];
    for (const k of keys) {
      const q = brosMap[k];
      if (q != null && q > 0) return q;
    }
    return 0;
  }

  // 4b. Pipeline — ONLY include orders actively in procurement (not yet arrived/done)
  // "arrived" means goods are already physically received → already in nhungQty → do NOT double-count
  const TERMINAL_PO_STATUSES = ["cancelled", "arrived", "done", "completed", "received", "rejected"];
  const unshippedPOs = await prisma.purchaseOrder.findMany({
    where: {
      status: { notIn: TERMINAL_PO_STATUSES },
      shipmentOrders: { none: {} }
    },
    include: { items: true, productionOrder: { include: { items: true } } }
  });
  const pipelinePacksAgg: Record<string, number> = {};
  const pipelineRawAgg: Record<string, number> = {};
  for (const po of unshippedPOs) {
    if (po.productionOrder && po.productionOrder.status !== "cancelled") {
      for (const pi of po.productionOrder.items) {
        pipelinePacksAgg[pi.productId] = (pipelinePacksAgg[pi.productId] ?? 0) + (pi.actualQty ?? pi.plannedQty ?? 0);
      }
    } else {
      for (const pi of po.items) {
        if (!pi.productId) continue;
        pipelineRawAgg[pi.productId] = (pipelineRawAgg[pi.productId] ?? 0) + pi.quantity;
      }
    }
  }

  const purchaseItems = await prisma.purchaseItem.findMany({ select: { productId: true, quantity: true } });
  const purchaseAgg: Record<string, number> = {};
  for (const pi of purchaseItems) {
    if (!pi.productId) continue;
    purchaseAgg[pi.productId] = (purchaseAgg[pi.productId] ?? 0) + pi.quantity;
  }

  const productionItems = await prisma.productionItem.findMany({ select: { productId: true, actualQty: true, plannedQty: true } });
  const productionAgg: Record<string, number> = {};
  for (const pi of productionItems) productionAgg[pi.productId] = (productionAgg[pi.productId] ?? 0) + (pi.actualQty ?? pi.plannedQty ?? 0);

  // Active production: pending or in_production (not yet done/cancelled)
  const activeProductionItems = await prisma.productionItem.findMany({
    where: { productionOrder: { status: { in: ["pending", "in_production"] } } },
    select: {
      productId: true,
      plannedQty: true,
      actualQty: true,
      productionOrder: { select: { status: true } },
    },
  });
  const inProductionAgg: Record<string, number> = {};
  const pendingProductionAgg: Record<string, number> = {};
  for (const pi of activeProductionItems) {
    const qty = pi.actualQty ?? pi.plannedQty ?? 0;
    if (pi.productionOrder.status === "in_production") {
      inProductionAgg[pi.productId] = (inProductionAgg[pi.productId] ?? 0) + qty;
    } else {
      pendingProductionAgg[pi.productId] = (pendingProductionAgg[pi.productId] ?? 0) + qty;
    }
  }

  // ── Linked purchase orders (non-cancelled) + payments ────────────────────────
  const allGroupIds   = allGroups.map(g => g.id);
  const allProductIds = products.map(p => p.id);

  const linkedPOs = await prisma.purchaseOrder.findMany({
    where: {
      status: { notIn: ["cancelled"] },
      OR: [
        { items: { some: { groupId:   { in: allGroupIds   } } } },
        { items: { some: { productId: { in: allProductIds } } } },
      ],
    },
    select: {
      id: true, status: true, totalVnd: true, createdAt: true,
      supplier: { select: { name: true } },
      payments: { select: { direction: true, amount: true } },
      items: {
        select: {
          groupId: true, productId: true, quantity: true,
          group: { select: { costUnit: true } },
        },
      },
      productionOrder: {
        select: {
          status: true,
          // include productId so we can filter per-product produced packs
          items: { select: { productId: true, actualQty: true, plannedQty: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // Build map: groupKey → LinkedPurchaseInfo[]
  const pOsByGroupKey = new Map<string, LinkedPurchaseInfo[]>();
  for (const po of linkedPOs) {
    // Payment sums
    const paidToSupplier      = po.payments.filter(p => p.direction === "to_supplier").reduce((s, p) => s + p.amount, 0);
    const receivedFromCustomer = po.payments.filter(p => p.direction === "from_customer").reduce((s, p) => s + p.amount, 0);

    // Aggregate qty per group/product key
    const keyQty: Record<string, { qty: number; unit: string | null }> = {};
    for (const item of po.items) {
      const key = item.groupId ?? item.productId ?? null;
      if (!key) continue;
      if (!keyQty[key]) keyQty[key] = { qty: 0, unit: item.group?.costUnit ?? null };
      keyQty[key].qty += item.quantity;
    }

    const allGroupIdSet = new Set(allGroupIds);

    for (const [key, { qty, unit }] of Object.entries(keyQty)) {
      // producedPacks: filter by productId if key is a productId;
      // if key is a groupId, sum all production items in the PO.
      let producedPacks = 0;
      if (po.productionOrder) {
        const isGroupKey = allGroupIdSet.has(key);
        producedPacks = isGroupKey
          ? po.productionOrder.items.reduce((s, pi) => s + (pi.actualQty ?? pi.plannedQty ?? 0), 0)
          : po.productionOrder.items
              .filter(pi => pi.productId === key)
              .reduce((s, pi) => s + (pi.actualQty ?? pi.plannedQty ?? 0), 0);
      }

      if (!pOsByGroupKey.has(key)) pOsByGroupKey.set(key, []);
      pOsByGroupKey.get(key)!.push({
        id: po.id,
        status: po.status,
        supplierName:            po.supplier?.name ?? null,
        totalVnd:                po.totalVnd,
        paidToSupplierVnd:       Math.round(paidToSupplier),
        receivedFromCustomerVnd: Math.round(receivedFromCustomer),
        rawQty: qty,
        rawUnit: unit,
        producedPacks,
        productionStatus: po.productionOrder?.status ?? null,
        createdAt: po.createdAt.toISOString(),
      });
    }
  }

  function getLinkedPurchases(groupKey: string, variants: { product: typeof products[0] | null }[]): LinkedPurchaseInfo[] {
    let pos = pOsByGroupKey.get(groupKey) ?? [];
    if (pos.length === 0) {
      const seen = new Set<string>();
      for (const gv of variants) {
        if (!gv.product?.id) continue;
        for (const p of (pOsByGroupKey.get(gv.product.id) ?? [])) {
          if (!seen.has(p.id)) { seen.add(p.id); pos = [...pos, p]; }
        }
      }
    }
    return pos.slice(0, 5);
  }

  // 5. Aggregate sales by product.id (or raw SKU if unmapped)
  interface SkuAgg {
    title: string;
    totalSold: number;
    numOrders: number;
    revenueUsd: number;
    firstSale: Date;
    lastSale: Date;
    soldByMonth: Record<string, number>;
    revByMonth:  Record<string, number>;
  }
  const skuAgg: Record<string, SkuAgg> = {};

  let shopifyTotalRevenue = 0;
  for (const o of orders) {
    try {
      const items: LineItem[] = JSON.parse(o.lineItemsJson);
      const orderDate = new Date(o.createdAtShopify);
      const monthKey = `${orderDate.getFullYear()}-${String(orderDate.getMonth() + 1).padStart(2, "0")}`;

      for (const item of items) {
        const rawSku = item.sku?.trim();
        if (!rawSku) continue;
        const mappedProduct = productBySku[rawSku];
        const aggKey = mappedProduct ? mappedProduct.id : `__unmapped__${rawSku}`;
        const qty   = Number(item.quantity ?? 0);
        const price = parseFloat(item.price ?? "0");
        const rev   = qty * price;
        shopifyTotalRevenue += rev;

        if (!skuAgg[aggKey]) {
          skuAgg[aggKey] = {
            title: mappedProduct?.name ?? item.title ?? rawSku,
            totalSold: 0, numOrders: 0, revenueUsd: 0,
            firstSale: orderDate, lastSale: orderDate,
            soldByMonth: {}, revByMonth: {},
          };
        }
        const agg = skuAgg[aggKey];
        agg.totalSold    += qty;
        agg.numOrders    += 1;
        agg.revenueUsd   += rev;
        agg.soldByMonth[monthKey] = (agg.soldByMonth[monthKey] ?? 0) + qty;
        agg.revByMonth[monthKey]  = (agg.revByMonth[monthKey]  ?? 0) + rev;
        if (orderDate < agg.firstSale) agg.firstSale = orderDate;
        if (orderDate > agg.lastSale)  agg.lastSale  = orderDate;
      }
    } catch { /* malformed */ }
  }

  const now = new Date();
  const oldest = orders[0]?.createdAtShopify ?? now;
  const newest = orders[orders.length - 1]?.createdAtShopify ?? now;
  const periodDays = Math.max(1, Math.round((now.getTime() - new Date(oldest).getTime()) / 86400000));

  // ── 6. Group by ProductGroup ──────────────────────────────────────────────
  interface GroupVariant {
    aggKey: string;
    agg: SkuAgg;
    product: typeof products[0] | null;
    isUnmapped: boolean;
    sku: string;
  }
  interface GroupAccum {
    id: string;
    groupId: string | null;
    name: string;
    variants: GroupVariant[];
    mergedSoldByMonth: Record<string, number>;
    mergedRevByMonth:  Record<string, number>;
    firstSale: Date;
    lastSale: Date;
  }

  const groupAccumMap = new Map<string, GroupAccum>();

  for (const [aggKey, agg] of Object.entries(skuAgg)) {
    const isUnmapped = aggKey.startsWith('__unmapped__');
    const product = isUnmapped ? null : (products.find(p => p.id === aggKey) ?? null);
    const groupId = product?.groupId ?? null;
    const sku = isUnmapped
      ? aggKey.replace('__unmapped__', '')
      : (product?.skuShopify?.split(',')[0].trim() ?? aggKey);

    // Group key: groupId if available (merges variants of same product family),
    // else aggKey (each ungrouped product/unmapped SKU is its own entry)
    const groupKey = groupId ?? aggKey;

    if (!groupAccumMap.has(groupKey)) {
      const groupRecord = groupId ? (groupById.get(groupId) ?? null) : null;
      const name = groupRecord?.name ?? product?.nameVi ?? product?.name ?? agg.title;
      groupAccumMap.set(groupKey, {
        id: groupKey, groupId, name,
        variants: [],
        mergedSoldByMonth: {},
        mergedRevByMonth:  {},
        firstSale: agg.firstSale,
        lastSale:  agg.lastSale,
      });
    }

    const ga = groupAccumMap.get(groupKey)!;
    ga.variants.push({ aggKey, agg, product, isUnmapped, sku });

    for (const [month, qty] of Object.entries(agg.soldByMonth)) {
      ga.mergedSoldByMonth[month] = (ga.mergedSoldByMonth[month] ?? 0) + qty;
    }
    for (const [month, rev] of Object.entries(agg.revByMonth)) {
      ga.mergedRevByMonth[month] = (ga.mergedRevByMonth[month] ?? 0) + rev;
    }
    if (agg.firstSale < ga.firstSale) ga.firstSale = agg.firstSale;
    if (agg.lastSale  > ga.lastSale)  ga.lastSale  = agg.lastSale;
  }

  // ── 6b. Add products with stock OR production data but NO Shopify sales ──
  // These products have nhungQty, Bros stock, or production items but never appeared in any order.
  // Without this pass they'd be invisible — and group-level totalProducedPacks would show 0
  // even when production items correctly reference them.
  const coveredProductIds = new Set<string>();
  for (const ga of groupAccumMap.values()) {
    for (const gv of ga.variants) { if (gv.product?.id) coveredProductIds.add(gv.product.id); }
  }

  for (const product of products) {
    if (coveredProductIds.has(product.id)) continue;   // already covered by order data

    const nhungQty   = product.nhungQty ?? 0;
    const brosQtyChk = getBrosQty(product);
    const hasProductionData =
      (productionAgg[product.id]        ?? 0) > 0 ||
      (inProductionAgg[product.id]      ?? 0) > 0 ||
      (pendingProductionAgg[product.id] ?? 0) > 0;
    // skip only if truly nothing to show
    if (nhungQty <= 0 && brosQtyChk <= 0 && !hasProductionData) continue;

    const groupId = product.groupId ?? null;
    const groupKey = groupId ?? product.id;
    const groupRecord = groupId ? (groupById.get(groupId) ?? null) : null;
    const name = groupRecord?.name ?? product.nameVi ?? product.name ?? "Unknown";
    const sku  = product.skuShopify?.split(',')[0].trim() ?? "";

    const fakeAgg: SkuAgg = {
      title: product.name,
      totalSold: 0, numOrders: 0, revenueUsd: 0,
      firstSale: now, lastSale: now,
      soldByMonth: {}, revByMonth: {},
    };

    if (!groupAccumMap.has(groupKey)) {
      groupAccumMap.set(groupKey, {
        id: groupKey, groupId, name,
        variants: [],
        mergedSoldByMonth: {}, mergedRevByMonth: {},
        firstSale: now, lastSale: now,
      });
    }
    groupAccumMap.get(groupKey)!.variants.push({ aggKey: product.id, agg: fakeAgg, product, isUnmapped: false, sku });
  }

  // ── 7. Build GroupedRestockItem list ─────────────────────────────────────
  const urgencyOrder: Record<RestockItem["urgency"], number> = {
    critical: 0, warning: 1, healthy: 2, overstocked: 3, no_sales: 4, unmapped: 5,
  };

  const groupedItems: GroupedRestockItem[] = [];

  for (const ga of groupAccumMap.values()) {
    // ── Build variant RestockItems ──
    const variantItems: RestockItem[] = [];

    for (const gv of ga.variants) {
      const { agg, product, isUnmapped, sku } = gv;

      const nhungQty = product?.nhungQty ?? 0;
      // Bros stock is keyed by skuAmz (ASIN), then skuBros fallback — NOT by skuShopify
      const brosQty = getBrosQty(product, sku);
      const totalStock = nhungQty + brosQty;

      const pUnit    = product?.unit          ?? "gói";
      const pGrams   = product?.gramsPerUnit  ?? null;
      const pPcs     = product?.piecesPerUnit ?? null;
      const pPcsPack = product?.piecesPerPack ?? null;

      let pipelinePacks = product ? (pipelinePacksAgg[product.id] ?? 0) : 0;
      if (product && pipelineRawAgg[product.id]) {
        const rawQ = pipelineRawAgg[product.id];
        if (pGrams && (pUnit === "kg" || pUnit === "g")) {
          const grams = pUnit === "kg" ? rawQ * 1000 : rawQ;
          pipelinePacks += Math.floor(grams / pGrams);
        } else if (pPcs && pPcsPack && pPcsPack > 0) {
          pipelinePacks += Math.floor((rawQ * pPcs) / pPcsPack);
        } else {
          pipelinePacks += rawQ;
        }
      }

      const effectiveStock = totalStock + pipelinePacks;
      const daysTracked    = Math.max(1, Math.round((now.getTime() - agg.firstSale.getTime()) / 86400000));
      const soldPerDay     = agg.totalSold / daysTracked;
      const soldPerMonth   = soldPerDay * 30;

      const trendAnalysis = buildTrendAnalysis(agg.soldByMonth, agg.revByMonth, agg.firstSale, agg.lastSale, now);

      const recentSPD = trendAnalysis.recentVelocity / 30;
      const effectiveSPD = recentSPD > 0 ? recentSPD : soldPerDay;
      const daysLeftEff  = effectiveSPD > 0 ? Math.round(effectiveStock / effectiveSPD) : null;
      const monthsLeft   = daysLeftEff != null ? Math.round(daysLeftEff / 30 * 10) / 10 : null;

      let urgency: RestockItem["urgency"];
      if (isUnmapped)    urgency = "unmapped";
      else if (soldPerDay === 0)  urgency = "no_sales";
      else if (effectiveStock === 0 || (daysLeftEff != null && daysLeftEff <= 14)) urgency = "critical";
      else if (daysLeftEff != null && daysLeftEff <= 90)  urgency = "warning";
      else if (daysLeftEff != null && daysLeftEff > 365)  urgency = "overstocked";
      else urgency = "healthy";

      const packaging = buildPackagingInfo(product ?? { gramsPerUnit: null, piecesPerUnit: null, piecesPerPack: null, unit: "gói" });
      const productGroup = product?.groupId ? (groupById.get(product.groupId) ?? null) : null;
      const cost = buildCostInfo(product ?? { gramsPerUnit: null, piecesPerUnit: null, piecesPerPack: null }, productGroup as Parameters<typeof buildCostInfo>[1]);
      const restock = buildRecommendation(effectiveStock, trendAnalysis, daysLeftEff, urgency, packaging, cost, targetDays, leadDays);

      variantItems.push({
        sku, title: agg.title,
        productId: product?.id ?? null,
        groupId: product?.groupId ?? null,
        localName: product?.nameVi ?? product?.name ?? null,
        totalSold:    Math.round(agg.totalSold),
        numOrders:    agg.numOrders,
        revenueUsd:   Math.round(agg.revenueUsd * 100) / 100,
        firstSale:    agg.firstSale.toISOString(),
        lastSale:     agg.lastSale.toISOString(),
        daysTracked,
        soldPerMonth: Math.round(soldPerMonth   * 10) / 10,
        soldPerDay:   Math.round(soldPerDay     * 100) / 100,
        nhungQty, brosQty, totalStock, pipelinePacks, effectiveStock,
        daysLeft: daysLeftEff, monthsLeft,
        urgency, priceUsd: product?.priceUsd ?? null,
        totalPurchasedRaw:  product ? (purchaseAgg[product.id]   ?? 0) : 0,
        totalProducedPacks: product ? (productionAgg[product.id] ?? 0) : 0,
        inProductionPacks:     product ? (inProductionAgg[product.id]     ?? 0) : 0,
        pendingProductionPacks: product ? (pendingProductionAgg[product.id] ?? 0) : 0,
        trend: trendAnalysis, packaging, cost, restock,
      });
    }

    // ── Group-level aggregation ──
    const groupNhungQty   = variantItems.reduce((s, v) => s + v.nhungQty,      0);
    const groupBrosQty    = variantItems.reduce((s, v) => s + v.brosQty,       0);
    const groupTotalStock = groupNhungQty + groupBrosQty;
    const groupPipeline   = variantItems.reduce((s, v) => s + v.pipelinePacks, 0);
    const groupInProduction      = variantItems.reduce((s, v) => s + v.inProductionPacks, 0);
    const groupPendingProduction = variantItems.reduce((s, v) => s + v.pendingProductionPacks, 0);
    const groupTotalProduced     = variantItems.reduce((s, v) => s + v.totalProducedPacks, 0);
    const groupEffective  = groupTotalStock + groupPipeline;

    const groupTotalSold  = variantItems.reduce((s, v) => s + v.totalSold,   0);
    const groupRevenue    = variantItems.reduce((s, v) => s + v.revenueUsd,  0);
    const groupOrders     = variantItems.reduce((s, v) => s + v.numOrders,   0);
    const groupDaysTracked = Math.max(1, Math.round((now.getTime() - ga.firstSale.getTime()) / 86400000));

    // Combined trend using merged monthly sales data
    const combinedTrend = buildTrendAnalysis(
      ga.mergedSoldByMonth, ga.mergedRevByMonth, ga.firstSale, ga.lastSale, now
    );

    // Group daysLeft: combined stock vs combined velocity
    const groupVelocityPerDay = combinedTrend.recentVelocity / 30;
    const groupDaysLeft  = groupVelocityPerDay > 0 ? Math.round(groupEffective / groupVelocityPerDay) : null;
    const groupMonthsLeft = groupDaysLeft != null ? Math.round(groupDaysLeft / 30 * 10) / 10 : null;

    // Group urgency — based on COMBINED stock across all variants
    const hasAnySales  = variantItems.some(v => v.soldPerDay > 0);
    const allUnmapped  = variantItems.every(v => v.urgency === "unmapped");

    let groupUrgency: RestockItem["urgency"];
    if (allUnmapped) {
      groupUrgency = "unmapped";
    } else if (!hasAnySales) {
      groupUrgency = "no_sales";
    } else if (groupEffective === 0 || (groupDaysLeft != null && groupDaysLeft <= 14)) {
      groupUrgency = "critical";
    } else if (groupDaysLeft != null && groupDaysLeft <= 90) {
      groupUrgency = "warning";
    } else if (groupDaysLeft != null && groupDaysLeft > 365) {
      groupUrgency = "overstocked";
    } else {
      groupUrgency = "healthy";
    }

    // Cost from group record — compute costPerPack from primary variant packaging
    const groupRecord = ga.groupId ? (groupById.get(ga.groupId) ?? null) : null;
    let groupCost: CostInfo;
    if (groupRecord) {
      // Try to compute a representative costPerPack using the first variant with packaging
      const refVariant = variantItems.find(v => v.packaging.packagingFormula);
      const rawCost = buildCostInfo(
        refVariant?.packaging ?? { gramsPerUnit: null, piecesPerUnit: null, piecesPerPack: null },
        groupRecord
      );
      groupCost = rawCost;
    } else {
      groupCost = { groupName: null, baseCostVnd: null, costUnit: null, costPerPack: null };
    }

    // Packaging: use first variant with packaging data
    const primaryVariant = variantItems.find(v => v.packaging.packagingFormula) ?? variantItems[0];
    const groupPackaging = primaryVariant?.packaging ?? {
      gramsPerUnit: null, piecesPerUnit: null, piecesPerPack: null,
      unit: "gói", packsPerRawUnit: null, packagingFormula: null,
    };

    // Group-level recommendation uses combined metrics
    const groupRestock = buildRecommendation(
      groupEffective, combinedTrend, groupDaysLeft, groupUrgency,
      groupPackaging, groupCost, targetDays, leadDays
    );

    const variantsWithStock = variantItems
      .filter(v => v.effectiveStock > 0)
      .map(v => v.localName ?? v.title);

    // Total suggested packs/cost across ALL variants that need restocking
    const totalSuggestedPacks = variantItems.reduce((s, v) => s + v.restock.suggestedPacks, 0);
    const hasAnyCost = variantItems.some(v => v.restock.estimatedCostVnd != null);
    const totalEstimatedCostVnd = hasAnyCost
      ? variantItems.reduce((s, v) => s + (v.restock.estimatedCostVnd ?? 0), 0)
      : null;

    groupedItems.push({
      id: ga.id,
      groupId: ga.groupId,
      name: ga.name,
      totalSold: Math.round(groupTotalSold),
      revenueUsd: Math.round(groupRevenue * 100) / 100,
      numOrders: groupOrders,
      nhungQty: groupNhungQty,
      brosQty: groupBrosQty,
      totalStock: groupTotalStock,
      pipelinePacks: groupPipeline,
      effectiveStock: groupEffective,
      inProductionPacks: groupInProduction,
      pendingProductionPacks: groupPendingProduction,
      totalProducedPacks: groupTotalProduced,
      hasAnyStock: groupEffective > 0,
      variantsWithStock,
      firstSale: ga.firstSale.toISOString(),
      lastSale:  ga.lastSale.toISOString(),
      daysTracked: groupDaysTracked,
      soldPerMonth: Math.round(combinedTrend.recentVelocity * 10) / 10,
      daysLeft:  groupDaysLeft,
      monthsLeft: groupMonthsLeft,
      urgency: groupUrgency,
      trend: combinedTrend,
      cost: groupCost,
      totalSuggestedPacks,
      totalEstimatedCostVnd,
      restock: groupRestock,
      variants: variantItems,
      linkedPurchases: getLinkedPurchases(ga.groupId ?? ga.id, ga.variants),
    });
  }

  // Sort: by group urgency then by combined velocity desc
  groupedItems.sort((a, b) => {
    const uo = urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
    return uo !== 0 ? uo : b.trend.recentVelocity - a.trend.recentVelocity;
  });

  // ── 8. Shopping list ──────────────────────────────────────────────────────
  // Include ANY variant that is critical or warning, even if the GROUP is "healthy"
  // (e.g. one size is out of stock while other sizes have surplus — variant still needs production)
  const shoppingMap = new Map<string, ShoppingListGroup>();

  for (const group of groupedItems) {
    const needingVariants = group.variants.filter(
      v => (v.urgency === "critical" || v.urgency === "warning") && v.restock.suggestedPacks > 0
    );
    if (needingVariants.length === 0) continue;

    const groupKey = group.cost.groupName ?? group.name;
    if (!shoppingMap.has(groupKey)) {
      shoppingMap.set(groupKey, {
        groupName: group.cost.groupName ?? group.name,
        groupId: group.groupId,
        items: [],
        totalRawAmount: null,
        rawUnit: needingVariants[0]?.restock.suggestedRawUnit ?? null,
        totalCostVnd: null,
      });
    }
    const sg = shoppingMap.get(groupKey)!;

    for (const v of needingVariants) {
      sg.items.push({
        sku: v.sku, localName: v.localName ?? v.sku,
        urgency: v.urgency,
        suggestedPacks: v.restock.suggestedPacks,
        suggestedRawAmount: v.restock.suggestedRawAmount,
        suggestedRawUnit:   v.restock.suggestedRawUnit,
        estimatedCostVnd:   v.restock.estimatedCostVnd,
        packagingFormula:   v.packaging.packagingFormula,
        trend: v.trend.trend,
        forecastNext3M: v.trend.forecastNext3M,
        totalStock: v.totalStock,
        pipelinePacks: v.pipelinePacks,
        totalProducedPacks: v.totalProducedPacks,
        totalPurchasedRaw:  v.totalPurchasedRaw,
        daysLeft: v.daysLeft,
      });
      if (v.restock.suggestedRawAmount != null && sg.rawUnit === v.restock.suggestedRawUnit) {
        sg.totalRawAmount = (sg.totalRawAmount ?? 0) + v.restock.suggestedRawAmount;
      }
      if (v.restock.estimatedCostVnd != null) {
        sg.totalCostVnd = (sg.totalCostVnd ?? 0) + v.restock.estimatedCostVnd;
      }
    }
  }
  for (const sg of Array.from(shoppingMap.values())) {
    if (sg.totalRawAmount != null) sg.totalRawAmount = Math.ceil(sg.totalRawAmount * 10) / 10;
  }

  const critWarn = groupedItems.filter(i => i.urgency === "critical" || i.urgency === "warning");
  const summary: RestockSummary = {
    totalOrders: orders.length,
    totalRevenueUsd: Math.round(shopifyTotalRevenue * 100) / 100,
    periodDays,
    ordersPerDay: Math.round((orders.length / periodDays) * 10) / 10,
    revenuePerDay: Math.round((shopifyTotalRevenue / periodDays) * 100) / 100,
    oldestOrder: new Date(oldest).toISOString(),
    newestOrder: new Date(newest).toISOString(),
    totalRestockCostVnd: Math.round(critWarn.reduce((s, i) => s + (i.totalEstimatedCostVnd ?? 0), 0)),
    totalRestockPacks:   critWarn.reduce((s, i) => s + i.totalSuggestedPacks, 0),
  };

  return Response.json({
    summary,
    items: groupedItems,
    shoppingList: Array.from(shoppingMap.values()),
    targetDays,
    leadDays,
    generatedAt: now.toISOString(),
  } satisfies RestockResponse);
  } catch (err) {
    console.error("[GET /api/analytics/restock] Error:", err);
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
