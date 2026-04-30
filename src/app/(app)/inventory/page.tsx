"use client";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle,
  CheckCircle2,
  Package,
  RefreshCw,
  Save,
  Search,
  TrendingDown,
  Warehouse,
  Home,
  ArrowRight,
  Zap,
  ExternalLink,
} from "lucide-react";
import Link from "next/link";
import type { InventoryProduct } from "@/app/api/inventory/route";

// ─── Types ───────────────────────────────────────────────────────────────────

interface BrosData {
  skuMap: Record<string, number>;
  nameMap: Record<string, number>;
  items: { sku: string; name: string; qty: number }[];
}

interface NhungProduct {
  id: string;
  name: string;
  nameVi: string | null;
  skuShopify: string | null;
  skuAmz: string | null;
  nhungQty: number;
  brosQty: number;
  shopifyQty: number | null;
  total: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function normalizeName(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/^\d+[\s\-x]*\d*\s*(gram|g|kg|oz|lb|pack|pcs|pieces?)\s*/i, "")
    .replace(/\s*[\|\-]\s*.*/g, "")
    .replace(/[®™©]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function findBrosQty(item: InventoryProduct, bros: BrosData) {
  if (item.skuAmz && bros.skuMap[item.skuAmz] !== undefined)
    return { qty: bros.skuMap[item.skuAmz], matchedBy: "sku" as const };
  if (item.skuShopify && bros.skuMap[item.skuShopify] !== undefined)
    return { qty: bros.skuMap[item.skuShopify], matchedBy: "sku" as const };
  if (item.nameVi) {
    const key = normalizeName(item.nameVi);
    if (bros.nameMap[key] !== undefined) return { qty: bros.nameMap[key], matchedBy: "name" as const };
  }
  const key = normalizeName(item.name);
  if (bros.nameMap[key] !== undefined) return { qty: bros.nameMap[key], matchedBy: "name" as const };
  return { qty: 0, matchedBy: null };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function InventoryPage() {
  const [tab, setTab] = useState<"overview" | "nhung">("overview");

  // ── Overview tab state
  const [items, setItems] = useState<InventoryProduct[]>([]);
  const [shopifyQty, setShopifyQty] = useState<Record<string, number>>({});
  const [brosData, setBrosData] = useState<BrosData>({ skuMap: {}, nameMap: {}, items: [] });
  const [brosLoading, setBrosLoading] = useState(false);
  const [brosError, setBrosError] = useState<string | null>(null);
  const [loadingShopify, setLoadingShopify] = useState(false);
  const [showBrosOnly, setShowBrosOnly] = useState(false);
  const [usdToVnd, setUsdToVnd] = useState("25500");
  const [savingRate, setSavingRate] = useState(false);
  const [syncingSheets, setSyncingSheets] = useState(false);
  const [search, setSearch] = useState("");

  // ── Kho Nhung tab state
  const [nhungItems, setNhungItems] = useState<NhungProduct[]>([]);
  const [nhungEdits, setNhungEdits] = useState<Record<string, number>>({});
  const [nhungLoading, setNhungLoading] = useState(false);
  const [nhungSaving, setNhungSaving] = useState(false);
  const [nhungIniting, setNhungIniting] = useState(false);
  const [nhungSearch, setNhungSearch] = useState("");
  const [nhungSyncingSheet, setNhungSyncingSheet] = useState(false);

  // ── Load overview
  async function load() {
    const [inv, settings] = await Promise.all([
      fetch("/api/inventory").then((r) => r.json()),
      fetch("/api/settings").then((r) => r.json()),
    ]);
    setItems(inv);
    setUsdToVnd(settings.usdToVnd ?? "25500");
  }

  async function loadBrosQty() {
    setBrosLoading(true);
    setBrosError(null);
    try {
      const data = await fetch("/api/inventory/bros").then((r) => r.json());
      if (data.error) { if (data.error !== "no_token") setBrosError(data.error); return; }
      if (data.skuMap && data.nameMap && data.items) setBrosData(data as BrosData);
    } catch { /* optional */ } finally { setBrosLoading(false); }
  }

  async function loadShopifyQty() {
    setLoadingShopify(true);
    try {
      const data = await fetch("/api/inventory/shopify").then((r) => r.json());
      if (!data.error) setShopifyQty(data);
    } catch { /* optional */ } finally { setLoadingShopify(false); }
  }

  // ── Load Kho Nhung
  async function loadNhung() {
    setNhungLoading(true);
    try {
      const data: NhungProduct[] = await fetch("/api/inventory/nhung").then((r) => r.json());
      setNhungItems(data);
      setNhungEdits({});
    } catch { toast.error("Không tải được kho Nhung"); }
    finally { setNhungLoading(false); }
  }

  useEffect(() => { load(); loadShopifyQty(); loadBrosQty(); }, []);
  useEffect(() => { if (tab === "nhung" && nhungItems.length === 0) loadNhung(); }, [tab]);

  // ── Save rate
  async function saveRate() {
    setSavingRate(true);
    const res = await fetch("/api/settings", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ usdToVnd }),
    });
    setSavingRate(false);
    if (res.ok) toast.success("Đã lưu tỉ giá"); else toast.error("Lỗi lưu tỉ giá");
  }

