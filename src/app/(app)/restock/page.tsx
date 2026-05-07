"use client";
import { useEffect, useState, useMemo } from "react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import {
  RefreshCw, AlertTriangle, TrendingUp, Package, Search,
  ShoppingCart, DollarSign, BarChart3, Clock, ArrowUpRight,
} from "lucide-react";
import type { RestockItem, RestockResponse, RestockSummary } from "@/app/api/analytics/restock/route";

type UrgencyTab = "all" | "critical" | "warning" | "healthy" | "overstocked";

const URGENCY_CONFIG: Record<RestockItem["urgency"], {
  label: string; color: string; bg: string; border: string; dot: string;
}> = {
  critical:    { label: "Cần nhập gấp",  color: "text-red-700",    bg: "bg-red-50",    border: "border-red-200",    dot: "bg-red-500"    },
  warning:     { label: "Theo dõi",      color: "text-amber-700",  bg: "bg-amber-50",  border: "border-amber-200",  dot: "bg-amber-500"  },
  healthy:     { label: "Ổn",            color: "text-green-700",  bg: "bg-green-50",  border: "border-green-200",  dot: "bg-green-500"  },
  overstocked: { label: "Đang thừa",     color: "text-blue-700",   bg: "bg-blue-50",   border: "border-blue-200",   dot: "bg-blue-500"   },
  no_sales:    { label: "Chưa bán",      color: "text-gray-500",   bg: "bg-gray-50",   border: "border-gray-200",   dot: "bg-gray-300"   },
};

function formatDaysLeft(days: number | null): string {
  if (days === null) return "—";
  if (days === 0) return "Hết hàng";
  if (days < 30) return `${days} ngày`;
  const months = Math.round(days / 30 * 10) / 10;
  if (months < 12) return `${months} tháng`;
  return `${Math.round(months / 12 * 10) / 10} năm`;
}

