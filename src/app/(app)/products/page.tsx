"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Plus, Pencil, RefreshCw, Trash2, Search,
  ChevronLeft, ChevronRight, Check, X, Package,
  Home, Warehouse, ExternalLink,
} from "lucide-react";
import Link from "next/link";

interface Product {
  id: string;
  name: string;
  nameVi: string | null;
  skuShopify: string | null;
  skuTiktok: string | null;
  skuAmz: string | null;
  skuBros: string | null;
  unit: string;
  gramsPerUnit: number | null;
  piecesPerUnit: number | null;
  piecesPerPack: number | null;
  restockThreshold: number | null;
  category: string | null;
  notes: string | null;
  nhungQty: number;
  imageUrl: string | null;
  priceUsd: number | null;
  pendingShipQty: number;
  inTransitQty: number;
}

interface ProductsResponse {
  products: Product[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  categories: (string | null)[];
}

const empty = {
  name: "",
  nameVi: "",
  skuShopify: "",
  skuTiktok: "",
  skuAmz: "",
  skuBros: "",
  unit: "kg",
  gramsPerUnit: "",
  piecesPerUnit: "",
  piecesPerPack: "",
  restockThreshold: "10",
  category: "",
  notes: "",
};

export default function ProductsPage() {
  const [resp, setResp] = useState<ProductsResponse>({
    products: [], total: 0, page: 1, limit: 50, totalPages: 1, categories: [],
  });
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [hasSkuFilter, setHasSkuFilter] = useState(false);
  const [hasViFilter, setHasViFilter] = useState(false);
  const [page, setPage] = useState(1);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState(empty);
  const [syncing, setSyncing] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [shopifyImages, setShopifyImages] = useState<Record<string, string>>({});
  // Inline nameVi editing
  const [inlineEditId, setInlineEditId] = useState<string | null>(null);
  const [inlineVal, setInlineVal] = useState("");
  const inlineRef = useRef<HTMLInputElement>(null);

  const load = useCallback(() => {
    const params = new URLSearchParams({
      page: String(page),
      limit: "50",
      ...(search && { q: search }),
      ...(categoryFilter && { category: categoryFilter }),
      ...(hasSkuFilter && { hasSku: "1" }),
      ...(hasViFilter && { hasVi: "1" }),
    });
    fetch(`/api/products?${params}`)
      .then((r) => r.json())
      .then(setResp);
  }, [page, search, categoryFilter, hasSkuFilter, hasViFilter]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [search, categoryFilter, hasSkuFilter, hasViFilter]);

  // Fetch ảnh Shopify trong background
  useEffect(() => {
    fetch("/api/shopify/image-map")
      .then((r) => r.json())
      .then((m) => { if (typeof m === "object" && m !== null) setShopifyImages(m); })
      .catch(() => {});
  }, []);

  function openNew() {
    setEditing(null);
    setForm(empty);
    setOpen(true);
  }

  function openEdit(p: Product) {
    setEditing(p);
    setForm({
      name: p.name,
      nameVi: p.nameVi ?? "",
      skuShopify: p.skuShopify ?? "",
      skuTiktok: p.skuTiktok ?? "",
      skuAmz: p.skuAmz ?? "",
      skuBros: p.skuBros ?? "",
      unit: p.unit,
      gramsPerUnit: p.gramsPerUnit ? String(p.gramsPerUnit) : "",
      piecesPerUnit: p.piecesPerUnit ? String(p.piecesPerUnit) : "",
      piecesPerPack: p.piecesPerPack ? String(p.piecesPerPack) : "",
      restockThreshold: p.restockThreshold ? String(p.restockThreshold) : "10",
      category: p.category ?? "",
      notes: p.notes ?? "",
    });
    setOpen(true);
  }

  async function save() {
    if (!form.name.trim()) return toast.error("Vui lòng nhập tên sản phẩm");
    const url = editing ? `/api/products/${editing.id}` : "/api/products";
    const method = editing ? "PUT" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        gramsPerUnit:  form.gramsPerUnit  ? Number(form.gramsPerUnit)  : null,
        piecesPerUnit: form.piecesPerUnit ? Number(form.piecesPerUnit) : null,
        piecesPerPack: form.piecesPerPack ? Number(form.piecesPerPack) : null,
        restockThreshold: form.restockThreshold ? Number(form.restockThreshold) : 10,
      }),
    });
    if (res.ok) {
      toast.success(editing ? "Đã cập nhật" : "Đã thêm sản phẩm");
      setOpen(false);
      load();
    } else {
      toast.error("Có lỗi xảy ra");
    }
  }

  async function syncShopify() {
    setSyncing(true);
    try {
      const res = await fetch("/api/sync/shopify?type=products", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Sync Shopify: +${data.created ?? 0} mới, cập nhật ${data.updated ?? 0} / tổng ${data.total ?? 0}`);
        load();
      } else toast.error(data.error ?? "Lỗi sync Shopify");
    } finally { setSyncing(false); }
  }

  async function cleanTestData() {
    if (!confirm("Xoá toàn bộ đơn mua, thanh toán và nhà cung cấp test? Không thể hoàn tác.")) return;
    setCleaning(true);
    try {
      const res = await fetch("/api/admin/clean", { method: "POST" });
      const data = await res.json();
      if (res.ok) toast.success(data.message ?? "Đã xoá dữ liệu test");
      else toast.error("Lỗi xoá dữ liệu");
    } finally { setCleaning(false); }
  }

  function startInlineEdit(p: Product) {
    setInlineEditId(p.id);
    setInlineVal(p.nameVi ?? "");
    setTimeout(() => inlineRef.current?.focus(), 50);
  }

  async function saveInlineVi(productId: string) {
    const val = inlineVal.trim();
    const res = await fetch(`/api/products/${productId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nameVi: val || null }),
    });
    if (res.ok) {
      toast.success(val ? "Đã lưu tên VN" : "Đã xoá tên VN");
      setInlineEditId(null);
      load();
    } else {
      toast.error("Lỗi lưu tên VN");
    }
  }

  const f = (k: keyof typeof empty) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [k]: e.target.value });

  const { products, total, totalPages, categories } = resp;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sản phẩm</h1>
          <p className="text-sm text-gray-500">Danh mục hàng hoá · {total} sản phẩm</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={syncShopify} disabled={syncing} className="text-xs">
            <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Đang sync..." : "Sync từ Shopify"}
          </Button>
          <Button variant="outline" size="sm" onClick={cleanTestData} disabled={cleaning}
            className="text-xs text-red-500 hover:text-red-600 hover:border-red-300">
            <Trash2 className="mr-1.5 h-3.5 w-3.5" />
            {cleaning ? "Đang xoá..." : "Xoá data test"}
          </Button>
          <Button onClick={openNew} className="bg-green-600 hover:bg-green-700">
            <Plus className="mr-2 h-4 w-4" /> Thêm sản phẩm
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Tìm tên, SKU, danh mục..."
            className="pl-9 h-9 text-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {categories.length > 0 && (
          <select
            className="h-9 rounded-md border border-input bg-background px-3 text-sm text-gray-700"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option value="">Tất cả danh mục</option>
            {categories.map((c) => (
              <option key={c} value={c ?? ""}>{c}</option>
            ))}
          </select>
        )}
        <button
          onClick={() => setHasSkuFilter(!hasSkuFilter)}
          className={`h-9 rounded-md border px-3 text-xs font-medium transition-colors ${
            hasSkuFilter ? "bg-blue-50 border-blue-300 text-blue-700" : "border-gray-200 text-gray-500 hover:border-gray-300"
          }`}
        >
          Có SKU Shopify
        </button>
        <button
          onClick={() => setHasViFilter(!hasViFilter)}
          className={`h-9 rounded-md border px-3 text-xs font-medium transition-colors ${
            hasViFilter ? "bg-green-50 border-green-300 text-green-700" : "border-gray-200 text-gray-500 hover:border-gray-300"
          }`}
        >
          Có tên VN
        </button>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Sản phẩm</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">SKU</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Danh mục</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Tồn kho US</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">VN (chờ ship)</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {products.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-gray-400">
                  Không tìm thấy sản phẩm nào
                </td>
              </tr>
            ) : products.map((p) => (
              <tr key={p.id} className="hover:bg-gray-50 group">
                {/* Image + Name */}
                <td className="px-4 py-3">
                  <div className="flex items-start gap-3">
                    {/* Thumbnail — DB cache hoặc live từ Shopify */}
                    {(() => {
                      const img = p.imageUrl ?? (p.skuShopify ? shopifyImages[p.skuShopify] : null);
                      return img ? (
                        <img src={img} alt={p.name}
                          className="h-10 w-10 rounded-lg object-cover shrink-0 border border-gray-100" />
                      ) : (
                        <div className="h-10 w-10 rounded-lg bg-gray-100 shrink-0 flex items-center justify-center">
                          <Package className="h-4 w-4 text-gray-300" />
                        </div>
                      );
                    })()}
                    <div className="min-w-0">
                      <Link href={`/products/${p.id}`} className="font-medium text-gray-900 hover:text-green-600 hover:underline leading-snug block">
                        {p.nameVi || p.name}
                      </Link>
                      {p.nameVi && <p className="text-xs text-gray-400 truncate max-w-xs">{p.name}</p>}
                      {!p.nameVi && (
                        inlineEditId === p.id ? (
                          <div className="flex items-center gap-1.5 mt-1">
                            <Input
                              ref={inlineRef}
                              value={inlineVal}
                              onChange={(e) => setInlineVal(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") saveInlineVi(p.id);
                                if (e.key === "Escape") setInlineEditId(null);
                              }}
                              placeholder="Nhập tên tiếng Việt..."
                              className="h-7 text-xs py-0 w-48"
                            />
                            <button onClick={() => saveInlineVi(p.id)} className="p-1 rounded text-green-600 hover:bg-green-50">
                              <Check className="h-3.5 w-3.5" />
                            </button>
                            <button onClick={() => setInlineEditId(null)} className="p-1 rounded text-gray-400 hover:bg-gray-100">
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ) : (
                          <button onClick={() => startInlineEdit(p)} className="mt-0.5 block" title="Nhấn để thêm tên tiếng Việt">
                            <Badge className="bg-amber-50 text-amber-600 text-[10px] border border-amber-200 cursor-pointer hover:bg-amber-100 transition-colors">
                              + Thêm tên VN
                            </Badge>
                          </button>
                        )
                      )}
                      {/* Price */}
                      {p.priceUsd != null && (
                        <span className="text-xs text-green-700 font-semibold mt-0.5 block">${p.priceUsd.toFixed(2)}</span>
                      )}
                    </div>
                  </div>
                </td>

                {/* SKUs */}
                <td className="px-4 py-3">
                  <div className="flex flex-col gap-1">
                    {p.skuShopify ? (
                      <Badge variant="outline" className="font-mono text-xs w-fit">{p.skuShopify}</Badge>
                    ) : <span className="text-gray-300 text-xs">—</span>}
                    {p.skuBros && (
                      <Badge className="font-mono text-[10px] w-fit bg-blue-50 text-blue-700 border border-blue-200">
                        Bros: {p.skuBros}
                      </Badge>
                    )}
                  </div>
                </td>

                {/* Category */}
                <td className="px-4 py-3 text-gray-500 text-xs">{p.category ?? "—"}</td>

                {/* US stock: nhungQty (Kho Nhung, đã sang Mỹ) */}
                <td className="px-4 py-3">
                  {p.nhungQty > 0 ? (
                    <div className="flex items-center gap-1 text-sm font-semibold text-gray-900">
                      <Home className="h-3.5 w-3.5 text-orange-400 shrink-0" />
                      {p.nhungQty}
                      <span className="text-xs font-normal text-gray-400">gói</span>
                    </div>
                  ) : (
                    <span className="text-gray-300 text-xs">—</span>
                  )}
                </td>

                {/* VN stock: pending / in-transit */}
                <td className="px-4 py-3">
                  <div className="flex flex-col gap-1">
                    {p.pendingShipQty > 0 && (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-orange-700 bg-orange-50 border border-orange-200 rounded px-1.5 py-0.5">
                        <Warehouse className="h-3 w-3 shrink-0" />
                        {p.pendingShipQty} chờ ship
                      </span>
                    )}
                    {p.inTransitQty > 0 && (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded px-1.5 py-0.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
                        {p.inTransitQty} đang ship
                      </span>
                    )}
                    {p.pendingShipQty === 0 && p.inTransitQty === 0 && (
                      <span className="text-gray-300 text-xs">—</span>
                    )}
                  </div>
                </td>

                {/* Actions */}
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {p.skuShopify && (
                      <a
                        href={`https://admin.shopify.com/store/products?query=${p.skuShopify}`}
                        target="_blank" rel="noopener noreferrer"
                        className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-blue-500 transition-colors"
                        title="Mở Shopify Admin"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                    <Button size="icon" variant="ghost" onClick={() => openEdit(p)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Trang {page}/{totalPages} · {total} sản phẩm
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const p = Math.max(1, page - 2) + i;
              if (p > totalPages) return null;
              return (
                <Button key={p} variant={p === page ? "default" : "outline"} size="sm"
                  onClick={() => setPage(p)}
                  className={p === page ? "bg-green-600 hover:bg-green-700 text-white" : ""}>
                  {p}
                </Button>
              );
            })}
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Edit / Create Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              {(() => {
                const img = editing?.imageUrl ?? (editing?.skuShopify ? shopifyImages[editing.skuShopify] : null);
                return img ? <img src={img} alt={editing?.name} className="h-10 w-10 rounded-lg object-cover border border-gray-100" /> : null;
              })()}
              {editing ? "Sửa sản phẩm" : "Thêm sản phẩm"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 pt-2">
            <div className="col-span-2 space-y-1.5">
              <Label>Tên sản phẩm (EN) *</Label>
              <Input placeholder="VD: Lotus Seed" value={form.name} onChange={f("name")} />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Tên tiếng Việt</Label>
              <Input placeholder="VD: Hạt sen" value={form.nameVi} onChange={f("nameVi")} />
            </div>

            {/* SKUs */}
            <div className="col-span-2 rounded-lg border border-gray-100 bg-gray-50 p-3 space-y-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">SKU & Mã hàng</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">SKU Shopify</Label>
                  <Input placeholder="VD: LOTUS-500G" value={form.skuShopify} onChange={f("skuShopify")} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">SKU TikTok</Label>
                  <Input placeholder="VD: TT-LOTUS-500" value={form.skuTiktok} onChange={f("skuTiktok")} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">SKU Amazon</Label>
                  <Input placeholder="VD: AMZ-LOTUS" value={form.skuAmz} onChange={f("skuAmz")} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs flex items-center gap-1.5">
                    SKU Bros
                    <span className="font-normal text-gray-400 bg-gray-100 rounded px-1.5 py-0.5">Kho US</span>
                  </Label>
                  <Input placeholder="Để trống = dùng SKU Amazon" value={form.skuBros} onChange={f("skuBros")} />
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Đơn vị mua</Label>
              <Input placeholder="kg / gói / hộp" value={form.unit} onChange={f("unit")} />
            </div>
            <div className="space-y-1.5">
              <Label>Danh mục</Label>
              <Input placeholder="Hạt / Trà / Thảo mộc" value={form.category} onChange={f("category")} />
            </div>

            {/* Weight-based packing */}
            <div className="col-span-2 rounded-lg border border-gray-100 bg-gray-50 p-3 space-y-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Đóng gói theo trọng lượng</p>
              <div className="space-y-1.5">
                <Label className="text-xs">Gram / gói bán</Label>
                <Input type="number" placeholder="VD: 200" value={form.gramsPerUnit} onChange={f("gramsPerUnit")} />
                <p className="text-xs text-gray-400">VD: 200 → 1kg mua được 5 gói 200g</p>
              </div>
            </div>
            {/* Count-based packing */}
            <div className="col-span-2 rounded-lg border border-orange-100 bg-orange-50 p-3 space-y-3">
              <p className="text-xs font-semibold text-orange-600 uppercase tracking-wide">Đóng gói theo số lượng (hạt, cái...)</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Số hạt / đơn vị mua</Label>
                  <Input type="number" placeholder="VD: 1000" value={form.piecesPerUnit} onChange={f("piecesPerUnit")} />
                  <p className="text-xs text-gray-400">1 {form.unit || "lạng"} = ? hạt</p>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Số hạt / gói bán</Label>
                  <Input type="number" placeholder="VD: 150" value={form.piecesPerPack} onChange={f("piecesPerPack")} />
                  <p className="text-xs text-gray-400">1 gói = ? hạt</p>
                </div>
              </div>
              {form.piecesPerUnit && form.piecesPerPack && (
                <p className="text-xs text-orange-700 font-medium">
                  → 1 {form.unit || "đơn vị"} = {Math.floor(Number(form.piecesPerUnit) / Number(form.piecesPerPack))} gói
                  {Number(form.piecesPerUnit) % Number(form.piecesPerPack) > 0
                    ? ` (dư ${Number(form.piecesPerUnit) % Number(form.piecesPerPack)} hạt)`
                    : " (chính xác)"}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Ngưỡng tồn kho</Label>
              <Input type="number" placeholder="10" value={form.restockThreshold} onChange={f("restockThreshold")} />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Ghi chú</Label>
              <Input value={form.notes} onChange={f("notes")} />
            </div>
            <div className="col-span-2 flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setOpen(false)}>Huỷ</Button>
              <Button onClick={save} className="bg-green-600 hover:bg-green-700">
                {editing ? "Cập nhật" : "Thêm mới"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