  // ── Sync overview to sheets
  async function syncToSheets() {
    setSyncingSheets(true);
    try {
      const res = await fetch("/api/sync/sheets", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target: "inventory" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Lỗi sync");
      toast.success("Đã sync tồn kho lên Google Sheets ✓");
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : "Lỗi sync"); }
    finally { setSyncingSheets(false); }
  }

  // ── Init Kho Nhung from Shopify
  async function initNhungFromShopify() {
    setNhungIniting(true);
    try {
      const res = await fetch("/api/inventory/nhung", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(data.message ?? "Đã khởi tạo kho Nhung từ Shopify");
      await loadNhung();
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : "Lỗi khởi tạo"); }
    finally { setNhungIniting(false); }
  }

  // ── Save Nhung edits → DB + Shopify
  async function saveNhungEdits() {
    const changed = Object.entries(nhungEdits).map(([id, nhungQty]) => ({ id, nhungQty }));
    if (changed.length === 0) { toast("Chưa có thay đổi nào"); return; }
    setNhungSaving(true);
    try {
      const res = await fetch("/api/inventory/nhung", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(changed),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      if (data.shopifyErrors?.length) {
        toast.warning(`Đã lưu, nhưng lỗi push Shopify cho: ${data.shopifyErrors.join(", ")}`);
      } else {
        toast.success(`Đã lưu ${changed.length} sản phẩm và push lên Shopify ✓`);
      }
      await loadNhung();
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : "Lỗi lưu"); }
    finally { setNhungSaving(false); }
  }

  // ── Sync Nhung to Sheet
  async function syncNhungToSheet() {
    setNhungSyncingSheet(true);
    try {
      const res = await fetch("/api/sync/sheets", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target: "nhung" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success("Đã sync tab Kho Nhung lên Google Sheets ✓");
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : "Lỗi sync"); }
    finally { setNhungSyncingSheet(false); }
  }

  // ── Overview computed
  const matchedBrosNames = useMemo(() => {
    const set = new Set<string>();
    for (const item of items) {
      const { matchedBy } = findBrosQty(item, brosData);
      if (matchedBy === "name") {
        if (item.nameVi && brosData.nameMap[normalizeName(item.nameVi)] !== undefined)
          set.add(normalizeName(item.nameVi));
        else set.add(normalizeName(item.name));
      }
    }
    return set;
  }, [items, brosData]);

  const matchedBrosSKUs = useMemo(() => {
    const set = new Set<string>();
    for (const item of items) {
      if (item.skuAmz && brosData.skuMap[item.skuAmz] !== undefined) set.add(item.skuAmz);
      if (item.skuShopify && brosData.skuMap[item.skuShopify] !== undefined) set.add(item.skuShopify);
    }
    return set;
  }, [items, brosData]);

  const brosOnlyItems = useMemo(() =>
    brosData.items.filter((bi) => {
      if (bi.sku && matchedBrosSKUs.has(bi.sku)) return false;
      if (bi.name && matchedBrosNames.has(normalizeName(bi.name))) return false;
      return true;
    }),
    [brosData.items, matchedBrosSKUs, matchedBrosNames]
  );

