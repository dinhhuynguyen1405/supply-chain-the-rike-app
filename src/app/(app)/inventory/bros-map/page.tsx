"use client";
import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  RefreshCw, CheckCircle2, AlertCircle, Plus, Link2, Unlink,
  Search, Zap, Package, ArrowLeft,
} from "lucide-react";
import Link from "next/link";

interface BrosItem {
  sku: string;
  description: string | null;
  inStock: number;
  inStockNew: number;
  received: number;
  shipped: number;
  waiting: number;
  lastSyncedAt: string | null;
  matched: { id: string; name: string; nameVi: string | null; skuShopify: string | null } | null;
  suggestions: { id: string; name: string; nameVi: string | null; skuShopify: string | null; score: number }[];
}

interface Stats { total: number; matched: number; unmatched: number; withSuggestions: number }

type FilterMode = "all" | "matched" | "unmatched" | "suggestions";

export default function BrosMapPage() {
  const [items, setItems] = useState<BrosItem[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, matched: 0, unmatched: 0, withSuggestions: 0 });
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [autoMapping, setAutoMapping] = useState(false);
  const [filter, setFilter] = useState<FilterMode>("all");
  const [search, setSearch] = useState("");
  const [linkingId, setLinkingId] = useState<string | null>(null);
  const [allProducts, setAllProducts] = useState<{ id: string; name: string; nameVi: string | null; skuShopify: string | null }[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [expandedSku, setExpandedSku] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/inventory/bros-map");
      const data = await res.json();
      setItems(data.items ?? []);
      setStats(data.stats ?? { total: 0, matched: 0, unmatched: 0, withSuggestions: 0 });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    fetch("/api/products?limit=5000")
      .then((r) => r.json())
      .then((d) => setAllProducts(Array.isArray(d) ? d : (d.products ?? [])));
  }, []);

  async function syncBros() {
    setSyncing(true);
    try {
      const res = await fetch("/api/sync/bros", { method: "POST" });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Lỗi sync Bros");
      toast.success(`Đã sync ${d.syncedRows ?? 0} SKU từ Bros sheet ✓`);
      await load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Lỗi sync Bros");
    } finally {
      setSyncing(false);
    }
  }

  async function autoMap() {
    setAutoMapping(true);
    try {
      const res = await fetch("/api/inventory/bros-map", { method: "PUT" });
      const d = await res.json();
      if (d.autoMapped > 0) {
        toast.success(`✅ Đã tự động map ${d.autoMapped} SKU Bros vào sản phẩm!`);
        await load();
      } else {
        toast.info("Không tìm thấy match đủ tin cậy để tự động map thêm (ngưỡng ≥60%)");
      }
    } finally {
      setAutoMapping(false);
    }
  }

  async function linkSku(sku: string, productId: string) {
    const res = await fetch("/api/inventory/bros-map", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "link", sku, productId }),
    });
    if (res.ok) {
      toast.success("Đã gắn SKU Bros vào sản phẩm ✓");
      setLinkingId(null);
      setProductSearch("");
      await load();
    } else toast.error("Lỗi gắn SKU");
  }

  async function unlinkSku(sku: string, productId: string) {
    if (!confirm(`Bỏ liên kết SKU "${sku}" khỏi sản phẩm?`)) return;
    const res = await fetch("/api/inventory/bros-map", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "unlink", sku, productId }),
    });
    if (res.ok) { toast.success("Đã bỏ liên kết"); await load(); }
    else toast.error("Lỗi bỏ liên kết");
  }

  async function createProduct(sku: string, description: string | null) {
    if (!confirm(`Tạo sản phẩm mới từ Bros item "${description ?? sku}"?`)) return;
    const res = await fetch("/api/inventory/bros-map", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "create", sku, description }),
    });
    if (res.ok) {
      toast.success(`Đã tạo sản phẩm mới và gắn SKU Bros ✓`);
      await load();
    } else toast.error("Lỗi tạo sản phẩm");
  }

  const filtered = items.filter((item) => {
    if (filter === "matched" && !item.matched) return false;
    if (filter === "unmatched" && item.matched) return false;
    if (filter === "suggestions" && (item.matched || item.suggestions.length === 0)) return false;
    if (search) {
      const q = search.toLowerCase();
      return item.sku.toLowerCase().includes(q) || (item.description ?? "").toLowerCase().includes(q);
    }
    return true;
  });

  const filteredProducts = productSearch.trim()
    ? allProducts.filter((p) => {
        const q = productSearch.toLowerCase();
        return (p.nameVi ?? p.name).toLowerCase().includes(q) || (p.skuShopify ?? "").toLowerCase().includes(q);
      }).slice(0, 8)
    : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4 flex-wrap">
        <Link href="/inventory" className="mt-1 text-gray-400 hover:text-gray-700 transition-colors">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">Bros SKU Mapping</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Gán mã SKU kho Bros vào từng sản phẩm trong database
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs"
            onClick={syncBros} disabled={syncing}>
            <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Đang sync..." : "Sync Bros Sheet"}
          </Button>
          <Button size="sm" className="h-8 gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700"
            onClick={autoMap} disabled={autoMapping || stats.unmatched === 0}>
            <Zap className="h-3.5 w-3.5" />
            {autoMapping ? "Đang tự động map..." : "Auto-map (AI)"}
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Tổng Bros SKUs", value: stats.total, color: "text-gray-900" },
          { label: "Đã match", value: stats.matched, color: "text-emerald-700" },
          { label: "Chưa match", value: stats.unmatched, color: "text-red-600" },
          { label: "Có gợi ý", value: stats.withSuggestions, color: "text-amber-600" },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-gray-100 bg-white p-4">
            <p className="text-xs text-gray-400">{s.label}</p>
            <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
          <Input
            className="h-8 pl-8 w-52 text-sm"
            placeholder="Tìm SKU hoặc tên..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-1">
          {([
            { key: "all", label: "Tất cả" },
            { key: "matched", label: "✅ Đã match" },
            { key: "unmatched", label: "❌ Chưa match" },
            { key: "suggestions", label: "💡 Có gợi ý" },
          ] as const).map(({ key, label }) => (
            <button key={key} onClick={() => setFilter(key)}
              className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${filter === key ? "bg-gray-900 text-white" : "bg-white border border-gray-200 text-gray-600 hover:border-gray-300"}`}>
              {label}
            </button>
          ))}
        </div>
        <span className="ml-auto text-xs text-gray-400">{filtered.length} items</span>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex h-48 items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-gray-700" />
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-gray-100 bg-white p-12 text-center">
          <Package className="mx-auto h-10 w-10 text-gray-200 mb-3" />
          <p className="text-gray-500 font-medium">Chưa có dữ liệu kho Bros</p>
          <p className="text-sm text-gray-400 mt-1">Bấm &ldquo;Sync Bros Sheet&rdquo; để tải dữ liệu từ Google Sheets</p>
          <Button className="mt-4 bg-gray-900 hover:bg-gray-800" onClick={syncBros} disabled={syncing}>
            <RefreshCw className={`mr-2 h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
            Sync Bros Sheet ngay
          </Button>
        </div>
      ) : (
        <div className="rounded-xl border border-gray-100 bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/70">
                <th className="px-4 py-3 text-left font-medium text-gray-500 text-xs w-8">#</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500 text-xs">SKU Bros</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500 text-xs">Tên sản phẩm (Bros)</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500 text-xs">Tồn kho</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500 text-xs">Sản phẩm DB</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500 text-xs">Gợi ý</th>
                <th className="px-4 py-3 text-center font-medium text-gray-500 text-xs w-32">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((item, idx) => (
                <>
                  <tr key={item.sku} className={`hover:bg-gray-50/50 transition-colors ${item.matched ? "" : "bg-red-50/20"}`}>
                    <td className="px-4 py-3 text-xs text-gray-400">{idx + 1}</td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs bg-gray-100 rounded px-1.5 py-0.5 text-gray-700">{item.sku}</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 max-w-[180px] truncate" title={item.description ?? ""}>
                      {item.description ?? <span className="text-gray-300 italic">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={`text-sm font-semibold ${item.inStock > 0 ? "text-gray-900" : "text-gray-300"}`}>
                        {item.inStock}
                      </span>
                      {item.waiting > 0 && (
                        <p className="text-[10px] text-blue-500">+{item.waiting} đang về</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {item.matched ? (
                        <div className="flex items-center gap-1.5">
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                          <div>
                            <p className="text-sm font-medium text-gray-900">{item.matched.nameVi ?? item.matched.name}</p>
                            {item.matched.skuShopify && (
                              <p className="text-[10px] text-gray-400 font-mono">{item.matched.skuShopify}</p>
                            )}
                          </div>
                        </div>
                      ) : (
                        <span className="flex items-center gap-1 text-xs text-red-400">
                          <AlertCircle className="h-3.5 w-3.5" /> Chưa gắn
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {!item.matched && item.suggestions.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {item.suggestions.slice(0, 2).map((s) => (
                            <button
                              key={s.id}
                              onClick={() => linkSku(item.sku, s.id)}
                              title={`Match ${Math.round(s.score * 100)}% — Bấm để gắn`}
                              className="flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] text-amber-800 hover:bg-amber-100 transition-colors"
                            >
                              <span>{s.nameVi ?? s.name}</span>
                              <span className="text-amber-500 font-semibold">{Math.round(s.score * 100)}%</span>
                            </button>
                          ))}
                          {item.suggestions.length > 2 && (
                            <button
                              onClick={() => setExpandedSku(expandedSku === item.sku ? null : item.sku)}
                              className="text-[11px] text-gray-400 hover:text-gray-600"
                            >
                              +{item.suggestions.length - 2} khác
                            </button>
                          )}
                        </div>
                      ) : item.matched ? (
                        <span className="text-[11px] text-gray-300">—</span>
                      ) : (
                        <span className="text-[11px] text-gray-300 italic">Không tìm thấy gợi ý</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        {item.matched ? (
                          <button
                            onClick={() => unlinkSku(item.sku, item.matched!.id)}
                            className="p-1.5 rounded hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors"
                            title="Bỏ liên kết"
                          >
                            <Unlink className="h-3.5 w-3.5" />
                          </button>
                        ) : (
                          <>
                            <button
                              onClick={() => { setLinkingId(linkingId === item.sku ? null : item.sku); setProductSearch(""); }}
                              className="p-1.5 rounded hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition-colors"
                              title="Gắn vào sản phẩm"
                            >
                              <Link2 className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => createProduct(item.sku, item.description)}
                              className="p-1.5 rounded hover:bg-emerald-50 text-gray-400 hover:text-emerald-600 transition-colors"
                              title="Tạo sản phẩm mới"
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>

                  {/* Expanded suggestions row */}
                  {expandedSku === item.sku && item.suggestions.length > 2 && (
                    <tr key={`${item.sku}-expand`} className="bg-amber-50/40">
                      <td />
                      <td colSpan={6} className="px-4 py-2">
                        <div className="flex flex-wrap gap-1.5">
                          {item.suggestions.map((s) => (
                            <button
                              key={s.id}
                              onClick={() => linkSku(item.sku, s.id)}
                              className="flex items-center gap-1.5 rounded-full border border-amber-200 bg-white px-2.5 py-1 text-xs text-amber-900 hover:bg-amber-100 transition-colors"
                            >
                              <span className="font-medium">{s.nameVi ?? s.name}</span>
                              {s.skuShopify && <span className="font-mono text-gray-400">{s.skuShopify}</span>}
                              <span className="bg-amber-200 text-amber-800 rounded-full px-1.5 py-0.5 text-[10px] font-bold">
                                {Math.round(s.score * 100)}%
                              </span>
                            </button>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}

                  {/* Manual link dropdown */}
                  {linkingId === item.sku && (
                    <tr key={`${item.sku}-link`} className="bg-blue-50/40">
                      <td />
                      <td colSpan={6} className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Input
                            className="h-8 text-sm w-64"
                            placeholder="Tìm sản phẩm trong DB..."
                            value={productSearch}
                            onChange={(e) => setProductSearch(e.target.value)}
                            autoFocus
                          />
                          <button onClick={() => { setLinkingId(null); setProductSearch(""); }}
                            className="text-xs text-gray-400 hover:text-gray-700">Huỷ</button>
                        </div>
                        {filteredProducts.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {filteredProducts.map((p) => (
                              <button
                                key={p.id}
                                onClick={() => linkSku(item.sku, p.id)}
                                className="flex items-center gap-1.5 rounded-full border border-blue-200 bg-white px-2.5 py-1 text-xs text-blue-900 hover:bg-blue-50 transition-colors"
                              >
                                {p.nameVi ?? p.name}
                                {p.skuShopify && <span className="font-mono text-gray-400">{p.skuShopify}</span>}
                              </button>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>

          {filtered.length === 0 && (
            <div className="py-10 text-center text-sm text-gray-400">Không có kết quả</div>
          )}
        </div>
      )}
    </div>
  );
}
