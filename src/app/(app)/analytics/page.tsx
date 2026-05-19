"use client";
import { useEffect, useState } from "react";
import { formatVND, formatUSD } from "@/lib/utils";
import { TrendingUp, TrendingDown, DollarSign, Package, ArrowUpDown, Download, Calculator, Users } from "lucide-react";
import { exportAnalyticsExcel } from "@/lib/excel-export";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import RevenueSplitPage from "./revenue-split/page";

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
      <Tabs defaultValue="products">
        <div className="flex items-center justify-between mb-4">
          <TabsList>
            <TabsTrigger value="products" className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              Sản phẩm
            </TabsTrigger>
            <TabsTrigger value="split" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Phân chia Huy-Nhung
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="products">
          <div className="space-y-6">
            {/* Header copy from original */}
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Phân tích lợi nhuận</h1>
                <p className="text-sm text-gray-500 mt-0.5">COGS và margin thực tế theo từng sản phẩm</p>
              </div>
              <button
                onClick={() => exportAnalyticsExcel(products, totals)}
                className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors shadow-sm"
              >
                <Download className="h-4 w-4" /> Export Excel
              </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-50 rounded-lg text-blue-600"><DollarSign className="h-5 w-5" /></div>
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Tổng Doanh Thu</p>
                    <p className="text-xl font-bold text-gray-900 mt-0.5">{formatVND(totals.totalRevenueVnd)}</p>
                  </div>
                </div>
              </div>
              <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-50 rounded-lg text-amber-600"><Package className="h-5 w-5" /></div>
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Tổng Giá Vốn</p>
                    <p className="text-xl font-bold text-gray-900 mt-0.5">{formatVND(totals.totalCogsVnd)}</p>
                  </div>
                </div>
              </div>
              <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${totals.totalProfitVnd >= 0 ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"}`}>
                    <TrendingUp className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Lợi Nhuận Gộp</p>
                    <div className="flex items-baseline gap-2 mt-0.5">
                      <p className="text-xl font-bold text-gray-900">{formatVND(totals.totalProfitVnd)}</p>
                      <span className={`text-xs font-semibold ${totalMargin >= 20 ? "text-emerald-600" : "text-amber-600"}`}>
                        ({totalMargin.toFixed(1)}%)
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Filters */}
            <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
              <div className="relative w-full md:w-96">
                <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-gray-400">
                  <Package className="h-4 w-4" />
                </div>
                <input
                  type="text"
                  placeholder="Tìm theo tên sản phẩm hoặc SKU..."
                  className="w-full pl-9 pr-4 py-2 bg-gray-50 border-none rounded-lg text-sm focus:ring-2 focus:ring-gray-200 transition-all"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <select
                className="w-full md:w-48 px-3 py-2 bg-gray-50 border-none rounded-lg text-sm focus:ring-2 focus:ring-gray-200 transition-all capitalize"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
              >
                {categories.map((c) => (
                  <option key={c} value={c}>{c === "all" ? "Tất cả danh mục" : c}</option>
                ))}
              </select>
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50/50 border-b border-gray-50">
                    <th className="px-4 py-3 text-left font-medium text-gray-500 text-xs uppercase tracking-wider">Sản phẩm</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-500 text-xs uppercase tracking-wider cursor-pointer hover:text-gray-800 select-none" onClick={() => toggleSort("sold")}>
                      <span className="flex items-center justify-end gap-1">Giá vốn <ArrowUpDown className="h-3 w-3" /></span>
                    </th>
                    <th className="px-4 py-3 text-right font-medium text-gray-500 text-xs uppercase tracking-wider cursor-pointer hover:text-gray-800 select-none" onClick={() => toggleSort("sold")}>
                      <span className="flex items-center justify-end gap-1">Đã bán <ArrowUpDown className="h-3 w-3" /></span>
                    </th>
                    <th className="px-4 py-3 text-right font-medium text-gray-500 text-xs uppercase tracking-wider cursor-pointer hover:text-gray-800 select-none" onClick={() => toggleSort("revenue")}>
                      <span className="flex items-center justify-end gap-1">Doanh thu <ArrowUpDown className="h-3 w-3" /></span>
                    </th>
                    <th className="px-4 py-3 text-right font-medium text-gray-500 text-xs uppercase tracking-wider">Tổng vốn</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-500 text-xs uppercase tracking-wider cursor-pointer hover:text-gray-800 select-none" onClick={() => toggleSort("profit")}>
                      <span className="flex items-center justify-end gap-1">Lợi nhuận <ArrowUpDown className="h-3 w-3" /></span>
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500 text-xs uppercase tracking-wider cursor-pointer hover:text-gray-800 select-none" onClick={() => toggleSort("margin")}>
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
        </TabsContent>

        <TabsContent value="split">
          <RevenueSplitPage />
        </TabsContent>
      </Tabs>
    </div>
  );
}