  const q = search.toLowerCase();
  const filteredItems = items.filter(
    (p) => p.name.toLowerCase().includes(q) || (p.nameVi ?? "").toLowerCase().includes(q) || (p.skuShopify ?? "").toLowerCase().includes(q)
  );
  const filteredBrosOnly = brosOnlyItems.filter(
    (b) => b.name.toLowerCase().includes(q) || b.sku.toLowerCase().includes(q)
  );

  const lowStockCount = items.filter((p) => p.lowStock && p.purchasedUnits > 0).length;
  const totalProducts = items.filter((p) => p.purchasedUnits > 0).length;
  const brosMatchedCount = items.filter((p) => findBrosQty(p, brosData).matchedBy !== null).length;

  function stockColor(item: InventoryProduct) {
    if (item.stockUnits <= 0) return "text-red-600";
    if (item.lowStock) return "text-amber-600";
    return "text-green-700";
  }
  function stockBg(item: InventoryProduct) {
    if (item.stockUnits <= 0) return "bg-red-50";
    if (item.lowStock) return "bg-amber-50";
    return "bg-white";
  }
  function qtyColor(qty: number) {
    if (qty <= 0) return "text-red-500";
    if (qty <= 5) return "text-amber-500";
    return "text-purple-700";
  }

  // ── Nhung computed
  const nq = nhungSearch.toLowerCase();
  const filteredNhung = nhungItems.filter(
    (p) => (p.nameVi ?? "").toLowerCase().includes(nq) || p.name.toLowerCase().includes(nq) || (p.skuShopify ?? "").toLowerCase().includes(nq)
  );
  const hasEdits = Object.keys(nhungEdits).length > 0;
  const nhungTotal = nhungItems.reduce((s, p) => s + (nhungEdits[p.id] ?? p.nhungQty), 0);
  const brosTotal = nhungItems.reduce((s, p) => s + p.brosQty, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tồn kho</h1>
          <p className="text-sm text-gray-500">Kho Nhung (VN) · Kho Bros (US) · Shopify</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl bg-gray-100 p-1 w-fit">
        <button
          onClick={() => setTab("overview")}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${
            tab === "overview" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
          }`}
        >
          <Warehouse className="mr-1.5 h-4 w-4 inline-block" />
          Tổng hợp
        </button>
        <button
          onClick={() => setTab("nhung")}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${
            tab === "nhung" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
          }`}
        >
          <Home className="mr-1.5 h-4 w-4 inline-block" />
          Kho Nhung
          {hasEdits && <span className="ml-1.5 inline-flex h-2 w-2 rounded-full bg-amber-500" />}
        </button>
      </div>

