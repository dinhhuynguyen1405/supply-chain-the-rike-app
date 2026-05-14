"use client";
import { useEffect, useState } from "react";
import { formatVND, formatUSD } from "@/lib/utils";
import { TrendingUp, TrendingDown, DollarSign, Package, ArrowUpDown, Download } from "lucide-react";
import { exportAnalyticsExcel } from "@/lib/excel-export";

interface ProductProfit {
  productId: string;
  name: string;
  nameVi: string | null;
  skuShopify: string | null;
  category: string | null;
  unit: string;
  imageUrl: string | null;
  totalBought: number;
  totalCostVnd: number;
  avgCostPerUnitVnd: number;
  totalSold: number;
  totalRevenueUsd: number;
  totalRevenueVnd: number;
  cogsVnd: number;
  grossProfitVnd: number;
  marginPct: number;
  avgSellingPriceUsd: number;
}

interface Totals { totalRevenueVnd: number; totalCogsVnd: number; totalProfitVnd: number }

type SortKey = "profit" | "margin" | "revenue" | "sold";
type SortDir = "desc" | "asc";

function MarginBar({ pct }: { pct: number }) {
  const clamped = Math.max(0, Math.min(100, pct));
  const color = pct >= 40 ? "bg-emerald-500" : pct >= 20 ? "bg-amber-400" : pct >= 0 ? "bg-orange-400" : "bg-red-500";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 rounded-full bg-gray-100 overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${clamped}%` }} />
      </div>
      <span className={`text-xs font-semibold tabular-nums ${pct >= 20 ? "text-emerald-700" : pct >= 0 ? "text-amber-700" : "text-red-600"}`}>
        {pct.toFixed(1)}%
      </span>
    </div>
  );
}

export default function AnalyticsPage() {
  const [data, setData] = useState<{ products: ProductProfit[]; totals: Totals; usdToVnd: number } | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("profit");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");

  useEffect(() => {
    fetch("/api/analytics/profit").then((r) => r.json()).then(setData);
  }, []);

  if (!data) return (
    <div className="flex h-64 items-center justify-center">
      <div className="h-7 w-7 animate-spin rounded-full border-[3px] border-gray-300 border-t-gray-700" />
    </div>
  );

  const { products, totals } = data;
  const categories = ["all", ...Array.from(new Set(products.map((p) => p.category).filter(Boolean))) as string[]];

  const sorted = [...products]
    .filter((p) => {
      const q = search.toLowerCase();
      const matchSearch = !q || (p.nameVi ?? p.name).toLowerCase().includes(q) || (p.skuShopify ?? "").toLowerCase().includes(q);
      const matchCat = categoryFilter === "all" || p.category === categoryFilter;
      return matchSearch && matchCat;
    })
    .sort((a, b) => {
      const map: Record<SortKey, keyof ProductProfit> = {
        profit: "grossProfitVnd", margin: "marginPct", revenue: "totalRevenueVnd", sold: "totalSold",
      };
      const key = map[sortKey];
      const diff = (a[key] as number) - (b[key] as number);
      return sortDir === "desc" ? -diff : diff;
    });

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    else { setSortKey(key); setSortDir("desc"); }
  }

  const totalMargin = totals.totalRevenueVnd > 0
    ? ((totals.totalProfitVnd / totals.totalRevenueVnd) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Phân tích lợi nhuận</h1>
          <p className="text-sm text-gray-500 mt-0.5">COGS và margin thực tế theo từng sản phẩm</p>
        </div>
        <button
          onClick={() => exportAnalyticsExcel(products, totals)}
          className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-600 hover:border-gray-300 hover:bg-gray-50 transition-colors"
        >
          <Download className="h-3.5 w-3.5" />
          Xuất Excel
        </button>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Tổng doanh thu", value: formatVND(totals.totalRevenueVnd), icon: TrendingUp, color: "text-blue-600", bg: "bg-blue-50" },
          { label: "Tổng COGS", value: formatVND(totals.totalCogsVnd), icon: Package, color: "text-amber-600", bg: "bg-amber-50" },
          { label: "Lợi nhuận gộp", value: formatVND(totals.totalProfitVnd), icon: totals.totalProfitVnd >= 0 ? TrendingUp : TrendingDown, color: totals.totalProfitVnd >= 0 ? "text-emerald-600" : "text-red-500", bg: totals.totalProfitVnd >= 0 ? "bg-emerald-50" : "bg-red-50" },
          { label: "Margin tổng", value: `${totalMargin.toFixed(1)}%`, icon: DollarSign, color: totalMargin >= 20 ? "text-emerald-600" : "text-amber-600", bg: totalMargin >= 20 ? "bg-emerald-50" : "bg-amber-50" },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-gray-100 bg-white p-4">
            <div className="flex items-start justify-between">
              <p className="text-xs text-gray-500">{s.label}</p>
              <div className={`rounded-lg p-1.5 ${s.bg}`}>
                <s.icon className={`h-3.5 w-3.5 ${s.color}`} />
              </div>
            </div>
            <p className={`mt-2 text-xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          className="h-8 rounded-lg border border-gray-200 bg-white px-3 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-300 w-52"
          placeholder="Tìm sản phẩm..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="flex gap-1">
          {categories.map((c) => (
            <button key={c} onClick={() => setCategoryFilter(c)}
              className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${categoryFilter === c ? "bg-gray-900 text-white" : "bg-white border border-gray-200 text-gray-600 hover:border-gray-300"}`}>
              {c === "all" ? "Tất cả" : c}
            </button>
          ))}
        </div>
        <span className="ml-auto text-xs text-gray-400">{sorted.length} sản phẩm</span>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-gray-100 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/70">
              <th className="px-4 py-3 text-left font-medium text-gray-500 text-xs">Sản phẩm</th>
              <th className="px-4 py-3 text-right font-medium text-gray-500 text-xs">Giá vốn TB</th>
              <th className="px-4 py-3 text-right font-medium text-gray-500 text-xs cursor-pointer hover:text-gray-800 select-none" onClick={() => toggleSort("sold")}>
                <span className="flex items-center justify-end gap-1">Đã bán <ArrowUpDown className="h-3 w-3" /></span>
              </th>
              <th className="px-4 py-3 text-right font-medium text-gray-500 text-xs cursor-pointer hover:text-gray-800 select-none" onClick={() => toggleSort("revenue")}>
                <span className="flex items-center justify-end gap-1">Doanh thu <ArrowUpDown className="h-3 w-3" /></span>
              </th>
              <th className="px-4 py-3 text-right font-medium text-gray-500 text-xs">COGS</th>
              <th className="px-4 py-3 text-right font-medium text-gray-500 text-xs cursor-pointer hover:text-gray-800 select-none" onClick={() => toggleSort("profit")}>
                <span className="flex items-center justify-end gap-1">Lợi nhuận <ArrowUpDown className="h-3 w-3" /></span>
              </th>
              <th className="px-4 py-3 text-left font-medium text-gray-500 text-xs cursor-pointer hover:text-gray-800 select-none" onClick={() => toggleSort("margin")}>
                <span className="flex items-center gap-1">Margin <ArrowUpDown className="h-3 w-3" /></span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {sorted.map((p) => (
              <tr key={p.productId} className="hover:bg-gray-50/50 transition-colors">
                <td className="px-4 py-3">
                  <p className="font-medium text-gray-900 text-sm">{p.nameVi ?? p.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {p.skuShopify && <span className="font-mono text-[10px] text-gray-400">{p.skuShopify}</span>}
                    {p.category && <span className="text-[10px] text-gray-400 bg-gray-100 rounded px-1">{p.category}</span>}
                  </div>
                </td>
                <td className="px-4 py-3 text-right">
                  <p className="text-sm font-medium text-gray-700">{formatVND(p.avgCostPerUnitVnd)}</p>
                  <p className="text-[10px] text-gray-400">/{p.unit}</p>
                </td>
                <td className="px-4 py-3 text-right">
                  <p className="text-sm font-semibold text-gray-800">{p.totalSold.toLocaleString("vi-VN")}</p>
                  {p.avgSellingPriceUsd > 0 && <p className="text-[10px] text-gray-400">≈ {formatUSD(p.avgSellingPriceUsd)}/gói</p>}
                </td>
                <td className="px-4 py-3 text-right">
                  <p className="text-sm font-semibold text-blue-700">{formatVND(p.totalRevenueVnd)}</p>
                  <p className="text-[10px] text-gray-400">{formatUSD(p.totalRevenueUsd)}</p>
                </td>
                <td className="px-4 py-3 text-right">
                  <p className="text-sm text-amber-700">{formatVND(p.cogsVnd)}</p>
                </td>
                <td className="px-4 py-3 text-right">
                  <p className={`text-sm font-bold ${p.grossProfitVnd >= 0 ? "text-emerald-700" : "text-red-600"}`}>
                    {p.grossProfitVnd >= 0 ? "+" : ""}{formatVND(p.grossProfitVnd)}
                  </p>
                </td>
                <td className="px-4 py-3">
                  <MarginBar pct={p.marginPct} />
                </td>
              </tr>
            ))}
            {sorted.length === 0 && (
              <tr><td colSpan={7} className="py-12 text-center text-sm text-gray-400">Không có dữ liệu</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