function DaysLeftBadge({ item }: { item: RestockItem }) {
  const cfg = URGENCY_CONFIG[item.urgency];
  const text = item.totalStock === 0 && item.soldPerDay > 0
    ? "Hết hàng"
    : formatDaysLeft(item.daysLeft);
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${cfg.bg} ${cfg.color}`}>
      {text}
    </span>
  );
}

export default function RestockPage() {
  const [data, setData] = useState<RestockResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<UrgencyTab>("all");
  const [search, setSearch] = useState("");

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/analytics/restock");
      if (!res.ok) throw new Error("Lỗi tải dữ liệu");
      setData(await res.json());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Lỗi không xác định");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = search.toLowerCase();
    return data.items.filter((item) => {
      const matchSearch = !q ||
        item.title.toLowerCase().includes(q) ||
        (item.localName ?? "").toLowerCase().includes(q) ||
        item.sku.toLowerCase().includes(q);
      const matchTab = tab === "all" || item.urgency === tab;
      return matchSearch && matchTab;
    });
  }, [data, tab, search]);

  const counts = useMemo(() => {
    if (!data) return {} as Record<string, number>;
    const c: Record<string, number> = { all: data.items.length };
    for (const item of data.items) {
      c[item.urgency] = (c[item.urgency] ?? 0) + 1;
    }
    return c;
  }, [data]);

  const summary: RestockSummary | null = data?.summary ?? null;

  const TABS: { key: UrgencyTab; label: string; icon?: React.ElementType }[] = [
    { key: "all",        label: "Tất cả" },
    { key: "critical",   label: "Cần nhập gấp" },
    { key: "warning",    label: "Theo dõi" },
    { key: "healthy",    label: "Ổn" },
    { key: "overstocked",label: "Đang thừa" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Phân tích tồn kho</h1>
          <p className="text-sm text-gray-500">
            Dự báo dựa trên tốc độ bán thực tế — đề xuất sản phẩm cần nhập thêm
          </p>
        </div>
        <div className="flex items-center gap-2">
          {data && (
            <p className="text-xs text-gray-400">
              Cập nhật: {new Date(data.generatedAt).toLocaleString("vi-VN")}
            </p>
          )}
          <Button size="sm" variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Làm mới
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <ShoppingCart className="h-4 w-4 text-blue-500" />
              <span className="text-xs font-medium text-gray-500">Tổng đơn hàng</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{summary.totalOrders}</p>
            <p className="text-xs text-gray-400 mt-0.5">{summary.ordersPerDay} đơn/ngày</p>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="h-4 w-4 text-green-500" />
              <span className="text-xs font-medium text-gray-500">Doanh thu</span>
            </div>
            <p className="text-2xl font-bold text-green-700">${summary.totalRevenueUsd.toLocaleString()}</p>
            <p className="text-xs text-gray-400 mt-0.5">${summary.revenuePerDay}/ngày</p>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="h-4 w-4 text-purple-500" />
              <span className="text-xs font-medium text-gray-500">Chu kỳ phân tích</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{summary.periodDays}</p>
            <p className="text-xs text-gray-400 mt-0.5">ngày dữ liệu</p>
          </Card>
          <Card className={`p-4 ${(counts.critical ?? 0) > 0 ? "border-red-200 bg-red-50" : ""}`}>
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className={`h-4 w-4 ${(counts.critical ?? 0) > 0 ? "text-red-500" : "text-gray-300"}`} />
              <span className={`text-xs font-medium ${(counts.critical ?? 0) > 0 ? "text-red-600" : "text-gray-500"}`}>
                Cần nhập gấp
              </span>
            </div>
            <p className={`text-2xl font-bold ${(counts.critical ?? 0) > 0 ? "text-red-700" : "text-gray-300"}`}>
              {counts.critical ?? 0}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">sản phẩm</p>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <BarChart3 className="h-4 w-4 text-indigo-500" />
              <span className="text-xs font-medium text-gray-500">SKU đang bán</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{summary && data ? data.items.filter(i => i.urgency !== "no_sales").length : "—"}</p>
            <p className="text-xs text-gray-400 mt-0.5">sản phẩm có doanh thu</p>
          </Card>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl bg-gray-100 p-1 flex-wrap">
        {TABS.map(({ key, label }) => {
          const count = counts[key] ?? 0;
          const isActive = tab === key;
          const cfg = key !== "all" ? URGENCY_CONFIG[key as RestockItem["urgency"]] : null;
          return (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-all ${
                isActive ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {cfg && <span className={`h-2 w-2 rounded-full ${cfg.dot}`} />}
              {label}
              {count > 0 && (
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                  isActive ? (cfg ? `${cfg.bg} ${cfg.color}` : "bg-gray-100 text-gray-600") : "bg-gray-200 text-gray-500"
                }`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          className="pl-9"
          placeholder="Tìm theo tên sản phẩm, SKU..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        {loading ? (
          <div className="py-20 text-center text-gray-400">
            <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-gray-300" />
            Đang phân tích dữ liệu...
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-20 text-center text-gray-400">Không có sản phẩm nào phù hợp</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Sản phẩm</th>
                <th className="px-4 py-3 text-right font-medium text-indigo-600">Tốc độ bán</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">Đã bán</th>
                <th className="px-4 py-3 text-right font-medium text-green-600">Doanh thu</th>
                <th className="px-4 py-3 text-right font-medium text-orange-600">Tồn kho</th>
                <th className="px-4 py-3 text-center font-medium text-gray-500">Còn dùng</th>
                <th className="px-4 py-3 text-center font-medium text-gray-500">Trạng thái</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((item) => {
                const cfg = URGENCY_CONFIG[item.urgency];
                return (
                  <tr
                    key={item.sku}
                    className={`transition-colors hover:bg-gray-50/80 ${
                      item.urgency === "critical" ? "bg-red-50/30" :
                      item.urgency === "warning"  ? "bg-amber-50/20" : ""
                    }`}
                  >
                    {/* Product */}
                    <td className="px-4 py-3 max-w-xs">
                      <div className="flex items-start gap-2">
                        <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${cfg.dot}`} />
                        <div className="min-w-0">
                          {item.productId ? (
                            <Link
                              href={`/products/${item.productId}`}
                              className="font-medium text-gray-900 hover:text-green-600 hover:underline flex items-center gap-1 leading-snug"
                            >
                              <span className="truncate">{item.localName ?? item.title}</span>
                              <ArrowUpRight className="h-3 w-3 shrink-0 text-gray-300" />
                            </Link>
                          ) : (
                            <p className="font-medium text-gray-900 truncate leading-snug">
                              {item.localName ?? item.title}
                            </p>
                          )}
                          <p className="text-xs text-gray-400 truncate max-w-[280px] mt-0.5" title={item.title}>
                            {item.title !== (item.localName ?? item.title) ? item.title : ""}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="font-mono text-[10px] text-gray-300">{item.sku}</span>
                            {item.priceUsd && (
                              <span className="text-[10px] font-semibold text-green-600">${item.priceUsd}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Velocity */}
                    <td className="px-4 py-3 text-right">
                      <p className="font-bold text-indigo-700 tabular-nums">
                        {item.soldPerMonth >= 10
                          ? Math.round(item.soldPerMonth)
                          : item.soldPerMonth.toFixed(1)}
                        <span className="text-xs font-normal text-gray-400">/tháng</span>
                      </p>
                      <p className="text-[11px] text-gray-400">{item.soldPerDay.toFixed(2)}/ngày</p>
                    </td>

                    {/* Total sold */}
                    <td className="px-4 py-3 text-right">
                      <p className="font-semibold text-gray-700 tabular-nums">{item.totalSold}</p>
                      <p className="text-[11px] text-gray-400">{item.numOrders} đơn</p>
                    </td>

                    {/* Revenue */}
                    <td className="px-4 py-3 text-right">
                      <p className="font-semibold text-green-700">${item.revenueUsd.toLocaleString()}</p>
                    </td>

                    {/* Stock breakdown */}
                    <td className="px-4 py-3 text-right">
                      <p className={`text-base font-bold tabular-nums ${
                        item.totalStock === 0 ? "text-red-500" :
                        item.totalStock <= 10 ? "text-amber-600" : "text-gray-700"
                      }`}>
                        {item.totalStock}
                      </p>
                      {item.brosQty > 0 && (
                        <p className="text-[11px] text-purple-500">Bros: {item.brosQty}</p>
                      )}
                      {item.nhungQty > 0 && (
                        <p className="text-[11px] text-orange-500">Nhung: {item.nhungQty}</p>
                      )}
                    </td>

                    {/* Days left */}
                    <td className="px-4 py-3 text-center">
                      <DaysLeftBadge item={item} />
                    </td>

                    {/* Urgency badge */}
                    <td className="px-4 py-3 text-center">
                      <Badge className={`text-xs ${cfg.bg} ${cfg.color} border ${cfg.border}`}>
                        {cfg.label}
                      </Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Legend */}
      {!loading && data && (
        <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Quy tắc phân loại</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs text-gray-600">
            <div className="flex items-start gap-2">
              <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-red-500" />
              <div><p className="font-medium text-red-700">Cần nhập gấp</p><p className="text-gray-400">Hết hàng hoặc còn &lt; 14 ngày</p></div>
            </div>
            <div className="flex items-start gap-2">
              <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-amber-500" />
              <div><p className="font-medium text-amber-700">Theo dõi</p><p className="text-gray-400">Còn 14–90 ngày</p></div>
            </div>
            <div className="flex items-start gap-2">
              <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-green-500" />
              <div><p className="font-medium text-green-700">Ổn</p><p className="text-gray-400">Còn 90 ngày – 1 năm</p></div>
            </div>
            <div className="flex items-start gap-2">
              <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-blue-500" />
              <div><p className="font-medium text-blue-700">Đang thừa</p><p className="text-gray-400">Còn &gt; 1 năm tồn kho</p></div>
            </div>
          </div>
          <p className="text-[11px] text-gray-400 mt-3">
            * Tốc độ bán tính từ ngày bán đầu tiên đến hôm nay. Tồn kho = Kho Nhung + Kho Bros.
          </p>
        </div>
      )}
    </div>
  );
}