      {/* ════════════════════ TAB: TỔNG HỢP ════════════════════ */}
      {tab === "overview" && (
        <>
          {/* Toolbar */}
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={loadBrosQty} disabled={brosLoading}
              className="text-xs border-purple-200 text-purple-700 hover:bg-purple-50">
              <Warehouse className={`mr-1.5 h-3.5 w-3.5 ${brosLoading ? "animate-spin" : ""}`} />
              {brosLoading ? "Đang đọc..." : "Làm mới Bros"}
            </Button>
            <Button variant="outline" size="sm" onClick={loadShopifyQty} disabled={loadingShopify} className="text-xs">
              <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${loadingShopify ? "animate-spin" : ""}`} />
              {loadingShopify ? "Đang tải..." : "Làm mới Shopify"}
            </Button>
            <Button variant="outline" size="sm" onClick={syncToSheets} disabled={syncingSheets} className="text-xs">
              <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${syncingSheets ? "animate-spin" : ""}`} />
              {syncingSheets ? "Đang sync..." : "Sync lên Sheet"}
            </Button>
            <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 shadow-sm">
              <span className="text-xs font-medium text-gray-500 whitespace-nowrap">1 USD =</span>
              <Input type="number" className="h-7 w-28 text-sm font-mono" value={usdToVnd}
                onChange={(e) => setUsdToVnd(e.target.value)} />
              <span className="text-xs text-gray-400">VND</span>
              <Button size="sm" onClick={saveRate} disabled={savingRate}
                className="h-7 bg-green-600 hover:bg-green-700">
                <Save className="h-3 w-3" />
              </Button>
            </div>
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-blue-50 p-2.5"><Package className="h-5 w-5 text-blue-600" /></div>
                <div><p className="text-xs text-gray-500">Có hàng (App)</p>
                  <p className="text-2xl font-bold text-gray-900">{totalProducts}</p></div>
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-green-50 p-2.5"><CheckCircle2 className="h-5 w-5 text-green-600" /></div>
                <div><p className="text-xs text-gray-500">Còn đủ hàng</p>
                  <p className="text-2xl font-bold text-green-700">{totalProducts - lowStockCount}</p></div>
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-amber-50 p-2.5"><AlertTriangle className="h-5 w-5 text-amber-600" /></div>
                <div><p className="text-xs text-gray-500">Sắp hết / hết</p>
                  <p className="text-2xl font-bold text-amber-600">{lowStockCount}</p></div>
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-purple-50 p-2.5"><Warehouse className="h-5 w-5 text-purple-600" /></div>
                <div><p className="text-xs text-gray-500">Khớp kho Bros</p>
                  <p className="text-2xl font-bold text-purple-700">
                    {brosData.items.length > 0 ? brosMatchedCount : "—"}
                  </p>
                  {brosData.items.length > 0 && (
                    <p className="text-xs text-gray-400">/ {brosData.items.length} ({brosOnlyItems.length} chưa khớp)</p>
                  )}
                </div>
              </div>
            </Card>
          </div>

          {/* Low stock alerts */}
          {lowStockCount > 0 && (
            <Card className="border-amber-200 bg-amber-50 p-4">
              <div className="flex items-center gap-2 mb-3">
                <TrendingDown className="h-4 w-4 text-amber-600" />
                <span className="text-sm font-semibold text-amber-800">Cần nhập thêm hàng</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {items.filter((p) => p.lowStock && p.purchasedUnits > 0).map((p) => (
                  <Link key={p.id} href={`/products/${p.id}`}>
                    <Badge className={`cursor-pointer ${p.stockUnits <= 0 ? "bg-red-100 text-red-700 hover:bg-red-200" : "bg-amber-100 text-amber-800 hover:bg-amber-200"}`}>
                      {p.nameVi ?? p.name}
                      <span className="ml-1 font-bold">{p.stockUnits <= 0 ? "HẾT" : `còn ${p.stockUnits}`}</span>
                    </Badge>
                  </Link>
                ))}
              </div>
            </Card>
          )}

          {/* Search + toggle */}
          <div className="flex gap-3 items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input placeholder="Tìm sản phẩm..." className="pl-9" value={search}
                onChange={(e) => setSearch(e.target.value)} />
            </div>
            {brosOnlyItems.length > 0 && (
              <Button variant={showBrosOnly ? "default" : "outline"} size="sm"
                onClick={() => setShowBrosOnly((v) => !v)}
                className={`text-xs whitespace-nowrap ${showBrosOnly ? "bg-purple-600 hover:bg-purple-700" : "border-purple-200 text-purple-700 hover:bg-purple-50"}`}>
                <Warehouse className="mr-1.5 h-3.5 w-3.5" />
                Chỉ Bros ({brosOnlyItems.length})
              </Button>
            )}
          </div>

          {/* Main table */}
          {!showBrosOnly && (
            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-gray-500">Sản phẩm</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500">Danh mục</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-500">Đã mua</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-500">Đã bán</th>
                    <th className="px-4 py-3 text-right font-medium text-green-700">Tồn kho App</th>
                    <th className="px-4 py-3 text-right font-medium text-purple-700">Bros Qty{brosLoading && <span className="ml-1 text-gray-300">...</span>}</th>
                    <th className="px-4 py-3 text-right font-medium text-blue-600">Shopify Qty{loadingShopify && <span className="ml-1 text-gray-300">...</span>}</th>
                    <th className="px-4 py-3 text-center font-medium text-gray-500">Trạng thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredItems.map((item) => {
                    const { qty: bQty, matchedBy } = findBrosQty(item, brosData);
                    const sQty = item.skuShopify ? shopifyQty[item.skuShopify] : undefined;
                    return (
                      <tr key={item.id} className={`transition-colors hover:bg-gray-50 ${stockBg(item)}`}>
                        <td className="px-4 py-3 max-w-xs">
                          <Link href={`/products/${item.id}`}
                            className="font-medium text-gray-900 hover:text-green-600 hover:underline">
                            {item.nameVi ?? item.name}
                          </Link>
                          {item.nameVi && <p className="text-xs text-gray-400 truncate">{item.name}</p>}
                          <div className="flex items-center gap-2 flex-wrap mt-0.5">
                            {item.skuShopify && <p className="text-xs text-gray-300 font-mono">{item.skuShopify}</p>}
                            {item.gramsPerUnit && <span className="text-xs text-blue-400">{item.gramsPerUnit}g/gói</span>}
                            {matchedBy === "name" && brosData.items.length > 0 && <span className="text-xs text-purple-300 italic">~tên</span>}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs">{item.category ?? "—"}</td>
                        <td className="px-4 py-3 text-right text-gray-700">{item.purchasedUnits > 0 ? item.purchasedUnits : <span className="text-gray-300">—</span>}</td>
                        <td className="px-4 py-3 text-right text-gray-500">{item.soldUnits > 0 ? item.soldUnits : <span className="text-gray-300">—</span>}</td>
                        <td className={`px-4 py-3 text-right text-base font-bold ${stockColor(item)}`}>
                          {item.purchasedUnits > 0 ? item.stockUnits : <span className="text-gray-300 text-sm font-normal">—</span>}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {matchedBy !== null ? <span className={`font-semibold ${qtyColor(bQty)}`}>{bQty}</span> : <span className="text-gray-200">—</span>}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {sQty !== undefined
                            ? <span className={`font-semibold ${sQty <= 0 ? "text-red-500" : sQty <= 5 ? "text-amber-500" : "text-blue-600"}`}>{sQty}</span>
                            : <span className="text-gray-200">—</span>}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {item.purchasedUnits === 0
                            ? <Badge className="bg-gray-100 text-gray-400 text-xs">Chờ về</Badge>
                            : item.stockUnits <= 0
                            ? <Badge className="bg-red-100 text-red-700 text-xs">Hết hàng</Badge>
                            : item.lowStock
                            ? <Badge className="bg-amber-100 text-amber-700 text-xs">Sắp hết</Badge>
                            : <Badge className="bg-green-100 text-green-700 text-xs">Còn hàng</Badge>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {filteredItems.length === 0 && <div className="flex h-32 items-center justify-center text-gray-400">Không tìm thấy sản phẩm</div>}
            </div>
          )}

          {/* Bros-only table */}
          {(showBrosOnly || (brosOnlyItems.length > 0 && !showBrosOnly)) && brosData.items.length > 0 && (
            <div className={showBrosOnly ? "" : "mt-2"}>
              {!showBrosOnly && (
                <div className="flex items-center gap-2 mb-3">
                  <Warehouse className="h-4 w-4 text-purple-500" />
                  <span className="text-sm font-semibold text-purple-700">Chỉ có ở Bros chưa map ({brosOnlyItems.length})</span>
                </div>
              )}
              <div className="overflow-hidden rounded-xl border border-purple-100 bg-purple-50">
                <table className="w-full text-sm">
                  <thead className="bg-purple-100 text-xs">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium text-purple-700">Tên (Bros sheet)</th>
                      <th className="px-4 py-3 text-left font-medium text-purple-700">SKU</th>
                      <th className="px-4 py-3 text-right font-medium text-purple-700">Qty Bros</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-purple-100">
                    {(showBrosOnly ? filteredBrosOnly : brosOnlyItems.slice(0, 20)).map((bi, idx) => (
                      <tr key={idx} className="hover:bg-purple-100 transition-colors">
                        <td className="px-4 py-3 text-gray-700 text-xs">{bi.name || "—"}</td>
                        <td className="px-4 py-3 font-mono text-xs text-gray-500">{bi.sku || "—"}</td>
                        <td className="px-4 py-3 text-right"><span className={`font-semibold text-sm ${qtyColor(bi.qty)}`}>{bi.qty}</span></td>
                      </tr>
                    ))}
                    {!showBrosOnly && brosOnlyItems.length > 20 && (
                      <tr>
                        <td colSpan={3} className="px-4 py-3 text-center text-xs text-purple-400">
                          ... và {brosOnlyItems.length - 20} khác —{" "}
                          <button onClick={() => setShowBrosOnly(true)} className="underline hover:text-purple-600">xem tất cả</button>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* ════════════════════ TAB: KHO NHUNG ════════════════════ */}
      {tab === "nhung" && (
        <>
          {/* Formula banner */}
          <div className="flex items-center gap-3 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3">
            <Zap className="h-4 w-4 text-blue-500 shrink-0" />
            <div className="flex items-center gap-2 text-sm font-medium text-blue-800 flex-wrap">
              <span className="flex items-center gap-1.5 rounded-lg bg-orange-100 px-2.5 py-1 text-orange-700">
                <Home className="h-3.5 w-3.5" /> Kho Nhung
              </span>
              <span className="text-blue-400">+</span>
              <span className="flex items-center gap-1.5 rounded-lg bg-purple-100 px-2.5 py-1 text-purple-700">
                <Warehouse className="h-3.5 w-3.5" /> Kho Bros
              </span>
              <ArrowRight className="h-4 w-4 text-blue-400" />
              <span className="flex items-center gap-1.5 rounded-lg bg-green-100 px-2.5 py-1 text-green-700">
                <ExternalLink className="h-3.5 w-3.5" /> Shopify Inventory
              </span>
            </div>
            <div className="ml-auto text-xs text-blue-500">Lưu = tự động push lên Shopify</div>
          </div>

          {/* Summary stats */}
          <div className="grid grid-cols-3 gap-4">
            <Card className="p-4 border-orange-200 bg-orange-50">
              <p className="text-xs text-orange-600 font-medium mb-1">Tổng Kho Nhung</p>
              <p className="text-2xl font-bold text-orange-700">
                {nhungItems.reduce((s, p) => s + (nhungEdits[p.id] ?? p.nhungQty), 0)} gói
              </p>
              <p className="text-xs text-orange-400 mt-0.5">{nhungItems.filter(p => (nhungEdits[p.id] ?? p.nhungQty) > 0).length} mã có hàng</p>
            </Card>
            <Card className="p-4 border-purple-200 bg-purple-50">
              <p className="text-xs text-purple-600 font-medium mb-1">Tổng Kho Bros</p>
              <p className="text-2xl font-bold text-purple-700">{brosTotal} gói</p>
              <p className="text-xs text-purple-400 mt-0.5">{nhungItems.filter(p => p.brosQty > 0).length} mã có hàng</p>
            </Card>
            <Card className="p-4 border-green-200 bg-green-50">
              <p className="text-xs text-green-600 font-medium mb-1">Tổng → Shopify</p>
              <p className="text-2xl font-bold text-green-700">{nhungTotal + brosTotal} gói</p>
              <p className="text-xs text-green-400 mt-0.5">= Nhung + Bros</p>
            </Card>
          </div>

          {/* Toolbar */}
          <div className="flex items-center gap-2 flex-wrap">
            <Button size="sm" variant="outline" onClick={loadNhung} disabled={nhungLoading} className="text-xs">
              <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${nhungLoading ? "animate-spin" : ""}`} />
              Làm mới
            </Button>
            <Button size="sm" variant="outline" onClick={initNhungFromShopify} disabled={nhungIniting}
              className="text-xs border-blue-200 text-blue-700 hover:bg-blue-50">
              <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${nhungIniting ? "animate-spin" : ""}`} />
              {nhungIniting ? "Đang lấy..." : "Khởi tạo từ Shopify"}
            </Button>
            <Button size="sm" variant="outline" onClick={syncNhungToSheet} disabled={nhungSyncingSheet}
              className="text-xs border-green-200 text-green-700 hover:bg-green-50">
              <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${nhungSyncingSheet ? "animate-spin" : ""}`} />
              Sync lên Sheet
            </Button>
            {hasEdits && (
              <Button size="sm" onClick={saveNhungEdits} disabled={nhungSaving}
                className="bg-green-600 hover:bg-green-700 text-white ml-auto">
                <Save className="mr-1.5 h-3.5 w-3.5" />
                {nhungSaving ? "Đang lưu & push Shopify..." : `Lưu ${Object.keys(nhungEdits).length} thay đổi → Shopify`}
              </Button>
            )}
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input placeholder="Tìm sản phẩm..." className="pl-9" value={nhungSearch}
              onChange={(e) => setNhungSearch(e.target.value)} />
          </div>

          {/* Nhung table */}
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Sản phẩm</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-400">SKU Shopify</th>
                  <th className="px-4 py-3 text-right font-medium text-orange-600">
                    <span className="flex items-center justify-end gap-1"><Home className="h-3 w-3" /> Kho Nhung</span>
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-purple-600">
                    <span className="flex items-center justify-end gap-1"><Warehouse className="h-3 w-3" /> Kho Bros</span>
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-green-700">Tổng → Shopify</th>
                  <th className="px-4 py-3 text-right font-medium text-blue-500">Shopify hiện tại</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {nhungLoading ? (
                  <tr><td colSpan={6} className="py-12 text-center text-gray-400">Đang tải...</td></tr>
                ) : filteredNhung.map((item) => {
                  const editedQty = nhungEdits[item.id] ?? item.nhungQty;
                  const total = editedQty + item.brosQty;
                  const isEdited = nhungEdits[item.id] !== undefined;
                  const shopifyMismatch = item.shopifyQty !== null && item.shopifyQty !== item.total;

                  return (
                    <tr key={item.id} className={`transition-colors hover:bg-gray-50 ${isEdited ? "bg-amber-50" : ""}`}>
                      <td className="px-4 py-2.5 max-w-xs">
                        <p className="font-medium text-gray-900">{item.nameVi ?? item.name}</p>
                        {item.nameVi && <p className="text-xs text-gray-400 truncate">{item.name}</p>}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-xs text-gray-400">{item.skuShopify ?? "—"}</td>
                      <td className="px-4 py-2.5 text-right">
                        <Input
                          type="number"
                          min={0}
                          className={`h-8 w-24 text-right text-sm font-semibold ml-auto ${isEdited ? "border-amber-400 bg-amber-50" : ""}`}
                          value={editedQty}
                          onChange={(e) => {
                            const v = Math.max(0, parseInt(e.target.value) || 0);
                            if (v === item.nhungQty) {
                              setNhungEdits((prev) => { const n = { ...prev }; delete n[item.id]; return n; });
                            } else {
                              setNhungEdits((prev) => ({ ...prev, [item.id]: v }));
                            }
                          }}
                        />
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <span className={`font-semibold ${item.brosQty > 0 ? "text-purple-700" : "text-gray-300"}`}>
                          {item.brosQty > 0 ? item.brosQty : "—"}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <span className={`text-base font-bold ${total > 0 ? "text-green-700" : "text-red-500"}`}>
                          {total}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        {item.shopifyQty !== null ? (
                          <span className={`text-sm font-medium ${shopifyMismatch ? "text-amber-500" : "text-blue-500"}`}>
                            {item.shopifyQty}
                            {shopifyMismatch && <span className="ml-1 text-xs text-amber-400">≠</span>}
                          </span>
                        ) : (
                          <span className="text-gray-300 text-xs">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!nhungLoading && filteredNhung.length === 0 && (
              <div className="flex h-32 items-center justify-center text-gray-400">Không tìm thấy sản phẩm</div>
            )}
          </div>

          {/* Floating save bar */}
          {hasEdits && (
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-xl bg-gray-900 px-5 py-3 shadow-xl text-white text-sm">
              <span className="text-amber-400 font-medium">{Object.keys(nhungEdits).length} thay đổi chưa lưu</span>
              <Button size="sm" variant="outline" className="border-gray-600 text-gray-300 hover:bg-gray-800"
                onClick={() => setNhungEdits({})}>
                Huỷ
              </Button>
              <Button size="sm" onClick={saveNhungEdits} disabled={nhungSaving}
                className="bg-green-500 hover:bg-green-400 text-white">
                <Save className="mr-1.5 h-3.5 w-3.5" />
                {nhungSaving ? "Đang push Shopify..." : "Lưu & Push Shopify"}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
