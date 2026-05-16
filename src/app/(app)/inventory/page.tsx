"use client";
import { useEffect, useMemo, useState, useCallback } from "react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle, Package, RefreshCw, Save, Search,
  Home, Warehouse, ExternalLink, Leaf, Link2, ChevronDown, ChevronUp,
  GitCompareArrows, CheckCircle2, XCircle, HelpCircle, ArrowRight, Clock,
} from "lucide-react";
import Link from "next/link";

// ── Types: Stock ──────────────────────────────────────────────────────────────

interface StockItem {
  id: string;
  name: string;
  nameVi: string | null;
  skuShopify: string | null;
  imageUrl: string | null;
  priceUsd: number | null;
  nhungQty: number;
  brosQty: number;
  vnQty: number;
  total: number;
}

interface UnmatchedBrosItem {
  sku: string;
  description: string | null;
  inStock: number;
  unit: string | null;
  suggestions: { id: string; name: string; nameVi: string | null; skuShopify: string | null }[];
}

// ── Types: Reconciliation ─────────────────────────────────────────────────────

interface ReconciliationItem {
  id: string;
  name: string;
  nameVi: string | null;
  skuShopify: string | null;
  skuAmz: string | null;
  skuBros: string | null;
  unit: string;
  category: string | null;
  imageUrl: string | null;
  shopifyQty: number | null;
  brosQty: number | null;
  inTransitQty: number;
  arrivedQty: number;
  soldQty: number;
  actualStock: number;
  shopifyDiff: number | null;
  status: "ok" | "warning" | "critical" | "no_data";
  recommendation: string;
  brosSyncedAt: string | null;
}

interface ReconciliationSummary {
  total: number;
  ok: number;
  warning: number;
  critical: number;
  no_data: number;
  hasShopifyData: boolean;
  oldestBrosSyncedAt: string | null;
  newestBrosSyncedAt: string | null;
}

interface ReconciliationResponse {
  items: ReconciliationItem[];
  summary: ReconciliationSummary;
  shopifyFetched: boolean;
  generatedAt: string;
}

type ReconciliationFilterTab = "all" | "critical" | "warning" | "ok" | "no_data";

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
  return <span className={`font-semibold ${color}`}>{sign}{diff}</span>;
}

function QtyCell({ qty, fallback = "—" }: { qty: number | null; fallback?: string }) {
  if (qty === null) return <span className="text-gray-300 text-xs">{fallback}</span>;
  return <span className={qty === 0 ? "text-gray-400" : "text-gray-800 font-medium"}>{qty}</span>;
}

const RECON_FILTER_TABS: { key: ReconciliationFilterTab; label: string; color: string }[] = [
  { key: "all",      label: "Tất cả",      color: "bg-gray-100 text-gray-700" },
  { key: "critical", label: "❌ Lệch lớn", color: "bg-red-100 text-red-700" },
  { key: "warning",  label: "⚠️ Lệch nhẹ", color: "bg-amber-100 text-amber-700" },
  { key: "ok",       label: "✅ Khớp",      color: "bg-green-100 text-green-700" },
  { key: "no_data",  label: "❓ Chưa có",   color: "bg-gray-100 text-gray-500" },
];

// ── Main Component ────────────────────────────────────────────────────────────

type ActiveTab = "stock" | "reconciliation";

