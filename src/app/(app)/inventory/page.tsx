"use client";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle, Package, RefreshCw, Save, Search,
  Home, Warehouse, ExternalLink, Leaf, Link2, ChevronDown, ChevronUp,
} from "lucide-react";
import Link from "next/link";

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

export default function InventoryPage() {
  const [items, setItems] = useState<StockItem[]>([]);
  const [edits, setEdits] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [initing, setIniting] = useState(false);
  const [search, setSearch] = useState("");
  // sku → imageUrl từ Shopify (fallback cho những sản phẩm chưa có imageUrl trong DB)
  const [shopifyImages, setShopifyImages] = useState<Record<string, string>>({});
  // Unmatched Bros items
  const [unmatchedBros, setUnmatchedBros] = useState<UnmatchedBrosItem[]>([]);
  const [showUnmatched, setShowUnmatched] = useState(false);
  const [linkingSkus, setLinkingSkus] = useState<Record<string, string>>({}); // sku → selected productId

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
      // Reload both
      await Promise.all([load(), loadUnmatchedBros()]);
      setLinkingSkus((prev) => { const n = { ...prev }; delete n[sku]; return n; });
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : "Lỗi"); }
  }

  const hasEdits = Object.keys(edits).length > 0;

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return items.filter(
      (p) =>
        (p.nameVi ?? "").toLowerCase().includes(q) ||
        p.name.toLowerCase().includes(q) ||
        (p.skuShopify ?? "").toLowerCase().includes(q)
    );
  }, [items, search]);

  // Stats
  const nhungTotal   = items.reduce((s, p) => s + (edits[p.id] ?? p.nhungQty), 0);
  const brosTotal    = items.reduce((s, p) => s + p.brosQty, 0);
  const vnTotal      = items.reduce((s, p) => s + p.vnQty, 0);
  const shopifyTotal = nhungTotal + brosTotal;
  const lowCount     = items.filter((p) => {
    const qty = (edits[p.id] ?? p.nhungQty) + p.brosQty;
    return qty > 0 && qty <= 10;
  }).length;
  const outCount     = items.filter((p) => {
    const qty = (edits[p.id] ?? p.nhungQty) + p.brosQty;
    return qty === 0;
  }).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tồn kho</h1>
          <p className="text-sm text-gray-500">Kho VN → Kho Nhung + Kho Bros → Shopify inventory</p>
        </div>
        <div className="flex gap-2 flex-wrap">
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

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          className="pl-9"
          placeholder="Tìm sản phẩm, SKU..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
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

                  {/* Kho VN — đã sản xuất xong, chờ ship */}
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
                          {/* TODO: could add all products here for full search */}
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

      {/* Floating save bar */}
      {hasEdits && (
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
