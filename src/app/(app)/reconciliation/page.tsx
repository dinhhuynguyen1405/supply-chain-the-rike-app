"use client";
import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  RefreshCw, Search, CheckCircle2, AlertTriangle,
  XCircle, HelpCircle, ArrowRight, Package, Clock,
} from "lucide-react";
import type { ReconciliationItem, ReconciliationResponse } from "@/app/api/reconciliation/route";

// ── Types ─────────────────────────────────────────────────────────────────────
type FilterTab = "all" | "critical" | "warning" | "ok" | "no_data";

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatRelativeTime(iso: string | null): string {
  if (!iso) return "chưa sync";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "vừa xong";
  if (mins < 60) return `${mins} phút trước`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} giờ trước`;
  return `${Math.floor(hrs / 24)} ngày trước`;
}

function StatusBadge({ status }: { status: ReconciliationItem["status"] }) {
  if (status === "ok")       return <Badge className="bg-green-100 text-green-700 gap-1"><CheckCircle2 className="h-3 w-3" />Khớp</Badge>;
  if (status === "warning")  return <Badge className="bg-amber-100 text-amber-700 gap-1"><AlertTriangle className="h-3 w-3" />Lệch nhẹ</Badge>;
  if (status === "critical") return <Badge className="bg-red-100 text-red-700 gap-1"><XCircle className="h-3 w-3" />Lệch lớn</Badge>;
  return <Badge className="bg-gray-100 text-gray-500 gap-1"><HelpCircle className="h-3 w-3" />Chưa có data</Badge>;
}

function DiffCell({ diff }: { diff: number | null }) {
  if (diff === null) return <span className="text-gray-300">—</span>;
  if (diff === 0)    return <span className="text-green-600 font-semibold">0</span>;
  const color = diff > 0 ? "text-amber-600" : "text-red-600";
  const sign  = diff > 0 ? "+" : "";
  return (
    <span className={`font-semibold ${color}`}>
      {sign}{diff}
    </span>
  );
}

function QtyCell({ qty, fallback = "—" }: { qty: number | null; fallback?: string }) {
  if (qty === null) return <span className="text-gray-300 text-xs">{fallback}</span>;
  return <span className={qty === 0 ? "text-gray-400" : "text-gray-800 font-medium"}>{qty}</span>;
}

const FILTER_TABS: { key: FilterTab; label: string; color: string }[] = [
  { key: "all",      label: "Tất cả",      color: "bg-gray-100 text-gray-700" },
  { key: "critical", label: "❌ Lệch lớn", color: "bg-red-100 text-red-700" },
  { key: "warning",  label: "⚠️ Lệch nhẹ", color: "bg-amber-100 text-amber-700" },
  { key: "ok",       label: "✅ Khớp",      color: "bg-green-100 text-green-700" },
  { key: "no_data",  label: "❓ Chưa có",   color: "bg-gray-100 text-gray-500" },
];

export default function ReconciliationPage() {
  const [data, setData] = useState<ReconciliationResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [syncingBros, setSyncingBros] = useState(false);
  const [filter, setFilter] = useState<FilterTab>("all");
  const [search, setSearch] = useState("");

  const load = useCallback(async (skipShopify = false) => {
    setLoading(true);
    try {
      const url = skipShopify ? "/api/reconciliation?skipShopify=1" : "/api/reconciliation";
      const res = await fetch(url);
      if (!res.ok) throw new Error("Lỗi tải dữ liệu");
      const d: ReconciliationResponse = await res.json();
      setData(d);
    } catch {
      toast.error("Không tải được dữ liệu so khớp");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function syncBros() {
    setSyncingBros(true);
    try {
      const res = await fetch("/api/sync/bros", { method: "POST" });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Lỗi sync Bros");
      toast.success(`Đã sync ${d.syncedRows ?? 0} SKU từ Bros sheet ✓`);
      await load(); // reload with fresh Bros data
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Lỗi sync Bros");
    } finally {
      setSyncingBros(false);
    }
  }

  // ── Filter & Search ────────────────────────────────────────────────────────
  const filtered = (data?.items ?? []).filter((item) => {
    const matchFilter = filter === "all" || item.status === filter;
    const q = search.toLowerCase().trim();
    const matchSearch = !q || [item.name, item.nameVi, item.skuShopify, item.skuAmz, item.skuBros, item.category]
      .some((v) => v?.toLowerCase().includes(q));
    return matchFilter && matchSearch;
  });

  const s = data?.summary;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">So khớp tồn kho</h1>
          <p className="text-sm text-gray-500">
            So sánh Shopify (live) vs Bros warehouse vs App DB để phát hiện chênh lệch
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={syncBros}
            disabled={syncingBros || loading}
            className="border-blue-200 text-blue-700 hover:bg-blue-50 gap-1.5"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${syncingBros ? "animate-spin" : ""}`} />
            {syncingBros ? "Đang sync Bros..." : "Sync Bros"}
          </Button>
          <Button
            size="sm"
            onClick={() => load(false)}
            disabled={loading}
            className="bg-green-600 hover:bg-green-700 gap-1.5"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            {loading ? "Đang tải..." : "Làm mới"}
          </Button>
        </div>
      </div>

      {/* Info banner */}
      {data && (
        <div className="flex items-center gap-6 rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-xs text-gray-500 flex-wrap">
          <span className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-blue-400" />
            Bros sync:{" "}
            <strong className="text-gray-700">{formatRelativeTime(data.summary.newestBrosSyncedAt)}</strong>
          </span>
          <span className="flex items-center gap-1.5">
            <Package className="h-3.5 w-3.5 text-green-400" />
            Shopify: <strong className="text-gray-700">{data.shopifyFetched ? "live ✓" : "không kết nối"}</strong>
          </span>
          <span className="text-gray-400">
            Tạo lúc {new Date(data.generatedAt).toLocaleTimeString("vi-VN")}
          </span>
        </div>
      )}

      {/* Stats cards */}
      {s && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <Card className="p-4 text-center">
            <p className="text-2xl font-bold text-gray-800">{s.total}</p>
            <p className="text-xs text-gray-500 mt-1">Tổng sản phẩm</p>
          </Card>
          <Card className="p-4 text-center border-green-100 bg-green-50/40">
            <p className="text-2xl font-bold text-green-700">{s.ok}</p>
            <p className="text-xs text-gray-500 mt-1">✅ Khớp hoàn toàn</p>
          </Card>
          <Card className="p-4 text-center border-amber-100 bg-amber-50/40">
            <p className="text-2xl font-bold text-amber-700">{s.warning}</p>
            <p className="text-xs text-gray-500 mt-1">⚠️ Lệch nhẹ (≤5)</p>
          </Card>
          <Card className="p-4 text-center border-red-100 bg-red-50/40">
            <p className="text-2xl font-bold text-red-600">{s.critical}</p>
            <p className="text-xs text-gray-500 mt-1">❌ Lệch lớn (&gt;5)</p>
          </Card>
          <Card className="p-4 text-center">
            <p className="text-2xl font-bold text-gray-400">{s.no_data}</p>
            <p className="text-xs text-gray-500 mt-1">❓ Chưa có data</p>
          </Card>
        </div>
      )}

      {/* Filter + Search */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-1 flex-wrap">
          {FILTER_TABS.map((tab) => {
            const count = tab.key === "all" ? (data?.items.length ?? 0) : (data?.summary[tab.key] ?? 0);
            return (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${
                  filter === tab.key
                    ? tab.color + " ring-2 ring-offset-1 ring-current/30"
                    : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                }`}
              >
                {tab.label} <span className="ml-1 opacity-70">({count})</span>
              </button>
            );
          })}
        </div>
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
          <Input
            placeholder="Tìm tên, SKU..."
            className="pl-8 h-8 text-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {filtered.length !== (data?.items.length ?? 0) && (
          <span className="text-xs text-gray-400">{filtered.length} / {data?.items.length} sản phẩm</span>
        )}
      </div>

      {/* Table */}
      {loading && !data ? (
        <Card className="flex h-48 items-center justify-center gap-3">
          <RefreshCw className="h-5 w-5 animate-spin text-green-600" />
          <span className="text-gray-500 text-sm">Đang tải dữ liệu từ Shopify + Bros + App...</span>
        </Card>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 min-w-[200px]">Sản phẩm</th>
                  <th className="px-3 py-3 text-center font-medium text-gray-500 whitespace-nowrap">
                    <span className="text-green-700">Shopify</span>
                    <span className="block text-[10px] font-normal text-gray-400">live qty</span>
                  </th>
                  <th className="px-3 py-3 text-center font-medium text-gray-500 whitespace-nowrap">
                    <span className="text-blue-700">Bros</span>
                    <span className="block text-[10px] font-normal text-gray-400">kho thực tế</span>
                  </th>
                  <th className="px-3 py-3 text-center font-medium text-gray-500 whitespace-nowrap">
                    <span className="text-amber-700">Đang về</span>
                    <span className="block text-[10px] font-normal text-gray-400">VN→US</span>
                  </th>
                  <th className="px-3 py-3 text-center font-medium text-gray-500 whitespace-nowrap">
                    <span className="text-gray-700">Đã bán</span>
                    <span className="block text-[10px] font-normal text-gray-400">Shopify orders</span>
                  </th>
                  <th className="px-3 py-3 text-center font-medium text-gray-500 whitespace-nowrap">
                    <span className="text-gray-800">Thực tế</span>
                    <span className="block text-[10px] font-normal text-gray-400">Bros ?? tính toán</span>
                  </th>
                  <th className="px-3 py-3 text-center font-medium text-gray-500 whitespace-nowrap">
                    Chênh lệch
                    <span className="block text-[10px] font-normal text-gray-400">Shopify - Thực tế</span>
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 min-w-[160px]">Trạng thái / Phương án</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-gray-400">
                      Không tìm thấy sản phẩm nào
                    </td>
                  </tr>
                ) : filtered.map((item) => (
                  <tr key={item.id} className={`hover:bg-gray-50/80 ${
                    item.status === "critical" ? "bg-red-50/30" :
                    item.status === "warning"  ? "bg-amber-50/20" : ""
                  }`}>
                    {/* Product */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        {item.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={item.imageUrl} alt={item.name}
                            className="h-8 w-8 rounded-md object-cover shrink-0 border border-gray-100" />
                        ) : (
                          <div className="h-8 w-8 rounded-md bg-gray-100 shrink-0 flex items-center justify-center">
                            <Package className="h-3.5 w-3.5 text-gray-300" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <a href={`/products/${item.id}`} className="font-medium text-gray-900 hover:text-green-600 hover:underline block leading-tight truncate max-w-[180px]">
                            {item.nameVi || item.name}
                          </a>
                          <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                            {item.skuShopify && (
                              <span className="font-mono text-[10px] text-gray-400">{item.skuShopify}</span>
                            )}
                            {item.category && (
                              <span className="text-[10px] text-gray-400 bg-gray-100 rounded px-1">{item.category}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Shopify qty */}
                    <td className="px-3 py-3 text-center">
                      <QtyCell qty={item.shopifyQty} fallback={!data?.shopifyFetched ? "N/A" : "—"} />
                    </td>

                    {/* Bros qty */}
                    <td className="px-3 py-3 text-center">
                      <div>
                        <QtyCell qty={item.brosQty} />
                        {item.brosSyncedAt && (
                          <p className="text-[10px] text-gray-400 mt-0.5">{formatRelativeTime(item.brosSyncedAt)}</p>
                        )}
                      </div>
                    </td>

                    {/* In transit */}
                    <td className="px-3 py-3 text-center">
                      {item.inTransitQty > 0 ? (
                        <span className="text-amber-600 font-medium">{item.inTransitQty}</span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>

                    {/* Sold */}
                    <td className="px-3 py-3 text-center text-gray-600">{item.soldQty || <span className="text-gray-300">—</span>}</td>

                    {/* Actual stock */}
                    <td className="px-3 py-3 text-center">
                      <span className={`font-semibold ${item.actualStock === 0 ? "text-red-500" : "text-gray-800"}`}>
                        {item.actualStock}
                      </span>
                      {item.brosQty === null && (
                        <p className="text-[10px] text-gray-400">tính toán</p>
                      )}
                    </td>

                    {/* Diff */}
                    <td className="px-3 py-3 text-center">
                      <DiffCell diff={item.shopifyDiff} />
                      {item.shopifyDiff !== null && item.shopifyDiff !== 0 && (
                        <div className="flex items-center justify-center gap-0.5 mt-0.5 text-[10px] text-gray-400">
                          {item.shopifyDiff > 0
                            ? <><ArrowRight className="h-2.5 w-2.5 rotate-90 text-amber-400" />Shopify thừa</>
                            : <><ArrowRight className="h-2.5 w-2.5 -rotate-90 text-red-400" />Shopify thiếu</>
                          }
                        </div>
                      )}
                    </td>

                    {/* Status + Recommendation */}
                    <td className="px-4 py-3">
                      <div className="space-y-1">
                        <StatusBadge status={item.status} />
                        {item.status !== "ok" && (
                          <p className="text-[11px] text-gray-500 leading-snug max-w-[220px]">
                            {item.recommendation}
                          </p>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 text-xs text-gray-500 space-y-1.5">
        <p className="font-semibold text-gray-600 mb-2">📖 Giải thích các cột</p>
        <div className="grid gap-1 sm:grid-cols-2">
          <p><span className="text-green-700 font-medium">Shopify (live)</span>: số lượng Shopify đang hiển thị, lấy trực tiếp từ API</p>
          <p><span className="text-blue-700 font-medium">Bros</span>: tồn kho thực tế tại kho Bros — từ lần sync Bros gần nhất</p>
          <p><span className="text-amber-700 font-medium">Đang về</span>: đã mua ở VN nhưng chưa ship hoặc chưa đến US</p>
          <p><span className="font-medium">Thực tế</span>: ưu tiên dùng Bros qty; nếu không có dùng (Đã về kho - Đã bán)</p>
          <p><span className="font-medium">Chênh lệch</span>: Shopify - Thực tế. Dương (+) = Shopify thừa; Âm (-) = Shopify thiếu</p>
          <p><span className="text-red-600 font-medium">Lệch lớn</span>: chênh lệch &gt;5 gói, cần kiểm tra ngay</p>
        </div>
      </div>
    </div>
  );
}
