"use client";
import { useEffect, useState, useMemo, useCallback } from "react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import {
  RefreshCw, AlertTriangle, Package, Search,
  ShoppingCart, DollarSign, BarChart3, Clock, ArrowUpRight,
  ChevronDown, ChevronUp, TrendingUp, TrendingDown,
  Truck, Box, ListChecks, Calculator, Minus, DatabaseZap,
  Layers, Factory,
} from "lucide-react";
import type {
  GroupedRestockItem, RestockItem, RestockResponse, RestockSummary,
  ShoppingListGroup, MonthlyData, TrendAnalysis, LinkedPurchaseInfo,
} from "@/app/api/analytics/restock/route";

// ── Config ───────────────────────────────────────────────────────────────────

type UrgencyTab = "all" | "critical" | "warning" | "healthy" | "overstocked" | "unmapped";

const URGENCY = {
  critical:    { label: "Cần nhập gấp",  color: "text-red-700",    bg: "bg-red-50",    border: "border-red-200",    dot: "bg-red-500",    row: "bg-red-50/30"    },
  warning:     { label: "Theo dõi",      color: "text-amber-700",  bg: "bg-amber-50",  border: "border-amber-200",  dot: "bg-amber-500",  row: "bg-amber-50/15"  },
  healthy:     { label: "Ổn định",       color: "text-green-700",  bg: "bg-green-50",  border: "border-green-200",  dot: "bg-green-500",  row: ""                },
  overstocked: { label: "Đang thừa",     color: "text-blue-700",   bg: "bg-blue-50",   border: "border-blue-200",   dot: "bg-blue-500",   row: ""                },
  no_sales:    { label: "Chưa bán",      color: "text-gray-500",   bg: "bg-gray-50",   border: "border-gray-200",   dot: "bg-gray-300",   row: ""                },
  unmapped:    { label: "Chưa có mã",    color: "text-purple-700", bg: "bg-purple-50", border: "border-purple-200", dot: "bg-purple-500", row: "opacity-75"      },
} as const;

const TARGET_OPTIONS = [
  { days: 30,  label: "30 ngày" },
  { days: 60,  label: "60 ngày" },
  { days: 90,  label: "90 ngày", recommend: true },
  { days: 180, label: "180 ngày" },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) { return n.toLocaleString("vi-VN"); }
function fmtM(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(0)}K`;
  return n.toString();
}
function fmtRaw(n: number | null, unit: string | null) {
  if (n == null) return null;
  const s = n % 1 === 0 ? n.toFixed(0) : n.toFixed(1);
  return `${s} ${unit ?? ""}`.trim();
}

// ── Mini bar chart ────────────────────────────────────────────────────────────

function MonthlyChart({ months }: { months: MonthlyData[] }) {
  if (!months.length) return null;
  const maxVal = Math.max(...months.map(m => m.soldPer30Days), 1);
  return (
    <div className="flex items-end gap-1 h-14" title="Tốc độ bán quy đổi 30 ngày theo từng tháng">
      {months.map(m => {
        const pct = (m.soldPer30Days / maxVal) * 100;
        const isPartial = m.activeDays < 25;
        return (
          <div key={m.month} className="flex flex-col items-center gap-0.5 flex-1 min-w-[18px] max-w-[32px]">
            <span className="text-[8px] text-gray-400 leading-none">
              {m.soldPer30Days >= 10 ? Math.round(m.soldPer30Days) : m.soldPer30Days.toFixed(1)}
            </span>
            <div className="w-full">
              <div
                className={`w-full rounded-t transition-all ${isPartial ? "opacity-50" : ""} ${
                  pct > 80 ? "bg-indigo-500" : pct > 40 ? "bg-indigo-400" : "bg-indigo-200"
                }`}
                style={{ height: `${Math.max(3, (pct / 100) * 36)}px` }}
                title={`${m.label}: ${m.sold} gói (${m.soldPer30Days.toFixed(1)}/30 ngày)${isPartial ? " *partial" : ""}`}
              />
            </div>
            <span className="text-[8px] text-gray-400 leading-none truncate w-full text-center">{m.label}</span>
          </div>
        );
      })}
    </div>
  );
}

// ── Trend badge ───────────────────────────────────────────────────────────────

function TrendBadge({ t }: { t: TrendAnalysis }) {
  if (t.trend === "new") return (
    <span className="text-[10px] text-gray-400 bg-gray-50 border border-gray-200 rounded px-1.5 py-0.5">Mới</span>
  );
  if (t.trend === "growing") return (
    <span className="flex items-center gap-0.5 text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-1.5 py-0.5">
      <TrendingUp className="h-2.5 w-2.5" /> +{t.momChangePct}%/tháng
    </span>
  );
  if (t.trend === "declining") return (
    <span className="flex items-center gap-0.5 text-[10px] text-red-600 bg-red-50 border border-red-200 rounded px-1.5 py-0.5">
      <TrendingDown className="h-2.5 w-2.5" /> {t.momChangePct}%/tháng
    </span>
  );
  return (
    <span className="flex items-center gap-0.5 text-[10px] text-gray-500 bg-gray-50 border border-gray-200 rounded px-1.5 py-0.5">
      <Minus className="h-2.5 w-2.5" /> Ổn định
    </span>
  );
}

// ── Purchase status helpers ───────────────────────────────────────────────────

const PO_STATUS: Record<string, { label: string; color: string }> = {
  draft:      { label: "Nháp",       color: "bg-gray-100 text-gray-600" },
  confirmed:  { label: "Đã xác nhận", color: "bg-blue-100 text-blue-700" },
  in_transit: { label: "Đang về",    color: "bg-amber-100 text-amber-700" },
  packing:    { label: "Đang đóng",  color: "bg-orange-100 text-orange-700" },
  arrived:    { label: "Đã về",      color: "bg-green-100 text-green-700" },
  done:       { label: "Hoàn tất",   color: "bg-emerald-100 text-emerald-700" },
};

function PurchaseStatusCell({ purchases }: { purchases: LinkedPurchaseInfo[] }) {
  if (!purchases.length) return <span className="text-gray-300 text-xs">—</span>;
  const latest = purchases[0];
  const cfg = PO_STATUS[latest.status] ?? { label: latest.status, color: "bg-gray-100 text-gray-600" };
  // Total paidToSupplier across all linked POs
  const totalPaid = purchases.reduce((s, p) => s + p.paidToSupplierVnd, 0);
  const totalReceived = purchases.reduce((s, p) => s + p.receivedFromCustomerVnd, 0);
  return (
    <div className="space-y-0.5">
      <Link href={`/purchases/${latest.id}`}
        className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-semibold ${cfg.color} hover:opacity-80`}
        onClick={e => e.stopPropagation()}>
        {cfg.label}
      </Link>
      {totalReceived > 0 && (
        <p className="text-[10px] text-emerald-700 font-medium">↓ nhận: {fmtM(totalReceived)} ₫</p>
      )}
      {totalPaid > 0 && (
        <p className="text-[10px] text-orange-600">↑ trả: {fmtM(totalPaid)} ₫</p>
      )}
      {latest.rawQty > 0 && (
        <p className="text-[10px] text-gray-500">{latest.rawQty} {latest.rawUnit ?? "đv"} NL</p>
      )}
      {purchases.length > 1 && (
        <p className="text-[10px] text-gray-400">+{purchases.length - 1} đơn khác</p>
      )}
    </div>
  );
}

