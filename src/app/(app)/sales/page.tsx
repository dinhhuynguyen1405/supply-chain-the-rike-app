"use client";

import { useEffect, useState, useMemo } from "react";
import { format, subDays, startOfDay, endOfDay, isWithinInterval, parseISO } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Loader2, TrendingUp, RefreshCw, Download, Calendar, X } from "lucide-react";
import { exportSalesExcel } from "@/lib/excel-export";

type SalesItem = {
  id: string;
  orderId: string;
  orderName: string;
  orderDate: string;
  sku: string;
  productName: string;
  quantity: number;
  priceUsd: number;
  subtotalUsd: number;
  sourceName: string;
  channel: string;
};

const QUICK_RANGES = [
  { label: "7 ngày", days: 7 },
  { label: "30 ngày", days: 30 },
  { label: "90 ngày", days: 90 },
  { label: "Tất cả", days: 0 },
] as const;

function todayStr() { return format(new Date(), "yyyy-MM-dd"); }
function daysAgoStr(n: number) { return format(subDays(new Date(), n - 1), "yyyy-MM-dd"); }

export default function SalesPage() {
  const [salesItems, setSalesItems] = useState<SalesItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // Date filter state
  const [activePreset, setActivePreset] = useState<number>(30); // 0 = all
  const [dateFrom, setDateFrom] = useState<string>(daysAgoStr(30));
  const [dateTo, setDateTo] = useState<string>(todayStr());

  const fetchSales = () => {
    setLoading(true);
    fetch("/api/sales")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setSalesItems(data);
        } else {
          toast.error(data.error || "Lỗi tải dữ liệu bán hàng");
        }
      })
      .catch(() => toast.error("Có lỗi xảy ra kết nối Server"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchSales(); }, []);

  const handleSyncOrders = async () => {
    setSyncing(true);
    try {
      const res = await fetch("/api/sync/shopify?type=orders", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Lỗi đồng bộ");
      toast.success(`Đã đồng bộ đơn hàng mới`);
      fetchSales();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Lỗi đồng bộ");
    } finally {
      setSyncing(false);
    }
  };

  function applyPreset(days: number) {
    setActivePreset(days);
    if (days === 0) {
      setDateFrom("");
      setDateTo("");
    } else {
      setDateFrom(daysAgoStr(days));
      setDateTo(todayStr());
    }
  }

  // Client-side filtering
  const filteredItems = useMemo(() => {
    if (!dateFrom && !dateTo) return salesItems;
    const from = dateFrom ? startOfDay(parseISO(dateFrom)) : null;
    const to   = dateTo   ? endOfDay(parseISO(dateTo))     : null;
    return salesItems.filter((item) => {
      if (!item.orderDate) return true;
      const d = parseISO(item.orderDate);
      if (from && to) return isWithinInterval(d, { start: from, end: to });
      if (from) return d >= from;
      if (to)   return d <= to;
      return true;
    });
  }, [salesItems, dateFrom, dateTo]);

  const totalQuantity = filteredItems.reduce((acc, item) => acc + item.quantity, 0);
  const totalRevenue  = filteredItems.reduce((acc, item) => acc + item.subtotalUsd, 0);
  const revenueShopify = filteredItems
    .filter(i => i.channel === "Website Shopify" || i.channel === "Mặc định (Shopify)")
    .reduce((a, i) => a + i.subtotalUsd, 0);
  const revenueTikTok = filteredItems
    .filter(i => i.channel === "TikTok")
    .reduce((a, i) => a + i.subtotalUsd, 0);

  const rangeLabel = dateFrom && dateTo
    ? `${format(parseISO(dateFrom), "dd/MM/yyyy")} – ${format(parseISO(dateTo), "dd/MM/yyyy")}`
    : dateFrom ? `Từ ${format(parseISO(dateFrom), "dd/MM/yyyy")}`
    : dateTo   ? `Đến ${format(parseISO(dateTo), "dd/MM/yyyy")}`
    : "Toàn bộ";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
            <TrendingUp className="h-6 w-6 text-green-600" />
            Báo cáo Bán hàng
          </h1>
          <p className="text-sm text-gray-500 mt-1">Tổng hợp các sản phẩm đã bán từ Shopify (các đơn đã thanh toán)</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => exportSalesExcel(filteredItems)}
            disabled={filteredItems.length === 0}
            className="flex items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-600 hover:border-gray-300 hover:bg-gray-50 disabled:opacity-40"
          >
            <Download className="h-4 w-4" />
            Excel
          </button>
          <button
            onClick={handleSyncOrders}
            disabled={syncing}
            className="flex items-center gap-2 rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Đang đồng bộ..." : "Đồng bộ Đơn hàng Shopify"}
          </button>
        </div>
      </div>

      {/* ── Date filter bar ── */}
      <div className="flex items-center gap-3 flex-wrap rounded-xl border border-gray-200 bg-white px-4 py-3">
        <div className="flex items-center gap-1.5 text-sm text-gray-500 shrink-0">
          <Calendar className="h-4 w-4 text-gray-400" />
          <span className="font-medium">Thời gian:</span>
        </div>

        {/* Quick presets */}
        <div className="flex gap-1 flex-wrap">
          {QUICK_RANGES.map(({ label, days }) => (
            <button
              key={days}
              onClick={() => applyPreset(days)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium border transition-all ${
                activePreset === days && !(days === 0 && (dateFrom || dateTo))
                  ? "bg-green-600 text-white border-green-600"
                  : "bg-white text-gray-600 border-gray-200 hover:border-green-300 hover:text-green-700"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Divider */}
        <span className="text-gray-300 text-sm hidden sm:inline">|</span>

        {/* Custom date range */}
        <div className="flex items-center gap-2 flex-wrap">
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => { setDateFrom(e.target.value); setActivePreset(-1); }}
            className="h-8 w-36 text-sm"
          />
          <span className="text-gray-400 text-sm">→</span>
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => { setDateTo(e.target.value); setActivePreset(-1); }}
            className="h-8 w-36 text-sm"
          />
          {(dateFrom || dateTo) && activePreset === -1 && (
            <button
              onClick={() => applyPreset(0)}
              className="text-gray-400 hover:text-gray-600"
              title="Xóa bộ lọc"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Range summary */}
        <span className="ml-auto text-xs text-gray-400 shrink-0">
          {rangeLabel} · <strong className="text-gray-600">{filteredItems.length}</strong> dòng
        </span>
      </div>

      {/* ── Summary cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="rounded-md border bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-gray-500">Doanh thu ({rangeLabel})</p>
          <p className="mt-2 text-3xl font-bold text-green-600">${totalRevenue.toFixed(2)}</p>
          <p className="text-xs text-gray-400 mt-1">{totalQuantity} sản phẩm</p>
        </div>
        <div className="rounded-md border bg-white p-5 shadow-sm border-l-4 border-l-blue-500">
          <p className="text-sm font-medium text-gray-500">Web Shopify</p>
          <p className="mt-2 text-3xl font-bold text-gray-900">${revenueShopify.toFixed(2)}</p>
        </div>
        <div className="rounded-md border bg-white p-5 shadow-sm border-l-4 border-l-black">
          <p className="text-sm font-medium text-gray-500">TikTok Shop</p>
          <p className="mt-2 text-3xl font-bold text-gray-900">${revenueTikTok.toFixed(2)}</p>
        </div>
        <div className="rounded-md border bg-white p-5 shadow-sm border-l-4 border-l-gray-300">
          <p className="text-sm font-medium text-gray-500">Tổng đơn bán</p>
          <p className="mt-2 text-3xl font-bold text-gray-700">
            {new Set(filteredItems.map(i => i.orderId)).size}
          </p>
          <p className="text-xs text-gray-400 mt-1">đơn hàng</p>
        </div>
      </div>

      {/* ── Table ── */}
      <div className="rounded-md border bg-white shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-gray-50/50">
            <TableRow>
              <TableHead>Ngày Đặt</TableHead>
              <TableHead>Kênh</TableHead>
              <TableHead>Mã Đơn</TableHead>
              <TableHead>Sản Phẩm</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead className="text-right">Số Lượng</TableHead>
              <TableHead className="text-right">Đơn Giá</TableHead>
              <TableHead className="text-right">Thành Tiền</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} className="h-40 text-center">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto text-gray-400" />
                </TableCell>
              </TableRow>
            ) : filteredItems.length > 0 ? (
              filteredItems.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="text-gray-600 whitespace-nowrap">
                    {format(parseISO(item.orderDate), "dd/MM/yyyy")}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={item.channel === "TikTok" ? "default" : "outline"}
                      className={item.channel === "TikTok" ? "bg-black" : ""}
                    >
                      {item.channel}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-semibold text-gray-900">
                    <Badge variant="outline">{item.orderName}</Badge>
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate" title={item.productName}>
                    {item.productName}
                  </TableCell>
                  <TableCell className="text-gray-500">{item.sku || "-"}</TableCell>
                  <TableCell className="text-right font-medium">{item.quantity}</TableCell>
                  <TableCell className="text-right text-gray-600">${item.priceUsd.toFixed(2)}</TableCell>
                  <TableCell className="text-right font-bold text-green-700">
                    ${item.subtotalUsd.toFixed(2)}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={8} className="h-40 text-center text-gray-500">
                  {salesItems.length > 0
                    ? `Không có đơn nào trong khoảng ${rangeLabel}`
                    : "Chưa có sản phẩm nào được bán."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