export default function InventoryPage() {
  // ── Tab ───────────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<ActiveTab>("stock");

  // ── Stock state ───────────────────────────────────────────────────────────
  const [items, setItems] = useState<StockItem[]>([]);
  const [edits, setEdits] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [initing, setIniting] = useState(false);
  const [search, setSearch] = useState("");
  const [filterUnmapped, setFilterUnmapped] = useState(false);
  const [shopifyImages, setShopifyImages] = useState<Record<string, string>>({});
  const [unmatchedBros, setUnmatchedBros] = useState<UnmatchedBrosItem[]>([]);
  const [showUnmatched, setShowUnmatched] = useState(false);
  const [linkingSkus, setLinkingSkus] = useState<Record<string, string>>({});

  // ── Reconciliation state ──────────────────────────────────────────────────
  const [reconData, setReconData] = useState<ReconciliationResponse | null>(null);
  const [reconLoading, setReconLoading] = useState(false);
  const [syncingBros, setSyncingBros] = useState(false);
  const [reconFilter, setReconFilter] = useState<ReconciliationFilterTab>("all");
  const [reconSearch, setReconSearch] = useState("");

  // ── Stock loaders ─────────────────────────────────────────────────────────

  async function load() {
    setLoading(true);
    try {
      const data = await fetch("/api/inventory/nhung").then((r) => r.json());
      setItems(data);
      setEdits({});
    } catch { toast.error("Không tải được tồn kho"); }
    finally { setLoading(false); }
  }

  async function loadImages() {
    try {
      const map = await fetch("/api/shopify/image-map").then((r) => r.json());
      if (typeof map === "object" && map !== null) setShopifyImages(map);
    } catch { /* optional */ }
  }

  async function loadUnmatchedBros() {
    try {
      const data = await fetch("/api/inventory/bros-unmatched").then((r) => r.json());
      if (Array.isArray(data)) setUnmatchedBros(data);
    } catch { /* optional */ }
  }

  useEffect(() => { load(); loadImages(); loadUnmatchedBros(); }, []);

  // ── Reconciliation loaders ────────────────────────────────────────────────

  const loadRecon = useCallback(async (skipShopify = false) => {
    setReconLoading(true);
    try {
      const url = skipShopify ? "/api/reconciliation?skipShopify=1" : "/api/reconciliation";
      const res = await fetch(url);
      if (!res.ok) throw new Error("Lỗi tải dữ liệu");
      const d: ReconciliationResponse = await res.json();
      setReconData(d);
    } catch {
      toast.error("Không tải được dữ liệu so khớp");
    } finally {
      setReconLoading(false);
    }
  }, []);

  // Auto-load reconciliation when switching to that tab
  useEffect(() => {
    if (activeTab === "reconciliation" && !reconData && !reconLoading) {
      loadRecon();
    }
  }, [activeTab, reconData, reconLoading, loadRecon]);

  async function syncBros() {
    setSyncingBros(true);
    try {
      const res = await fetch("/api/sync/bros", { method: "POST" });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Lỗi sync Bros");
      toast.success(`Đã sync ${d.syncedRows ?? 0} SKU từ Bros sheet ✓`);
      // Reload recon + main stock (brosQty changes)
      await Promise.all([loadRecon(), load(), loadUnmatchedBros()]);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Lỗi sync Bros");
    } finally {
      setSyncingBros(false);
    }
  }

  // ── Stock actions ─────────────────────────────────────────────────────────

  async function save() {
    const changed = Object.entries(edits).map(([id, nhungQty]) => ({ id, nhungQty }));
    if (!changed.length) { toast("Chưa có thay đổi nào"); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/inventory/nhung", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(changed),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      if (data.shopifyErrors?.length) {
        toast.warning(`Đã lưu, lỗi push Shopify: ${data.shopifyErrors.join(", ")}`);
      } else {
        toast.success(`Đã lưu ${changed.length} sản phẩm → Shopify ✓`);
      }
      await load();
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : "Lỗi lưu"); }
    finally { setSaving(false); }
  }

  async function initFromShopify() {
    if (!confirm("Copy số lượng hiện tại từ Shopify vào Kho Nhung? Thao tác này sẽ ghi đè nhungQty.")) return;
    setIniting(true);
    try {
      const res = await fetch("/api/inventory/nhung", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(data.message ?? "Đã khởi tạo từ Shopify");
      await load();
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : "Lỗi khởi tạo"); }
    finally { setIniting(false); }
  }

  async function linkBrosSku(sku: string, productId: string) {
    try {
      const res = await fetch("/api/inventory/bros-unmatched", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sku, productId, field: "skuBros" }),
      });
      if (!res.ok) throw new Error("Lỗi link SKU");
      toast.success(`Đã gắn SKU ${sku} vào sản phẩm ✓`);
      await Promise.all([load(), loadUnmatchedBros()]);
      setLinkingSkus((prev) => { const n = { ...prev }; delete n[sku]; return n; });
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : "Lỗi"); }
  }

  // ── Derived values ────────────────────────────────────────────────────────

  const hasEdits = Object.keys(edits).length > 0;

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return items.filter((p) => {
      if (filterUnmapped && p.skuShopify) return false;
      return (
        (p.nameVi ?? "").toLowerCase().includes(q) ||
        p.name.toLowerCase().includes(q) ||
        (p.skuShopify ?? "").toLowerCase().includes(q)
      );
    });
  }, [items, search, filterUnmapped]);

  const nhungTotal   = items.reduce((s, p) => s + (edits[p.id] ?? p.nhungQty), 0);
  const brosTotal    = items.reduce((s, p) => s + p.brosQty, 0);
  const vnTotal      = items.reduce((s, p) => s + p.vnQty, 0);
  const shopifyTotal = nhungTotal + brosTotal;
  const lowCount     = items.filter((p) => { const qty = (edits[p.id] ?? p.nhungQty) + p.brosQty; return qty > 0 && qty <= 10; }).length;
  const outCount     = items.filter((p) => { const qty = (edits[p.id] ?? p.nhungQty) + p.brosQty; return qty === 0; }).length;

  const reconFiltered = useMemo(() => {
    return (reconData?.items ?? []).filter((item) => {
      const matchFilter = reconFilter === "all" || item.status === reconFilter;
      const q = reconSearch.toLowerCase().trim();
      const matchSearch = !q || [item.name, item.nameVi, item.skuShopify, item.skuAmz, item.skuBros, item.category]
        .some((v) => v?.toLowerCase().includes(q));
      return matchFilter && matchSearch;
    });
  }, [reconData, reconFilter, reconSearch]);

  const s = reconData?.summary;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tồn kho</h1>
          <p className="text-sm text-gray-500">Kho VN → Kho Nhung + Kho Bros → Shopify inventory</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {activeTab === "stock" ? (
            <>
              <Button size="sm" variant="outline" onClick={load} disabled={loading} className="text-xs">
                <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
                Làm mới
              </Button>
              <Button size="sm" variant="outline" onClick={initFromShopify} disabled={initing}
                className="text-xs border-blue-200 text-blue-700 hover:bg-blue-50">
                <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${initing ? "animate-spin" : ""}`} />
                {initing ? "Đang lấy..." : "Khởi tạo từ Shopify"}
              </Button>
              {hasEdits && (
                <Button size="sm" onClick={save} disabled={saving}
                  className="bg-green-600 hover:bg-green-700 text-white">
                  <Save className="mr-1.5 h-3.5 w-3.5" />
                  {saving ? "Đang push..." : `Lưu ${Object.keys(edits).length} thay đổi → Shopify`}
                </Button>
              )}
            </>
          ) : (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={syncBros}
                disabled={syncingBros || reconLoading}
                className="border-purple-200 text-purple-700 hover:bg-purple-50 gap-1.5"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${syncingBros ? "animate-spin" : ""}`} />
                {syncingBros ? "Đang sync Bros..." : "Sync Kho Bros"}
              </Button>
              <Button
                size="sm"
                onClick={() => loadRecon(false)}
                disabled={reconLoading}
                className="bg-green-600 hover:bg-green-700 gap-1.5"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${reconLoading ? "animate-spin" : ""}`} />
                {reconLoading ? "Đang tải..." : "Làm mới"}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card className="p-4 border-amber-100 bg-amber-50">
          <div className="flex items-center gap-2 mb-1">
            <Leaf className="h-4 w-4 text-amber-500" />
            <span className="text-xs font-medium text-amber-600">Kho VN</span>
          </div>
          <p className="text-2xl font-bold text-amber-700">{Math.round(vnTotal)}</p>
          <p className="text-xs text-amber-400 mt-0.5">gói đã sản xuất</p>
        </Card>
        <Card className="p-4 border-orange-100 bg-orange-50">
          <div className="flex items-center gap-2 mb-1">
            <Home className="h-4 w-4 text-orange-500" />
            <span className="text-xs font-medium text-orange-600">Kho Nhung</span>
          </div>
          <p className="text-2xl font-bold text-orange-700">{nhungTotal}</p>
          <p className="text-xs text-orange-400 mt-0.5">gói tại US</p>
        </Card>
        <Card className="p-4 border-purple-100 bg-purple-50">
          <div className="flex items-center gap-2 mb-1">
            <Warehouse className="h-4 w-4 text-purple-500" />
            <span className="text-xs font-medium text-purple-600">Kho Bros</span>
          </div>
          <p className="text-2xl font-bold text-purple-700">{brosTotal}</p>
          <p className="text-xs text-purple-400 mt-0.5">gói tại US</p>
        </Card>
        <Card className="p-4 border-green-100 bg-green-50">
          <div className="flex items-center gap-2 mb-1">
            <ExternalLink className="h-4 w-4 text-green-500" />
            <span className="text-xs font-medium text-green-600">Shopify</span>
          </div>
          <p className="text-2xl font-bold text-green-700">{shopifyTotal}</p>
          <p className="text-xs text-green-400 mt-0.5">= Nhung + Bros</p>
        </Card>
        <Card className={`p-4 ${lowCount + outCount > 0 ? "border-red-100 bg-red-50" : "border-gray-100"}`}>
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className={`h-4 w-4 ${lowCount + outCount > 0 ? "text-red-500" : "text-gray-300"}`} />
            <span className={`text-xs font-medium ${lowCount + outCount > 0 ? "text-red-600" : "text-gray-400"}`}>
              Cần nhập
            </span>
          </div>
          <p className={`text-2xl font-bold ${lowCount + outCount > 0 ? "text-red-700" : "text-gray-300"}`}>
            {lowCount + outCount}
          </p>
          <p className={`text-xs mt-0.5 ${lowCount + outCount > 0 ? "text-red-400" : "text-gray-300"}`}>
            {outCount > 0 && `${outCount} hết hàng`}{outCount > 0 && lowCount > 0 && " · "}{lowCount > 0 && `${lowCount} sắp hết`}
          </p>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        <button
          onClick={() => setActiveTab("stock")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "stock"
              ? "border-green-600 text-green-700"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          <Warehouse className="h-4 w-4" />
          Tồn kho
        </button>
        <button
          onClick={() => setActiveTab("reconciliation")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "reconciliation"
              ? "border-purple-600 text-purple-700"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          <GitCompareArrows className="h-4 w-4" />
          So khớp Kho Bros
          {s && (s.critical > 0 || s.warning > 0) && (
            <Badge className={`text-[10px] ${s.critical > 0 ? "bg-red-100 text-red-600" : "bg-amber-100 text-amber-600"}`}>
              {s.critical + s.warning}
            </Badge>
          )}
        </button>
      </div>

      {/* ── TAB: Tồn kho ──────────────────────────────────────────────────────── */}
      {activeTab === "stock" && (
        <>
          {/* Search and Filters */}
          <div className="flex flex-col sm:flex-row gap-4 items-center">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                className="pl-9"
                placeholder="Tìm sản phẩm, SKU..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Button
              variant={filterUnmapped ? "default" : "outline"}
              onClick={() => setFilterUnmapped(!filterUnmapped)}
              className={filterUnmapped ? "bg-amber-600 hover:bg-amber-700" : ""}
            >
              Chưa có mã Shopify
            </Button>
          </div>

          {/* Main inventory table */}
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Sản phẩm</th>
                  <th className="px-4 py-3 text-right font-medium text-amber-600">
                    <span className="flex items-center justify-end gap-1">
                      <Leaf className="h-3 w-3" /> Kho VN
                    </span>
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-orange-600">
                    <span className="flex items-center justify-end gap-1">
                      <Home className="h-3 w-3" /> Kho Nhung
                    </span>
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-purple-600">
                    <span className="flex items-center justify-end gap-1">
                      <Warehouse className="h-3 w-3" /> Kho Bros
                    </span>
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-green-700">
                    <span className="flex items-center justify-end gap-1">
                      <ExternalLink className="h-3 w-3" /> Shopify
                    </span>
                  </th>
                  <th className="px-4 py-3 text-center font-medium text-gray-400">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr><td colSpan={6} className="py-16 text-center text-gray-400">Đang tải...</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={6} className="py-16 text-center text-gray-400">Không tìm thấy sản phẩm</td></tr>
                ) : filtered.map((item) => {
                  const nhungQty = edits[item.id] ?? item.nhungQty;
                  const total    = nhungQty + item.brosQty;
                  const isEdited = edits[item.id] !== undefined;
                  const isLow    = total > 0 && total <= 10;
                  const isOut    = total === 0;

                  return (
                    <tr key={item.id}
                      className={`transition-colors hover:bg-gray-50 ${isEdited ? "bg-amber-50" : isOut ? "bg-red-50/40" : isLow ? "bg-amber-50/40" : ""}`}
                    >
                      {/* Product */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {(() => {
                            const img = item.imageUrl ?? (item.skuShopify ? shopifyImages[item.skuShopify] : null);
                            return img ? (
                              <img src={img} alt={item.name}
                                className="h-10 w-10 rounded-lg object-cover shrink-0 border border-gray-100" />
                            ) : (
                              <div className="h-10 w-10 rounded-lg bg-gray-100 shrink-0 flex items-center justify-center">
                                <Package className="h-4 w-4 text-gray-300" />
                              </div>
                            );
                          })()}
                          <div className="min-w-0">
                            <Link href={`/products/${item.id}`}
                              className="font-medium text-gray-900 hover:text-green-600 hover:underline leading-snug block">
                              {item.nameVi ?? item.name}
                            </Link>
                            {item.nameVi && (
                              <p className="text-xs text-gray-400 truncate max-w-xs">{item.name}</p>
                            )}
                            <div className="flex items-center gap-2 mt-0.5">
                              {item.skuShopify && (
                                <span className="font-mono text-[10px] text-gray-300">{item.skuShopify}</span>
                              )}
                              {item.priceUsd != null && (
                                <span className="text-xs font-semibold text-green-600">${item.priceUsd.toFixed(2)}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Kho VN */}
                      <td className="px-4 py-3 text-right">
                        <span className={`font-semibold text-sm ${item.vnQty > 0 ? "text-amber-600" : "text-gray-200"}`}>
                          {item.vnQty > 0 ? Math.round(item.vnQty) : "—"}
                        </span>
                      </td>

                      {/* Kho Nhung — editable */}
                      <td className="px-4 py-3 text-right">
                        <Input
                          type="number"
                          min={0}
                          className={`h-8 w-24 text-right text-sm font-semibold ml-auto ${isEdited ? "border-amber-400 bg-amber-50 ring-1 ring-amber-300" : ""}`}
                          value={nhungQty}
                          onChange={(e) => {
                            const v = Math.max(0, parseInt(e.target.value) || 0);
                            if (v === item.nhungQty) {
                              setEdits((prev) => { const n = { ...prev }; delete n[item.id]; return n; });
                            } else {
                              setEdits((prev) => ({ ...prev, [item.id]: v }));
                            }
                          }}
                        />
                      </td>

                      {/* Kho Bros — readonly */}
                      <td className="px-4 py-3 text-right">
                        <span className={`font-semibold text-sm ${item.brosQty > 0 ? "text-purple-700" : "text-gray-200"}`}>
                          {item.brosQty > 0 ? item.brosQty : "—"}
                        </span>
                      </td>

                      {/* Shopify = nhung + bros */}
                      <td className="px-4 py-3 text-right">
                        <span className={`text-base font-bold ${isOut ? "text-red-500" : isLow ? "text-amber-600" : "text-green-700"}`}>
                          {total}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3 text-center">
                        {isOut
                          ? <Badge className="bg-red-100 text-red-700 text-xs">Hết hàng</Badge>
                          : isLow
                          ? <Badge className="bg-amber-100 text-amber-700 text-xs">Sắp hết</Badge>
                          : <Badge className="bg-green-100 text-green-700 text-xs">Còn hàng</Badge>
                        }
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Unmatched Bros section */}
          {unmatchedBros.length > 0 && (
            <div className="rounded-xl border border-purple-200 bg-purple-50/30 overflow-hidden">
              <button
                onClick={() => setShowUnmatched(!showUnmatched)}
                className="w-full flex items-center justify-between px-5 py-3.5 text-sm font-semibold text-purple-800 hover:bg-purple-50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Warehouse className="h-4 w-4 text-purple-600" />
                  <span>Kho Bros — Chưa khớp sản phẩm ({unmatchedBros.length} SKU)</span>
                  <Badge className="bg-purple-100 text-purple-700 text-xs">
                    {unmatchedBros.reduce((s, i) => s + i.inStock, 0)} gói
                  </Badge>
                </div>
                {showUnmatched ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>

              {showUnmatched && (
                <div className="border-t border-purple-200">
                  <p className="px-5 py-2.5 text-xs text-purple-600 bg-purple-50">
                    Những SKU này có hàng ở Kho Bros nhưng chưa được gắn vào sản phẩm nào. Chọn sản phẩm tương ứng để khớp.
                  </p>
                  <table className="w-full text-sm">
                    <thead className="bg-purple-50/70 text-xs">
                      <tr>
                        <th className="px-4 py-2 text-left font-medium text-purple-500">SKU Bros</th>
                        <th className="px-4 py-2 text-left font-medium text-purple-500">Tên hàng (Bros)</th>
                        <th className="px-4 py-2 text-right font-medium text-purple-500">Số lượng</th>
                        <th className="px-4 py-2 text-left font-medium text-purple-500">Gắn vào sản phẩm</th>
                        <th className="px-4 py-2" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-purple-100">
                      {unmatchedBros.map((item) => (
                        <tr key={item.sku} className="hover:bg-purple-50/50">
                          <td className="px-4 py-3">
                            <span className="font-mono text-xs text-purple-700 bg-purple-100 px-1.5 py-0.5 rounded">
                              {item.sku}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-700">{item.description ?? "—"}</td>
                          <td className="px-4 py-3 text-right font-semibold text-purple-700">{item.inStock}</td>
                          <td className="px-4 py-3">
                            <select
                              className="w-full max-w-xs rounded-md border border-purple-200 bg-white px-2 py-1.5 text-xs"
                              value={linkingSkus[item.sku] ?? ""}
                              onChange={(e) => setLinkingSkus((prev) => ({ ...prev, [item.sku]: e.target.value }))}
                            >
                              <option value="">
                                {item.suggestions.length > 0 ? `Gợi ý: ${item.suggestions[0].nameVi ?? item.suggestions[0].name}` : "Chọn sản phẩm..."}
                              </option>
                              {item.suggestions.map((s) => (
                                <option key={s.id} value={s.id}>
                                  ★ {s.nameVi ?? s.name}{s.skuShopify ? ` (${s.skuShopify})` : ""}
                                </option>
                              ))}
                              <option disabled>─────────────</option>
                              <option value="__new__">+ Tạo sản phẩm mới...</option>
                            </select>
                          </td>
                          <td className="px-4 py-3">
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs h-7 border-purple-300 text-purple-700 hover:bg-purple-50"
                              disabled={!linkingSkus[item.sku] || linkingSkus[item.sku] === "__new__"}
                              onClick={() => {
                                const pid = linkingSkus[item.sku];
                                if (pid && pid !== "__new__") linkBrosSku(item.sku, pid);
                                else if (pid === "__new__") toast("Tính năng tạo sản phẩm mới — vui lòng tạo ở mục Sản phẩm trước");
                              }}
                            >
                              <Link2 className="mr-1 h-3 w-3" />
                              Gắn SKU
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ── TAB: So khớp Kho Bros ─────────────────────────────────────────────── */}
      {activeTab === "reconciliation" && (
        <>
          {/* Bros sync info banner */}
          {reconData && (
            <div className="flex items-center gap-6 rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-xs text-gray-500 flex-wrap">
              <span className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-purple-400" />
                Bros sync:{" "}
                <strong className="text-gray-700">{formatRelativeTime(reconData.summary.newestBrosSyncedAt)}</strong>
              </span>
              <span className="flex items-center gap-1.5">
                <Package className="h-3.5 w-3.5 text-green-400" />
                Shopify: <strong className="text-gray-700">{reconData.shopifyFetched ? "live ✓" : "không kết nối"}</strong>
              </span>
              <span className="text-gray-400">
                Cập nhật lúc {new Date(reconData.generatedAt).toLocaleTimeString("vi-VN")}
              </span>
            </div>
          )}

          {/* Reconciliation stats */}
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
                <p className="text-xs text-gray-500 mt-1">❓ Chưa có data Bros</p>
              </Card>
            </div>
          )}

          {/* Filter + Search */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex gap-1 flex-wrap">
              {RECON_FILTER_TABS.map((tab) => {
                const count = tab.key === "all" ? (reconData?.items.length ?? 0) : (reconData?.summary[tab.key] ?? 0);
                return (
                  <button
                    key={tab.key}
                    onClick={() => setReconFilter(tab.key)}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${
                      reconFilter === tab.key
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
                value={reconSearch}
                onChange={(e) => setReconSearch(e.target.value)}
              />
            </div>
            {reconFiltered.length !== (reconData?.items.length ?? 0) && (
              <span className="text-xs text-gray-400">{reconFiltered.length} / {reconData?.items.length} sản phẩm</span>
            )}
          </div>

          {/* Reconciliation table */}
          {reconLoading && !reconData ? (
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
                        <span className="text-purple-700">Kho Bros</span>
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
                    {reconFiltered.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-12 text-center text-gray-400">
                          {reconLoading ? "Đang tải..." : "Không tìm thấy sản phẩm nào"}
                        </td>
                      </tr>
                    ) : reconFiltered.map((item) => (
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
                          <QtyCell qty={item.shopifyQty} fallback={!reconData?.shopifyFetched ? "N/A" : "—"} />
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
              <p><span className="text-purple-700 font-medium">Kho Bros</span>: tồn kho thực tế tại kho Bros — từ lần sync Bros gần nhất</p>
              <p><span className="text-amber-700 font-medium">Đang về</span>: đã mua ở VN nhưng chưa ship hoặc chưa đến US</p>
              <p><span className="font-medium">Thực tế</span>: ưu tiên dùng Bros qty; nếu không có dùng (Đã về kho - Đã bán)</p>
              <p><span className="font-medium">Chênh lệch</span>: Shopify - Thực tế. Dương (+) = Shopify thừa; Âm (-) = Shopify thiếu</p>
              <p><span className="text-red-600 font-medium">Lệch lớn</span>: chênh lệch &gt;5 gói, cần kiểm tra ngay</p>
            </div>
          </div>
        </>
      )}

      {/* Floating save bar (stock tab only) */}
      {activeTab === "stock" && hasEdits && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-xl bg-gray-900 px-5 py-3 shadow-xl text-white text-sm">
          <span className="text-amber-400 font-medium">
            {Object.keys(edits).length} thay đổi chưa lưu
          </span>
          <Button size="sm" variant="outline"
            className="border-gray-600 text-gray-300 hover:bg-gray-800"
            onClick={() => setEdits({})}>
            Huỷ
          </Button>
          <Button size="sm" onClick={save} disabled={saving}
            className="bg-green-500 hover:bg-green-400 text-white">
            <Save className="mr-1.5 h-3.5 w-3.5" />
            {saving ? "Đang push Shopify..." : "Lưu & Push Shopify"}
          </Button>
        </div>
      )}
    </div>
  );
}