// ── Forecast row ──────────────────────────────────────────────────────────────

function ForecastRow({ t }: { t: TrendAnalysis }) {
  return (
    <div className="flex items-center gap-6 flex-wrap text-xs">
      <div>
        <span className="text-gray-400">Gần đây (60 ngày): </span>
        <span className="font-semibold text-indigo-700">{t.recentVelocity} gói/tháng</span>
      </div>
      <div>
        <span className="text-gray-400">Dự báo tháng tới: </span>
        <span className={`font-semibold ${t.forecastNext1M > t.recentVelocity ? "text-emerald-700" : t.forecastNext1M < t.recentVelocity ? "text-red-600" : "text-gray-700"}`}>
          {t.forecastNext1M} gói
        </span>
      </div>
      <div>
        <span className="text-gray-400">Dự báo 3 tháng: </span>
        <span className="font-semibold text-gray-700">{t.forecastNext3M} gói</span>
      </div>
      <div>
        <span className="text-gray-400">Dự báo 6 tháng: </span>
        <span className="font-semibold text-gray-500">{t.forecastNext6M} gói</span>
      </div>
    </div>
  );
}

// ── Variant sub-row (inside detail panel) ────────────────────────────────────

function VariantRow({ v }: { v: RestockItem }) {
  const cfg = URGENCY[v.urgency];
  return (
    <tr className="border-b border-gray-100 last:border-0 hover:bg-gray-50/40">
      <td className="px-3 py-2">
        <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border font-semibold ${cfg.bg} ${cfg.color} ${cfg.border}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
          {cfg.label}
        </span>
      </td>
      <td className="px-3 py-2">
        <p className="text-sm font-medium text-gray-800">{v.localName ?? v.title}</p>
        <p className="text-[10px] font-mono text-gray-400 mt-0.5">{v.sku}</p>
        <p className="text-[10px] text-gray-500 mt-0.5">
          <span className="font-semibold text-gray-700">{v.totalSold}</span> gói đã bán
          <span className="text-gray-400 ml-1.5">({v.numOrders} đơn)</span>
        </p>
      </td>
      <td className="px-3 py-2 text-right">
        <span className={`text-sm font-bold tabular-nums ${v.totalStock === 0 ? "text-red-500" : "text-gray-700"}`}>
          {v.totalStock}
        </span>
        {v.pipelinePacks > 0 && (
          <span className="text-[10px] text-indigo-500 ml-1 font-medium">+{v.pipelinePacks}</span>
        )}
      </td>
      <td className="px-3 py-2 text-right">
        {(v.inProductionPacks > 0 || v.pendingProductionPacks > 0) ? (
          <div className="text-right">
            {v.inProductionPacks > 0 && (
              <span className="text-emerald-700 font-semibold text-xs block">{v.inProductionPacks} đang SX</span>
            )}
            {v.pendingProductionPacks > 0 && (
              <span className="text-indigo-600 text-[10px] block">{v.pendingProductionPacks} chờ SX</span>
            )}
          </div>
        ) : (
          <span className="text-gray-300 text-xs">—</span>
        )}
      </td>
      <td className="px-3 py-2 text-right text-sm text-indigo-600 font-medium tabular-nums">
        {v.trend.recentVelocity}/th
      </td>
      <td className="px-3 py-2 text-right text-sm">
        {v.daysLeft == null ? (
          <span className="text-gray-400">—</span>
        ) : v.daysLeft < 30 ? (
          <span className="text-red-600 font-semibold">{v.daysLeft} ngày</span>
        ) : (
          <span className="text-gray-600">{(v.daysLeft / 30).toFixed(1)} tháng</span>
        )}
      </td>
      <td className="px-3 py-2 text-right">
        {v.restock.suggestedPacks > 0 ? (
          <span className="text-emerald-700 font-semibold text-sm">
            {v.restock.suggestedRawAmount != null
              ? fmtRaw(v.restock.suggestedRawAmount, v.restock.suggestedRawUnit)
              : `${v.restock.suggestedPacks} gói`}
          </span>
        ) : (
          <span className="text-gray-400 text-xs">—</span>
        )}
      </td>
      <td className="px-3 py-2 text-right">
        {v.restock.estimatedCostVnd != null ? (
          <span className="text-orange-600 text-xs font-medium">{fmtM(v.restock.estimatedCostVnd)} ₫</span>
        ) : <span className="text-gray-400 text-xs">—</span>}
      </td>
    </tr>
  );
}

// ── Detail panel ─────────────────────────────────────────────────────────────

function DetailPanel({ item }: { item: GroupedRestockItem }) {
  const { trend, cost, restock, variants } = item;
  const multiVariant = variants.length > 1;
  const primaryVariant = variants.find(v => v.packaging.packagingFormula) ?? variants[0];

  return (
    <div className="px-5 pb-5 space-y-4 bg-gray-50/50 border-t border-gray-100">
      {/* Combined trend chart */}
      <div className="pt-3">
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">
          {multiVariant
            ? `Lịch sử bán hàng tổng hợp nhóm · ${variants.length} mã SKU · ${trend.numMonths} tháng`
            : `Lịch sử bán hàng · ${trend.numMonths} tháng dữ liệu`}
        </p>
        <MonthlyChart months={trend.months} />
        <div className="mt-2"><ForecastRow t={trend} /></div>
      </div>

      {/* Variant breakdown table (only when multiple variants) */}
      {multiVariant && (
        <div>
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">
            Chi tiết từng mã SKU ({variants.length} mã)
          </p>
          {item.hasAnyStock && (
            <div className="mb-2 flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
              <Package className="h-3.5 w-3.5 shrink-0" />
              <span>
                <strong>Đang có hàng:</strong>{" "}
                {item.variantsWithStock.join(", ")} — tổng nhóm còn{" "}
                <strong>{item.effectiveStock} gói</strong> (tồn: {item.totalStock} + đang về: {item.pipelinePacks})
              </span>
            </div>
          )}
          <div className="rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full text-sm whitespace-nowrap">
              <thead className="bg-gray-100/80 text-[10px] text-gray-500 uppercase font-bold tracking-wider border-b border-gray-200">
                <tr>
                  <th className="px-3 py-2 text-left">Tình trạng</th>
                  <th className="px-3 py-2 text-left min-w-[160px]">Sản phẩm / SKU</th>
                  <th className="px-3 py-2 text-right">Tồn kho</th>
                  <th className="px-3 py-2 text-right text-emerald-600">Đang SX</th>
                  <th className="px-3 py-2 text-right">Tốc độ</th>
                  <th className="px-3 py-2 text-right">Còn dùng</th>
                  <th className="px-3 py-2 text-right text-emerald-700 bg-emerald-50/50">Cần mua</th>
                  <th className="px-3 py-2 text-right">Chi phí</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {variants.map(v => <VariantRow key={v.sku} v={v} />)}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Production status + link */}
      {(item.inProductionPacks > 0 || item.pendingProductionPacks > 0) && (
        <div className="flex items-center gap-3 rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3">
          <Factory className="h-4 w-4 text-emerald-600 shrink-0" />
          <div className="flex-1 text-sm">
            <span className="font-semibold text-emerald-800">Đang sản xuất: </span>
            {item.inProductionPacks > 0 && (
              <span className="text-emerald-700 font-bold">{item.inProductionPacks} gói đang SX</span>
            )}
            {item.inProductionPacks > 0 && item.pendingProductionPacks > 0 && <span className="text-gray-400 mx-1">·</span>}
            {item.pendingProductionPacks > 0 && (
              <span className="text-indigo-600 font-semibold">{item.pendingProductionPacks} gói chờ SX</span>
            )}
            <span className="text-emerald-600 ml-2 text-xs">(đã tính vào tồn kho hiệu dụng)</span>
          </div>
          <Link href="/production" className="text-xs text-emerald-700 border border-emerald-300 rounded px-2 py-1 hover:bg-emerald-100 transition-colors shrink-0 flex items-center gap-1">
            <Factory className="h-3 w-3" /> Xem sản xuất →
          </Link>
        </div>
      )}

      {/* 3-column: packaging / cost / recommendation */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Công thức đóng gói (primary variant) */}
        <div className="rounded-lg bg-indigo-50 border border-indigo-100 p-3">
          <p className="text-[10px] font-semibold text-indigo-500 uppercase tracking-wide mb-2 flex items-center gap-1">
            <Box className="h-3 w-3" /> Công thức đóng gói
          </p>
          {primaryVariant?.packaging.packagingFormula ? (
            <div className="space-y-1">
              <p className="text-sm font-semibold text-indigo-800">{primaryVariant.packaging.packagingFormula}</p>
              {primaryVariant.packaging.packsPerRawUnit && (
                <p className="text-xs text-indigo-500">
                  = {primaryVariant.packaging.packsPerRawUnit % 1 === 0
                      ? primaryVariant.packaging.packsPerRawUnit
                      : primaryVariant.packaging.packsPerRawUnit.toFixed(1)} gói / {primaryVariant.packaging.gramsPerUnit ? "kg" : primaryVariant.packaging.unit}
                </p>
              )}
              {multiVariant && variants.filter(v => v.packaging.packagingFormula && v.sku !== primaryVariant?.sku).map(v => (
                <p key={v.sku} className="text-[10px] text-indigo-400">{v.sku}: {v.packaging.packagingFormula}</p>
              ))}
            </div>
          ) : (
            <p className="text-xs text-indigo-400 italic">Chưa nhập thông tin đóng gói</p>
          )}
        </div>

        {/* Chi phí */}
        <div className="rounded-lg bg-orange-50 border border-orange-100 p-3">
          <p className="text-[10px] font-semibold text-orange-500 uppercase tracking-wide mb-2 flex items-center gap-1">
            <Calculator className="h-3 w-3" /> Chi phí nguyên liệu
          </p>
          {cost.baseCostVnd != null ? (
            <div className="space-y-1">
              <p className="text-sm font-semibold text-orange-800">{fmt(cost.baseCostVnd)} ₫/{cost.costUnit}</p>
              {primaryVariant?.cost.costPerPack != null && (
                <p className="text-xs text-orange-600 font-medium">→ {fmt(primaryVariant.cost.costPerPack)} ₫/gói</p>
              )}
            </div>
          ) : cost.groupName ? (
            <p className="text-xs text-orange-400 italic">Nhóm "{cost.groupName}" chưa có giá mua gốc</p>
          ) : (
            <p className="text-xs text-orange-400 italic">Chưa gán nhóm sản phẩm</p>
          )}
        </div>

        {/* Khuyến nghị tổng nhóm */}
        <div className={`rounded-lg border p-3 ${restock.suggestedPacks > 0 ? "bg-emerald-50 border-emerald-100" : "bg-gray-50 border-gray-100"}`}>
          <p className={`text-[10px] font-semibold uppercase tracking-wide mb-2 flex items-center gap-1 ${restock.suggestedPacks > 0 ? "text-emerald-600" : "text-gray-400"}`}>
            <ShoppingCart className="h-3 w-3" /> Khuyến nghị tổng nhóm
            {restock.basis === "trend" && (
              <span className="ml-1 text-[9px] bg-purple-100 text-purple-600 rounded px-1 py-0.5 normal-case font-medium">theo trend</span>
            )}
          </p>
          {restock.suggestedPacks > 0 ? (
            <div className="space-y-1">
              {restock.suggestedRawAmount != null ? (
                <>
                  <p className="text-base font-bold text-emerald-800">
                    {fmtRaw(restock.suggestedRawAmount, restock.suggestedRawUnit)}
                  </p>
                  <p className="text-xs text-emerald-600">→ đóng ~{restock.suggestedPacks} gói</p>
                </>
              ) : (
                <p className="text-base font-bold text-emerald-800">{restock.suggestedPacks} gói</p>
              )}
              {item.totalEstimatedCostVnd != null && (
                <p className="text-xs text-orange-700 font-medium">Chi phí: {fmt(Math.round(item.totalEstimatedCostVnd))} ₫</p>
              )}
              <p className="text-[10px] text-emerald-500 mt-1">Đủ dùng thêm ~{restock.targetDays} ngày</p>
            </div>
          ) : (
            <p className="text-xs text-gray-400 italic">{restock.recommendation}</p>
          )}
        </div>
      </div>

      {/* Link to production page */}
      <div className="flex justify-end">
        <Link
          href="/production"
          className="inline-flex items-center gap-1.5 text-xs text-gray-500 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-100 hover:text-gray-700 transition-colors"
        >
          <Factory className="h-3 w-3" />
          Xem tất cả đơn sản xuất →
        </Link>
      </div>
    </div>
  );
}

// ── Shopping list card ────────────────────────────────────────────────────────

function ShoppingListCard({ list }: { list: ShoppingListGroup[] }) {
  const [collapsed, setCollapsed] = useState(false);
  if (!list.length) return null;
  const totalCost  = list.reduce((s, g) => s + (g.totalCostVnd ?? 0), 0);
  const totalPacks = list.reduce((s, g) => s + g.items.reduce((acc, i) => acc + i.suggestedPacks, 0), 0);

  return (
    <div className="rounded-xl shadow-sm border border-emerald-200 bg-white overflow-hidden mb-6">
      <button
        className="w-full relative overflow-hidden flex items-center justify-between px-6 py-5 bg-gradient-to-r from-emerald-50 via-teal-50/50 to-white hover:bg-emerald-100/50 transition-all border-b border-emerald-100"
        onClick={() => setCollapsed(c => !c)}
      >
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-500" />
        <div className="flex items-center gap-4">
          <div className="rounded-full bg-emerald-100 p-2.5 shadow-sm">
            <ListChecks className="h-5 w-5 text-emerald-700" />
          </div>
          <div className="text-left">
            <p className="font-bold text-lg text-emerald-900">Danh Sách Cần Mua (Shopping List)</p>
            <p className="text-sm text-emerald-600/80 font-medium mt-0.5">
              <span className="text-emerald-700 font-bold">{list.length}</span> nhóm NL thô ·{" "}
              <span className="text-emerald-700 font-bold">{totalPacks.toLocaleString()}</span> gói cần mua/đóng
            </p>
          </div>
        </div>
        <div className="flex items-center gap-6">
          {totalCost > 0 && (
            <div className="text-right">
              <p className="text-[11px] font-bold text-emerald-600/70 uppercase tracking-widest mb-1">TỔNG CHI PHÍ ƯỚC TÍNH</p>
              <p className="text-2xl font-black text-orange-600 tracking-tight drop-shadow-sm">{totalCost >= 1_000_000 ? fmtM(totalCost) : fmt(totalCost)} ₫</p>
            </div>
          )}
          <div className="bg-white rounded-full p-1.5 shadow-sm border border-gray-100">
            {collapsed ? <ChevronDown className="h-5 w-5 text-emerald-600" /> : <ChevronUp className="h-5 w-5 text-emerald-600" />}
          </div>
        </div>
      </button>

      {!collapsed && (
        <div className="divide-y divide-gray-100 bg-gray-50/40">
          {list.map((group) => (
            <div key={group.groupName} className="p-6 hover:bg-white transition-colors group">
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                <div className="flex-1 w-full overflow-x-auto">
                  <div className="flex items-center gap-3 mb-4">
                    <h3 className="text-base font-bold text-gray-900 group-hover:text-emerald-800 transition-colors uppercase tracking-wide">{group.groupName}</h3>
                    {group.totalRawAmount != null && group.rawUnit && (
                      <Badge variant="secondary" className="bg-emerald-100 text-emerald-800 font-bold px-3 py-1 border border-emerald-200 shadow-sm text-sm">
                        CẦN MUA: {fmtRaw(group.totalRawAmount, group.rawUnit)}
                      </Badge>
                    )}
                  </div>
                  <div className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm">
                    <table className="w-full text-sm text-left whitespace-nowrap">
                      <thead className="bg-gray-100/80 text-gray-600 uppercase text-[10px] font-bold tracking-wider border-b border-gray-200">
                        <tr>
                          <th className="px-4 py-3">Phân Loại</th>
                          <th className="px-4 py-3 min-w-[200px]">SKU / Sản Phẩm</th>
                          <th className="px-4 py-3 text-right">Tồn VN/US</th>
                          <th className="px-4 py-3 text-right text-indigo-700 bg-indigo-50/50">Hàng Đang Về</th>
                          <th className="px-4 py-3 text-right">Dự Báo (3T)</th>
                          <th className="px-4 py-3 text-right text-emerald-700 bg-emerald-50/50">Cần Đóng/Mua</th>
                          <th className="px-4 py-3 text-right">Chi Phí</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {group.items.map((it) => {
                          const cfg = URGENCY[it.urgency];
                          return (
                            <tr key={it.sku} className="hover:bg-gray-50/50 transition-colors">
                              <td className="px-4 py-3">
                                <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-bold border ${cfg.bg} ${cfg.color} ${cfg.border || "border-transparent"}`}>
                                  <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
                                  {cfg.label}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <div className="font-semibold text-gray-900 truncate max-w-[200px]">{it.localName}</div>
                                <div className="flex items-center gap-2 mt-1">
                                  <span className="text-[10px] text-gray-500 font-mono bg-gray-100 px-1.5 rounded">{it.sku}</span>
                                  {it.trend === "growing" && <span className="text-emerald-600 flex items-center gap-0.5 text-[10px] font-bold bg-emerald-50 px-1 rounded"><TrendingUp className="h-3 w-3" /> tăng</span>}
                                  {it.trend === "declining" && <span className="text-red-500 flex items-center gap-0.5 text-[10px] font-bold bg-red-50 px-1 rounded"><TrendingDown className="h-3 w-3" /> giảm</span>}
                                </div>
                              </td>
                              <td className="px-4 py-3 text-right font-medium text-gray-600">{it.totalStock != null ? fmt(it.totalStock) : "—"}</td>
                              <td className="px-4 py-3 text-right bg-indigo-50/20">
                                <div className="flex flex-col items-end">
                                  <span className="font-bold text-indigo-700">{it.pipelinePacks != null ? fmt(it.pipelinePacks) : "—"}</span>
                                  {(it.totalProducedPacks || it.totalPurchasedRaw) ? (
                                    <span className="text-[9px] text-indigo-500/80 font-medium">
                                      {it.totalProducedPacks ? `Đã SX: ${fmt(it.totalProducedPacks)} gói` : ""}
                                      {it.totalPurchasedRaw ? ` · Đã mua: ${fmt(it.totalPurchasedRaw)}` : ""}
                                    </span>
                                  ) : null}
                                </div>
                              </td>
                              <td className="px-4 py-3 text-right font-medium text-gray-600">{fmt(it.forecastNext3M)}</td>
                              <td className="px-4 py-3 text-right bg-emerald-50/20">
                                <span className="inline-flex items-center justify-center font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded min-w-[50px] border border-emerald-200">
                                  {it.suggestedPacks}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-right">
                                {it.estimatedCostVnd != null ? (
                                  <span className="font-semibold text-orange-600">{fmt(Math.round(it.estimatedCostVnd))} ₫</span>
                                ) : <span className="text-gray-400">—</span>}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
                {group.totalCostVnd != null && (
                  <div className="md:w-36 shrink-0 md:text-right md:border-l border-t md:border-t-0 border-gray-200 pt-4 md:pt-0 pl-0 md:pl-5 mt-4 md:mt-0 flex flex-row md:flex-col items-center md:items-end justify-between md:justify-center">
                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider bg-gray-100 px-2 py-1 rounded inline-block mb-2">Chi phí nhóm</p>
                    <p className="text-xl font-black text-orange-600 tabular-nums drop-shadow-sm">{fmt(Math.round(group.totalCostVnd))} ₫</p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function RestockPage() {
  const [data, setData]         = useState<RestockResponse | null>(null);
  const [loading, setLoading]   = useState(false);
  const [tab, setTab]           = useState<UrgencyTab>("all");
  const [search, setSearch]     = useState("");
  const [targetDays, setTargetDays] = useState(90);
  const [leadDays]              = useState(21);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [syncing, setSyncing]   = useState(false);
  const [syncResult, setSyncResult] = useState<{ total: number; created: number; oldestOrder: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/analytics/restock?targetDays=${targetDays}&leadDays=${leadDays}`);
      if (!res.ok) throw new Error("Lỗi tải dữ liệu");
      setData(await res.json());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Lỗi");
    } finally { setLoading(false); }
  }, [targetDays, leadDays]);

  useEffect(() => { load(); }, [load]);

  async function syncFullHistory() {
    setSyncing(true); setSyncResult(null);
    try {
      const res = await fetch("/api/sync/shopify/full-history", { method: "POST" });
      const d = await res.json();
      if (!res.ok) { toast.error(d.error ?? "Lỗi sync"); return; }
      setSyncResult(d);
      toast.success(`Đã đồng bộ ${d.total.toLocaleString()} đơn · ${d.created} đơn mới`);
      await load();
    } catch { toast.error("Lỗi kết nối"); }
    finally { setSyncing(false); }
  }

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = search.toLowerCase();
    return data.items.filter(item => {
      const matchSearch = !q ||
        item.name.toLowerCase().includes(q) ||
        (item.cost.groupName ?? "").toLowerCase().includes(q) ||
        item.variants.some(v =>
          v.sku.toLowerCase().includes(q) ||
          (v.localName ?? "").toLowerCase().includes(q) ||
          v.title.toLowerCase().includes(q)
        );
      return matchSearch && (tab === "all" || item.urgency === tab);
    });
  }, [data, tab, search]);

  const counts = useMemo(() => {
    if (!data) return {} as Record<string, number>;
    const c: Record<string, number> = { all: data.items.length };
    for (const i of data.items) c[i.urgency] = (c[i.urgency] ?? 0) + 1;
    return c;
  }, [data]);

  const summary: RestockSummary | null = data?.summary ?? null;

  const TABS: { key: UrgencyTab; label: string }[] = [
    { key: "all",         label: "Tất cả"       },
    { key: "critical",    label: "Cần nhập gấp"  },
    { key: "warning",     label: "Theo dõi"      },
    { key: "healthy",     label: "Ổn định"       },
    { key: "overstocked", label: "Đang thừa"     },
    { key: "unmapped",    label: "Chưa có mã"    },
  ];

  function toggleExpand(id: string) {
    setExpanded(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Phân tích tồn kho & kế hoạch mua</h1>
          <p className="text-sm text-gray-500">
            {data
              ? `${data.summary.periodDays} ngày dữ liệu · ${data.summary.totalOrders.toLocaleString()} đơn · từ ${new Date(data.summary.oldestOrder).toLocaleDateString("vi-VN")} · phân tích theo nhóm sản phẩm`
              : "Toàn bộ lịch sử store · phân tích theo nhóm sản phẩm · dự báo 3–6 tháng"}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {data && <p className="text-xs text-gray-400">{new Date(data.generatedAt).toLocaleString("vi-VN")}</p>}
          <Button size="sm" variant="outline" onClick={load} disabled={loading || syncing}>
            <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Làm mới
          </Button>
          <Button size="sm" onClick={syncing ? undefined : syncFullHistory} disabled={syncing || loading}
            className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5">
            <DatabaseZap className={`h-3.5 w-3.5 ${syncing ? "animate-pulse" : ""}`} />
            {syncing ? "Đang đồng bộ..." : "Đồng bộ toàn bộ lịch sử"}
          </Button>
        </div>
      </div>

      {/* ── Sync result banner ── */}
      {syncResult && (
        <div className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 flex items-center gap-3 text-sm">
          <DatabaseZap className="h-4 w-4 text-indigo-600 shrink-0" />
          <div className="text-indigo-800">
            <span className="font-semibold">Đã đồng bộ xong:</span>{" "}
            <span className="font-bold">{syncResult.total.toLocaleString()}</span> đơn ·{" "}
            <span className="font-bold text-emerald-700">{syncResult.created}</span> đơn mới ·{" "}
            từ {new Date(syncResult.oldestOrder).toLocaleDateString("vi-VN")}
          </div>
          <button onClick={() => setSyncResult(null)} className="ml-auto text-indigo-400 hover:text-indigo-600">✕</button>
        </div>
      )}

      {/* ── Target days ── */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1.5">
          <Clock className="h-4 w-4 text-gray-400" />
          <span className="text-sm text-gray-600 font-medium">Mục tiêu tồn kho:</span>
        </div>
        <div className="flex gap-1.5">
          {TARGET_OPTIONS.map(opt => (
            <button key={opt.days} onClick={() => setTargetDays(opt.days)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium border transition-all ${
                targetDays === opt.days ? "bg-green-600 text-white border-green-600" : "bg-white text-gray-600 border-gray-200 hover:border-green-300 hover:text-green-700"
              }`}>
              {opt.label}
              {opt.recommend && targetDays !== opt.days && <span className="ml-1 text-[10px] text-green-500">✓</span>}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5 text-xs text-gray-400">
          <Truck className="h-3.5 w-3.5" /> + {leadDays} ngày vận chuyển VN→US
        </div>
      </div>

      {/* ── Summary cards ── */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <ShoppingCart className="h-4 w-4 text-blue-500" />
              <span className="text-xs font-medium text-gray-500">Tổng đơn</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{summary.totalOrders.toLocaleString()}</p>
            <p className="text-xs text-gray-400">{summary.ordersPerDay}/ngày · {summary.periodDays} ngày</p>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="h-4 w-4 text-green-500" />
              <span className="text-xs font-medium text-gray-500">Doanh thu</span>
            </div>
            <p className="text-2xl font-bold text-green-700">${summary.totalRevenueUsd.toLocaleString()}</p>
            <p className="text-xs text-gray-400">${summary.revenuePerDay}/ngày</p>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Layers className="h-4 w-4 text-indigo-500" />
              <span className="text-xs font-medium text-gray-500">Nhóm SP</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{data ? data.items.filter(i => i.urgency !== "no_sales" && i.urgency !== "unmapped").length : "—"}</p>
            <p className="text-xs text-gray-400">có doanh thu · {data ? data.items.length : "—"} tổng</p>
          </Card>
          <Card className={`p-4 ${(counts.critical ?? 0) > 0 ? "border-red-200 bg-red-50" : ""}`}>
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className={`h-4 w-4 ${(counts.critical ?? 0) > 0 ? "text-red-500" : "text-gray-300"}`} />
              <span className={`text-xs font-medium ${(counts.critical ?? 0) > 0 ? "text-red-600" : "text-gray-500"}`}>Cần nhập gấp</span>
            </div>
            <p className={`text-2xl font-bold ${(counts.critical ?? 0) > 0 ? "text-red-700" : "text-gray-300"}`}>{counts.critical ?? 0}</p>
            <p className="text-xs text-gray-400">nhóm SP</p>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Package className="h-4 w-4 text-orange-500" />
              <span className="text-xs font-medium text-gray-500">Gói cần mua</span>
            </div>
            <p className="text-2xl font-bold text-orange-700">{summary.totalRestockPacks.toLocaleString()}</p>
            <p className="text-xs text-gray-400">theo dự báo trend</p>
          </Card>
          <Card className={`p-4 ${summary.totalRestockCostVnd > 0 ? "border-orange-200 bg-orange-50" : ""}`}>
            <div className="flex items-center gap-2 mb-1">
              <Calculator className="h-4 w-4 text-orange-500" />
              <span className="text-xs font-medium text-orange-600">Chi phí NL</span>
            </div>
            <p className="text-xl font-bold text-orange-700">{fmtM(summary.totalRestockCostVnd)} ₫</p>
            <p className="text-xs text-gray-400">nguyên liệu thô</p>
          </Card>
        </div>
      )}

      {/* ── Shopping list ── */}
      {!loading && <ShoppingListCard list={data?.shoppingList ?? []} />}

      {/* ── Tabs ── */}
      <div className="flex gap-1 rounded-xl bg-gray-100 p-1 flex-wrap">
        {TABS.map(({ key, label }) => {
          const count  = counts[key] ?? 0;
          const active = tab === key;
          const cfg    = key !== "all" ? URGENCY[key as RestockItem["urgency"]] : null;
          return (
            <button key={key} onClick={() => setTab(key)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-all ${active ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"}`}>
              {cfg && <span className={`h-2 w-2 rounded-full ${cfg.dot}`} />}
              {label}
              {count > 0 && (
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${active ? (cfg ? `${cfg.bg} ${cfg.color}` : "bg-gray-100 text-gray-600") : "bg-gray-200 text-gray-500"}`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Search + expand ── */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input className="pl-9" placeholder="Tìm nhóm sản phẩm, tên, SKU..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-1 text-xs text-gray-500 shrink-0">
          <button onClick={() => setExpanded(new Set(data?.items.map(i => i.id)))} className="px-2 py-1.5 rounded hover:bg-gray-100 flex items-center gap-1">
            <ChevronDown className="h-3 w-3" /> Mở tất cả
          </button>
          <button onClick={() => setExpanded(new Set())} className="px-2 py-1.5 rounded hover:bg-gray-100 flex items-center gap-1">
            <ChevronUp className="h-3 w-3" /> Thu lại
          </button>
        </div>
      </div>

      {/* ── Main table ── */}
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        {loading ? (
          <div className="py-20 text-center text-gray-400">
            <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-gray-300" />
            Đang phân tích toàn bộ lịch sử store...
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-20 text-center text-gray-400">Không có sản phẩm phù hợp</div>
        ) : (
          <>
            {/* Column headers — 9 columns */}
            {/* Grid: name | giá mua | tốc độ | tồn | cần mua | đã nhận | thanh toán | xác nhận | ▼ */}
            <div className="hidden md:grid gap-1.5 items-center bg-gray-50 px-4 py-2.5 border-b border-gray-200 text-[10px] font-semibold text-gray-400 uppercase tracking-wide"
              style={{ gridTemplateColumns: "1fr 88px 78px 85px 105px 110px 105px 80px 28px" }}>
              <span>Nguyên liệu / Nhóm · xu hướng</span>
              <span className="text-right text-orange-500">Giá mua</span>
              <span className="text-right text-indigo-500">Tốc độ</span>
              <span className="text-right text-orange-400">Tồn kho</span>
              <span className="text-center text-emerald-600">Cần mua</span>
              <span className="text-center text-emerald-700">Sản xuất</span>
              <span className="text-center">Thanh toán / Đơn mua</span>
              <span className="text-center">Xác nhận mua</span>
              <span />
            </div>

            {filtered.map(item => {
              const cfg    = URGENCY[item.urgency];
              const isOpen = expanded.has(item.id);

              return (
                <div key={item.id} className={`border-b border-gray-100 last:border-0 ${cfg.row}`}>

                  {/* ── GROUP HEADER ROW (desktop) ── */}
                  <div
                    className="hidden md:grid gap-1.5 items-start px-4 py-3 hover:bg-black/[.02] transition-colors cursor-pointer"
                    style={{ gridTemplateColumns: "1fr 88px 78px 85px 105px 110px 105px 80px 28px" }}
                    onClick={() => toggleExpand(item.id)}
                  >
                    {/* Col 1: Name + trend + urgency */}
                    <div className="min-w-0">
                      <div className="flex items-start gap-2">
                        <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${cfg.dot}`} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="font-semibold text-gray-900 text-sm truncate">{item.name}</p>
                            {item.variants.length > 1 && (
                              <span className="flex items-center gap-0.5 text-[10px] text-indigo-500 bg-indigo-50 border border-indigo-200 rounded px-1.5 py-0.5 shrink-0">
                                <Layers className="h-2.5 w-2.5" /> {item.variants.length} SKU
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                            <TrendBadge t={item.trend} />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Col 2: Giá mua */}
                    <div className="text-right">
                      {item.cost.baseCostVnd != null ? (
                        <>
                          <p className="text-sm font-bold text-orange-700">{fmtM(item.cost.baseCostVnd)} ₫</p>
                          <p className="text-[10px] text-gray-400">/{item.cost.costUnit ?? "kg"}</p>
                          {item.cost.costPerPack != null && (
                            <p className="text-[10px] text-orange-500">{fmt(item.cost.costPerPack)} ₫/gói</p>
                          )}
                        </>
                      ) : <span className="text-gray-300 text-xs">—</span>}
                    </div>

                    {/* Col 3: Tốc độ */}
                    <div className="text-right">
                      <p className="font-bold text-indigo-700 text-sm tabular-nums">
                        {item.trend.recentVelocity >= 10 ? Math.round(item.trend.recentVelocity) : item.trend.recentVelocity}
                        <span className="text-[10px] font-normal text-gray-400">/th</span>
                      </p>
                      <p className="text-[10px] text-purple-500">db: {item.trend.forecastNext1M}</p>
                    </div>

                    {/* Col 4: Tồn kho tổng */}
                    <div className="text-right">
                      <p className={`text-base font-bold tabular-nums ${item.effectiveStock === 0 ? "text-red-500" : item.effectiveStock <= 10 ? "text-amber-600" : "text-gray-700"}`}>
                        {item.effectiveStock}
                      </p>
                      {item.nhungQty  > 0 && <p className="text-[10px] text-orange-500">VN:{item.nhungQty}</p>}
                      {item.brosQty   > 0 && <p className="text-[10px] text-purple-500">US:{item.brosQty}</p>}
                      {item.pipelinePacks > 0 && <p className="text-[10px] text-indigo-500">→{item.pipelinePacks}</p>}
                    </div>

                    {/* Col 5: Cần mua (raw amount) */}
                    <div className="text-center">
                      {item.totalSuggestedPacks > 0 ? (
                        <div className="text-emerald-700 leading-snug">
                          <p className="text-sm font-bold">
                            {item.restock.suggestedRawAmount != null
                              ? fmtRaw(item.restock.suggestedRawAmount, item.restock.suggestedRawUnit)
                              : `${item.totalSuggestedPacks} gói`}
                          </p>
                          {item.restock.suggestedRawAmount != null && (
                            <p className="text-[10px] text-gray-400">~{item.totalSuggestedPacks} gói</p>
                          )}
                          {item.totalEstimatedCostVnd != null && (
                            <p className="text-[10px] text-orange-600 font-medium">{fmtM(Math.round(item.totalEstimatedCostVnd))} ₫</p>
                          )}
                        </div>
                      ) : (
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${cfg.bg} ${cfg.color}`}>
                          {item.daysLeft == null ? cfg.label
                            : item.daysLeft < 30 ? `${item.daysLeft} ngày`
                            : `${(item.daysLeft / 30).toFixed(1)} tháng`}
                        </span>
                      )}
                    </div>

                    {/* Col 6: Sản xuất (active + done) + nhận từ Nhung nếu có */}
                    <div className="text-center space-y-0.5">
                      {item.inProductionPacks > 0 && (
                        <p className="text-xs font-bold text-emerald-700">{item.inProductionPacks} đang SX</p>
                      )}
                      {item.pendingProductionPacks > 0 && (
                        <p className="text-xs font-semibold text-indigo-600">{item.pendingProductionPacks} chờ SX</p>
                      )}
                      {item.totalProducedPacks > 0 && item.inProductionPacks === 0 && item.pendingProductionPacks === 0 && (
                        <p className="text-[10px] text-gray-500">đã SX: {item.totalProducedPacks} gói</p>
                      )}
                      {item.totalProducedPacks > 0 && (item.inProductionPacks > 0 || item.pendingProductionPacks > 0) && (
                        <p className="text-[10px] text-gray-400">đã SX: {item.totalProducedPacks}</p>
                      )}
                      {item.linkedPurchases.some(p => p.receivedFromCustomerVnd > 0) && (
                        <p className="text-[10px] text-emerald-700 font-bold">
                          ↓ {fmtM(item.linkedPurchases.reduce((s, p) => s + p.receivedFromCustomerVnd, 0))} ₫
                        </p>
                      )}
                      {item.inProductionPacks === 0 && item.pendingProductionPacks === 0 && item.totalProducedPacks === 0 &&
                       !item.linkedPurchases.some(p => p.receivedFromCustomerVnd > 0) && (
                        <span className="text-gray-300 text-xs">—</span>
                      )}
                    </div>

                    {/* Col 7: Thanh toán / Đơn mua */}
                    <div className="text-center" onClick={e => e.stopPropagation()}>
                      <PurchaseStatusCell purchases={item.linkedPurchases} />
                    </div>

                    {/* Col 8: Xác nhận mua */}
                    <div className="text-center" onClick={e => e.stopPropagation()}>
                      {item.totalSuggestedPacks > 0 || item.urgency === "critical" || item.urgency === "warning" ? (
                        <Link href="/purchases"
                          className="inline-flex items-center gap-1 text-xs bg-emerald-600 hover:bg-emerald-700 text-white px-2 py-1 rounded font-medium transition-colors">
                          <ShoppingCart className="h-3 w-3" />
                          Tạo đơn
                        </Link>
                      ) : <span className="text-gray-300 text-xs">—</span>}
                    </div>

                    {/* Col 9: Toggle (analysis panel) */}
                    <div className="text-gray-400 self-center">
                      {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </div>
                  </div>

                  {/* ── SKU SUB-ROWS — luôn hiển thị, không cần expand ── */}
                  <div className="hidden md:block border-t border-gray-100/80 bg-white/40">
                    {item.variants.map((v, vi) => {
                      const vcfg = URGENCY[v.urgency];
                      return (
                        <div key={v.sku}
                          className={`grid gap-1.5 items-center px-4 py-2 text-xs hover:bg-gray-50/60 transition-colors ${vi < item.variants.length - 1 ? "border-b border-gray-100/60" : ""}`}
                          style={{ gridTemplateColumns: "1fr 88px 78px 85px 105px 110px 105px 80px 28px" }}
                        >
                          {/* Col 1: SKU + name + urgency */}
                          <div className="pl-7 flex items-center gap-2 min-w-0">
                            <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${vcfg.dot}`} />
                            <span className="font-mono text-[10px] bg-gray-100 border border-gray-200 text-gray-500 px-1.5 py-0.5 rounded shrink-0 max-w-[80px] truncate">
                              {v.sku}
                            </span>
                            <span className="text-gray-700 font-medium truncate">{v.localName ?? v.title}</span>
                          </div>
                          {/* Col 2: Đã bán */}
                          <div className="text-right">
                            <span className="font-semibold text-gray-800">{v.totalSold}</span>
                            <span className="text-gray-400 ml-0.5">gói</span>
                            <p className="text-[10px] text-gray-400">{v.numOrders} đơn</p>
                          </div>
                          {/* Col 3: Velocity */}
                          <div className="text-right">
                            <span className="text-indigo-600 font-semibold">{v.trend.recentVelocity}</span>
                            <span className="text-gray-400">/th</span>
                          </div>
                          {/* Col 4: Tồn kho */}
                          <div className="text-right">
                            <span className={`font-bold ${v.totalStock === 0 ? "text-red-500" : "text-gray-700"}`}>
                              {v.totalStock}
                            </span>
                            {v.pipelinePacks > 0 && (
                              <span className="text-indigo-500 text-[10px] ml-0.5">+{v.pipelinePacks}</span>
                            )}
                            {v.nhungQty > 0 && <p className="text-[10px] text-orange-500">VN:{v.nhungQty}</p>}
                            {v.brosQty  > 0 && <p className="text-[10px] text-purple-500">US:{v.brosQty}</p>}
                          </div>
                          {/* Col 5: Còn dùng + suggested */}
                          <div className="text-center">
                            {v.daysLeft != null ? (
                              <span className={`font-semibold ${v.daysLeft <= 14 ? "text-red-600" : v.daysLeft <= 90 ? "text-amber-600" : "text-gray-600"}`}>
                                {v.daysLeft < 30 ? `${v.daysLeft} ngày` : `${(v.daysLeft / 30).toFixed(1)} tháng`}
                              </span>
                            ) : <span className="text-gray-300">—</span>}
                            {v.restock.suggestedPacks > 0 && (
                              <p className="text-[10px] text-emerald-700 font-semibold">→ {v.restock.suggestedPacks} gói</p>
                            )}
                          </div>
                          {/* Col 6: Đang SX / đã SX */}
                          <div className="text-center">
                            {(v.inProductionPacks > 0 || v.pendingProductionPacks > 0 || v.totalProducedPacks > 0) ? (
                              <div>
                                {v.inProductionPacks > 0 && (
                                  <p className="text-emerald-700 font-semibold">{v.inProductionPacks} đang SX</p>
                                )}
                                {v.pendingProductionPacks > 0 && (
                                  <p className="text-indigo-600">{v.pendingProductionPacks} chờ SX</p>
                                )}
                                {v.totalProducedPacks > 0 && (
                                  <p className="text-gray-400 text-[10px]">đã SX: {v.totalProducedPacks}</p>
                                )}
                              </div>
                            ) : <span className="text-gray-300">—</span>}
                          </div>
                          {/* Cols 7-9: empty (purchase columns are group-level) */}
                          <div /><div /><div />
                        </div>
                      );
                    })}
                  </div>

                  {/* ── Mobile row ── */}
                  <div className="md:hidden flex items-start gap-3 px-4 py-3 cursor-pointer" onClick={() => toggleExpand(item.id)}>
                    <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${cfg.dot}`} />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-gray-900 truncate">{item.name}</p>
                      <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-500">
                        <span className="text-indigo-500">{item.variants.length} SKU</span>
                        <span className="text-indigo-600 font-medium">{item.trend.recentVelocity}/tháng</span>
                        {item.totalSuggestedPacks > 0 && (
                          <span className="text-emerald-600 font-medium">
                            → {fmtRaw(item.restock.suggestedRawAmount, item.restock.suggestedRawUnit) ?? `${item.totalSuggestedPacks} gói`}
                          </span>
                        )}
                      </div>
                      {/* Mobile: show all SKUs */}
                      <div className="mt-1.5 space-y-1">
                        {item.variants.map(v => {
                          const vcfg = URGENCY[v.urgency];
                          return (
                            <div key={v.sku} className="flex items-center gap-2 text-xs">
                              <span className={`h-1.5 w-1.5 rounded-full ${vcfg.dot}`} />
                              <span className="font-mono text-[10px] text-gray-500">{v.sku}</span>
                              <span className="text-gray-700 truncate flex-1">{v.localName ?? v.title}</span>
                              <span className="text-gray-500 shrink-0">{v.totalSold} gói</span>
                              {v.restock.suggestedPacks > 0 && (
                                <span className="text-emerald-600 font-medium shrink-0">→ {v.restock.suggestedPacks}</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    {isOpen ? <ChevronUp className="h-4 w-4 text-gray-400 shrink-0 mt-1" /> : <ChevronDown className="h-4 w-4 text-gray-400 shrink-0 mt-1" />}
                  </div>

                  {/* ── Analysis panel (expand để xem chart + chi tiết) ── */}
                  {isOpen && <DetailPanel item={item} />}
                </div>
              );
            })}
          </>
        )}
      </div>

      {/* ── Legend ── */}
      {!loading && data && (
        <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 text-xs text-gray-500 space-y-1.5">
          <p className="font-semibold text-gray-600 mb-2">Cách tính</p>
          <p>• <strong>Phân tích theo nhóm sản phẩm</strong>: nếu 1 nhóm có nhiều mã SKU, tồn kho được CỘNG DỒN → nếu bất kỳ mã nào đang có hàng, nhóm đó không bị xếp "Cần nhập gấp"</p>
          <p>• <strong>Tốc độ gần đây</strong>: tổng gói bán toàn nhóm trong 60 ngày qua, quy đổi về /tháng</p>
          <p>• <strong>Xu hướng MoM</strong>: linear regression trên tốc độ bán chuẩn hoá từng tháng (gói/30 ngày)</p>
          <p>• <strong>Dự báo</strong>: áp dụng slope của xu hướng vào 3–6 tháng tới</p>
          <p>• <strong>Khuyến nghị mua</strong>: nhu cầu dự báo trong {targetDays + leadDays} ngày ({targetDays} mục tiêu + {leadDays} ngày ship) trừ tồn kho hiện có</p>
          <p>• <strong>Chi tiết mã SKU</strong>: bấm vào từng hàng để xem tình trạng tồn kho và khuyến nghị riêng từng mã</p>
        </div>
      )}
    </div>
  );
}
