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
  Check, X, Package,
  Home, ExternalLink, Layers,
  ChevronDown, ChevronUp, Tag, DollarSign,
  Upload, Sparkles,
} from "lucide-react";
import Link from "next/link";
import { generateSku } from "@/lib/sku-suggest";

// ─── Types ───────────────────────────────────────────────────────────────────

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
  groupId: string | null;
}

interface ProductsResponse {
  products: Product[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  categories: (string | null)[];
}

interface GroupProduct {
  id: string;
  name: string;
  nameVi: string | null;
  skuShopify: string | null;
  skuAmz: string | null;
  skuBros: string | null;
  priceUsd: number | null;
  imageUrl: string | null;
  unit: string;
  gramsPerUnit: number | null;
  piecesPerUnit: number | null;
  piecesPerPack: number | null;
  nhungQty: number;
  category: string | null;
}

interface ProductGroup {
  id: string;
  name: string;
  baseCostVnd: number | null;
  costUnit: string;
  notes: string | null;
  products: GroupProduct[];
}

const empty = {
  name: "", nameVi: "", skuShopify: "", skuTiktok: "", skuAmz: "", skuBros: "",
  unit: "kg", gramsPerUnit: "", piecesPerUnit: "", piecesPerPack: "",
  restockThreshold: "10", category: "", notes: "",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return n.toLocaleString("vi-VN");
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function ProductsPage() {
  // ── Flat-list state (kept for total count) ──
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
  const [formGroupId, setFormGroupId] = useState<string>("");

  const [syncing, setSyncing] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [shopifyImages, setShopifyImages] = useState<Record<string, string>>({});

  // Inline editing
  const [inlineEditId, setInlineEditId] = useState<string | null>(null);
  const [inlineEditField, setInlineEditField] = useState<"nameVi" | "skuBros">("nameVi");
  const [inlineVal, setInlineVal] = useState("");
  const inlineRef = useRef<HTMLInputElement>(null);

  // ── Group state ──
  const [groups, setGroups] = useState<ProductGroup[]>([]);
  const [ungrouped, setUngrouped] = useState<GroupProduct[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  // Group search
  const [groupSearch, setGroupSearch] = useState("");

  // New group dialog
  const [newGroupOpen, setNewGroupOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupCost, setNewGroupCost] = useState("");
  const [newGroupUnit, setNewGroupUnit] = useState("kg");

  // Inline group edit (name + cost)
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [groupEditName, setGroupEditName] = useState("");
  const [groupEditCost, setGroupEditCost] = useState("");
  const [groupEditUnit, setGroupEditUnit] = useState("kg");

  // Assign-to-group dropdown
  const [assignProductId, setAssignProductId] = useState<string | null>(null);

  // Auto-group
  const [autoGrouping, setAutoGrouping] = useState(false);

  // Publish to Shopify (from dialog or group row)
  const [publishOpen, setPublishOpen] = useState(false);
  const [publishProduct, setPublishProduct] = useState<{ id: string; name: string; priceUsd: number | null } | null>(null);
  const [publishSku, setPublishSku] = useState("");
  const [publishPrice, setPublishPrice] = useState("");
  const [publishStatus, setPublishStatus] = useState<"draft" | "active">("draft");
  const [publishing, setPublishing] = useState(false);

  // SKU auto-fill for new product dialog
  // skuLocked = true when user has manually typed in the SKU field
  const [skuLocked, setSkuLocked] = useState(false);

  /** Sinh SKU tự động: timestamp mmHHDDMMYYYY */
  function computeAutoSku(): string {
    return generateSku();
  }

  // Exchange rate for cost calculation
  const [usdToVnd, setUsdToVnd] = useState(25500);
  useEffect(() => {
    fetch("/api/settings").then(r => r.json())
      .then(d => { if (d.usdToVnd) setUsdToVnd(Number(d.usdToVnd)); })
      .catch(() => {});
  }, []);

  // ── Load flat list (for total count) ──
  const load = useCallback(() => {
    const params = new URLSearchParams({
      page: String(page), limit: "50",
      ...(search && { q: search }),
      ...(categoryFilter && { category: categoryFilter }),
      ...(hasSkuFilter && { hasSku: "1" }),
      ...(hasViFilter && { hasVi: "1" }),
    });
    fetch(`/api/products?${params}`).then((r) => r.json()).then(setResp);
  }, [page, search, categoryFilter, hasSkuFilter, hasViFilter]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [search, categoryFilter, hasSkuFilter, hasViFilter]);

  // ── Load groups ──
  const loadGroups = useCallback(async () => {
    setGroupsLoading(true);
    try {
      const [gRes, pRes] = await Promise.all([
        fetch("/api/product-groups").then(r => r.json()),
        fetch("/api/products?page=1&limit=9999").then(r => r.json()),
      ]);
      setGroups(gRes);
      const groupedIds = new Set<string>(gRes.flatMap((g: ProductGroup) => g.products.map((p: GroupProduct) => p.id)));
      setUngrouped((pRes.products as Product[]).filter(p => !groupedIds.has(p.id)).map(p => ({
        id: p.id, name: p.name, nameVi: p.nameVi, skuShopify: p.skuShopify,
        skuAmz: p.skuAmz, skuBros: p.skuBros, priceUsd: p.priceUsd,
        imageUrl: p.imageUrl, unit: p.unit, gramsPerUnit: p.gramsPerUnit,
        piecesPerUnit: p.piecesPerUnit, piecesPerPack: p.piecesPerPack,
        nhungQty: p.nhungQty, category: p.category,
      })));
    } finally {
      setGroupsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch("/api/shopify/image-map").then(r => r.json())
      .then(m => { if (typeof m === "object" && m !== null) setShopifyImages(m); })
      .catch(() => {});
  }, []);

  // Load groups on mount (for Edit dialog dropdown)
  useEffect(() => {
    fetch("/api/product-groups").then(r => r.json()).then(setGroups).catch(() => {});
  }, []);

  useEffect(() => {
    loadGroups();
  }, [loadGroups]);

  // ── Filtered groups for search ──
  const filteredGroups = groupSearch
    ? groups.filter(g =>
        g.name.toLowerCase().includes(groupSearch.toLowerCase()) ||
        g.products.some(p =>
          (p.nameVi || p.name).toLowerCase().includes(groupSearch.toLowerCase()) ||
          (p.skuShopify || "").toLowerCase().includes(groupSearch.toLowerCase())
        )
      )
    : groups;

  // ── Group CRUD ──
  async function createGroup() {
    if (!newGroupName.trim()) return toast.error("Nhập tên nhóm");
    const res = await fetch("/api/product-groups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newGroupName.trim(), baseCostVnd: newGroupCost || null, costUnit: newGroupUnit }),
    });
    if (res.ok) {
      toast.success("Đã tạo nhóm");
      setNewGroupOpen(false);
      setNewGroupName(""); setNewGroupCost(""); setNewGroupUnit("kg");
      loadGroups();
    } else toast.error("Lỗi tạo nhóm");
  }

  function startEditGroup(g: ProductGroup) {
    setEditingGroupId(g.id);
    setGroupEditName(g.name);
    setGroupEditCost(g.baseCostVnd ? String(g.baseCostVnd) : "");
    setGroupEditUnit(g.costUnit);
  }

  async function saveGroupEdit() {
    if (!editingGroupId) return;
    const res = await fetch(`/api/product-groups/${editingGroupId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: groupEditName, baseCostVnd: groupEditCost || null, costUnit: groupEditUnit }),
    });
    if (res.ok) {
      toast.success("Đã lưu nhóm");
      setEditingGroupId(null);
      loadGroups();
    } else toast.error("Lỗi lưu nhóm");
  }

  async function deleteGroup(id: string, name: string) {
    if (!confirm(`Xoá nhóm "${name}"? Sản phẩm trong nhóm sẽ không bị xoá.`)) return;
    await fetch(`/api/product-groups/${id}`, { method: "DELETE" });
    toast.success("Đã xoá nhóm");
    loadGroups();
  }

  async function deleteProduct(id: string, name: string) {
    if (!confirm(`Xoá sản phẩm "${name}"?\nThao tác này không thể hoàn tác.`)) return;
    const res = await fetch(`/api/products/${id}`, { method: "DELETE" });
    if (res.status === 204) {
      toast.success("Đã xoá sản phẩm");
      load();
      loadGroups();
    } else if (res.status === 409) {
      const data = await res.json();
      toast.error(data.error ?? "Sản phẩm có dữ liệu liên quan, không thể xoá");
    } else {
      toast.error("Lỗi xoá sản phẩm");
    }
  }

  async function runAutoGroup() {
    if (!confirm("Tự động gom nhóm tất cả sản phẩm theo tên tiếng Việt?\nSản phẩm đã có nhóm sẽ không bị thay đổi.")) return;
    setAutoGrouping(true);
    try {
      const res = await fetch("/api/product-groups/auto-group", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Đã tạo ${data.groupsCreated} nhóm mới · gán ${data.productsAssigned} sản phẩm`);
        loadGroups();
      } else toast.error("Lỗi auto-group");
    } finally { setAutoGrouping(false); }
  }

  function openPublish(p: { id: string; name: string; nameVi?: string | null; priceUsd: number | null }) {
    setPublishProduct(p);
    setPublishSku(generateSku());
    setPublishPrice(p.priceUsd ? String(p.priceUsd) : "");
    setPublishStatus("draft");
    setPublishOpen(true);
  }

  async function publishToShopify() {
    if (!publishProduct || !publishSku.trim()) return toast.error("Vui lòng nhập SKU");
    setPublishing(true);
    try {
      const res = await fetch(`/api/products/${publishProduct.id}/publish-shopify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sku: publishSku.trim().toUpperCase(),
          priceUsd: publishPrice ? Number(publishPrice) : undefined,
          status: publishStatus,
        }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? "Lỗi đăng Shopify"); return; }
      toast.success(
        publishStatus === "draft"
          ? `Đã tạo draft "${data.sku}" — mở Shopify để review trước khi publish`
          : `Đã publish "${data.sku}" lên Shopify!`
      );
      setPublishOpen(false);
      loadGroups();
    } finally { setPublishing(false); }
  }

  async function assignToGroup(productId: string, groupId: string | null) {
    await fetch(`/api/products/${productId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ groupId }),
    });
    setAssignProductId(null);
    loadGroups();
  }

  function toggleCollapse(id: string) {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  // ── Flat-list CRUD ──
  function openNew() {
    setEditing(null);
    setForm(empty);
    setFormGroupId("");
    setSkuLocked(false);
    setOpen(true);
  }
  function openEdit(p: Product) {
    setEditing(p);
    setForm({
      name: p.name, nameVi: p.nameVi ?? "", skuShopify: p.skuShopify ?? "",
      skuTiktok: p.skuTiktok ?? "", skuAmz: p.skuAmz ?? "", skuBros: p.skuBros ?? "",
      unit: p.unit, gramsPerUnit: p.gramsPerUnit ? String(p.gramsPerUnit) : "",
      piecesPerUnit: p.piecesPerUnit ? String(p.piecesPerUnit) : "",
      piecesPerPack: p.piecesPerPack ? String(p.piecesPerPack) : "",
      restockThreshold: p.restockThreshold ? String(p.restockThreshold) : "10",
      category: p.category ?? "", notes: p.notes ?? "",
    });
    setFormGroupId(p.groupId ?? "");
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
        gramsPerUnit: form.gramsPerUnit ? Number(form.gramsPerUnit) : null,
        piecesPerUnit: form.piecesPerUnit ? Number(form.piecesPerUnit) : null,
        piecesPerPack: form.piecesPerPack ? Number(form.piecesPerPack) : null,
        restockThreshold: form.restockThreshold ? Number(form.restockThreshold) : 10,
        groupId: formGroupId || null,
      }),
    });
    if (res.ok) {
      toast.success(editing ? "Đã cập nhật" : "Đã thêm sản phẩm");
      setOpen(false);
      load();
      loadGroups();
    } else toast.error("Có lỗi xảy ra");
  }

  async function syncShopify() {
    setSyncing(true);
    try {
      const res = await fetch("/api/sync/shopify?type=products", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Sync Shopify: +${data.created ?? 0} mới, cập nhật ${data.updated ?? 0}`);
        load();
      } else toast.error(data.error ?? "Lỗi sync Shopify");
    } finally { setSyncing(false); }
  }

  async function cleanTestData() {
    if (!confirm("Xoá toàn bộ đơn mua, thanh toán và nhà cung cấp test?")) return;
    setCleaning(true);
    try {
      const res = await fetch("/api/admin/clean", { method: "POST" });
      const data = await res.json();
      if (res.ok) toast.success(data.message ?? "Đã xoá dữ liệu test");
      else toast.error("Lỗi xoá dữ liệu");
    } finally { setCleaning(false); }
  }

  function startInlineEdit(p: Product, field: "nameVi" | "skuBros" = "nameVi") {
    setInlineEditId(p.id);
    setInlineEditField(field);
    setInlineVal(field === "nameVi" ? (p.nameVi ?? "") : (p.skuBros ?? ""));
    setTimeout(() => inlineRef.current?.focus(), 50);
  }

  async function saveInlineVi(productId: string) {
    const val = inlineVal.trim();
    const body = inlineEditField === "nameVi" ? { nameVi: val || null } : { skuBros: val || null };
    const res = await fetch(`/api/products/${productId}`, {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    if (res.ok) {
      toast.success(val ? "Đã lưu" : "Đã xoá");
      setInlineEditId(null);
      load();
    } else toast.error("Lỗi lưu");
  }

  const f = (k: keyof typeof empty) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [k]: e.target.value });

  const { total } = resp;

  // ─── Grouped product card ────────────────────────────────────────────────
  function GroupProductRow({ p, group }: { p: GroupProduct; group: ProductGroup }) {
    const img = p.imageUrl ?? (p.skuShopify ? shopifyImages[p.skuShopify] : null);

    // Cost calculation per pack
    let costPerPack: number | null = null;
    let marginPct: number | null = null;
    if (group.baseCostVnd != null) {
      if (p.gramsPerUnit != null && group.costUnit === "kg") {
        // baseCostVnd per kg → cost per pack
        costPerPack = (group.baseCostVnd / 1000) * p.gramsPerUnit;
      } else if (p.piecesPerUnit != null && p.piecesPerPack != null && p.piecesPerUnit > 0) {
        // baseCostVnd per unit → cost per pack
        costPerPack = group.baseCostVnd * (p.piecesPerPack / p.piecesPerUnit);
      } else if (group.costUnit === "pack" || group.costUnit === "gói") {
        costPerPack = group.baseCostVnd;
      }
      if (costPerPack != null && p.priceUsd != null && p.priceUsd > 0) {
        const revenueVnd = p.priceUsd * usdToVnd;
        marginPct = ((revenueVnd - costPerPack) / revenueVnd) * 100;
      }
    }

    return (
      <div className="flex items-center gap-3 py-2.5 px-4 hover:bg-gray-50 border-b border-gray-100 last:border-0 group/row">
        {img ? (
          <img src={img} alt={p.name} className="h-9 w-9 rounded-lg object-cover border border-gray-100 shrink-0" />
        ) : (
          <div className="h-9 w-9 rounded-lg bg-gray-100 shrink-0 flex items-center justify-center">
            <Package className="h-3.5 w-3.5 text-gray-300" />
          </div>
        )}

        {/* Name + SKU */}
        <div className="flex-1 min-w-0">
          <Link href={`/products/${p.id}`} className="text-sm font-medium text-gray-900 hover:text-green-600 hover:underline block truncate">
            {p.name}
          </Link>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            {p.skuShopify && <Badge variant="outline" className="font-mono text-[10px] py-0">{p.skuShopify}</Badge>}
            {p.gramsPerUnit && (
              <span className="text-[10px] text-gray-400">{p.gramsPerUnit}g/gói</span>
            )}
            {p.piecesPerPack && (
              <span className="text-[10px] text-gray-400">{p.piecesPerPack} hạt/gói</span>
            )}
          </div>
        </div>

        {/* Price + Cost + Margin */}
        <div className="flex items-center gap-4 shrink-0 text-right">
          {p.priceUsd != null && (
            <div>
              <div className="text-xs font-semibold text-green-700">${p.priceUsd.toFixed(2)}</div>
              <div className="text-[10px] text-gray-400">{fmt(Math.round(p.priceUsd * usdToVnd))} ₫</div>
            </div>
          )}
          {costPerPack != null && (
            <div>
              <div className="text-xs font-medium text-orange-700">{fmt(Math.round(costPerPack))} ₫</div>
              <div className="text-[10px] text-gray-400">chi phí NL</div>
            </div>
          )}
          {marginPct != null && (
            <div className={`text-xs font-semibold ${marginPct >= 60 ? "text-emerald-600" : marginPct >= 40 ? "text-amber-600" : "text-red-500"}`}>
              {marginPct.toFixed(0)}%
            </div>
          )}
          {p.nhungQty > 0 && (
            <span className="text-[10px] text-gray-400 flex items-center gap-0.5">
              <Home className="h-3 w-3 text-orange-400" />{p.nhungQty}
            </span>
          )}
        </div>

        {/* Action buttons (show on hover) */}
        <div className="opacity-0 group-hover/row:opacity-100 flex items-center gap-0.5 transition-all shrink-0">
          {/* Publish to Shopify — only if no skuShopify yet */}
          {!p.skuShopify && (
            <button
              onClick={() => openPublish({ id: p.id, name: p.name, nameVi: p.nameVi, priceUsd: p.priceUsd })}
              className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 transition-colors"
              title="Tạo listing Shopify"
            >
              <Upload className="h-2.5 w-2.5" /> Shopify
            </button>
          )}
          {/* Remove from group */}
          <button
            onClick={() => assignToGroup(p.id, null)}
            className="p-1 rounded hover:bg-orange-50 text-gray-300 hover:text-orange-500 transition-all"
            title="Gỡ khỏi nhóm"
          >
            <X className="h-3.5 w-3.5" />
          </button>
          {/* Delete product */}
          <button
            onClick={() => deleteProduct(p.id, p.nameVi ?? p.name)}
            className="p-1 rounded hover:bg-red-50 text-gray-300 hover:text-red-600 transition-all"
            title="Xoá sản phẩm"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    );
  }

  // ─── Ungrouped mini-row ──────────────────────────────────────────────────
  function UngroupedRow({ p }: { p: GroupProduct }) {
    const img = p.imageUrl ?? (p.skuShopify ? shopifyImages[p.skuShopify] : null);
    const isAssigning = assignProductId === p.id;
    return (
      <div className="flex items-center gap-3 py-2 px-4 hover:bg-gray-50 border-b border-gray-100 last:border-0 group/urow">
        {img ? (
          <img src={img} alt={p.name} className="h-8 w-8 rounded object-cover border border-gray-100 shrink-0" />
        ) : (
          <div className="h-8 w-8 rounded bg-gray-100 shrink-0 flex items-center justify-center">
            <Package className="h-3 w-3 text-gray-300" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <span className="text-sm text-gray-700 truncate block">{p.nameVi || p.name}</span>
          {p.skuShopify && <span className="font-mono text-[10px] text-gray-400">{p.skuShopify}</span>}
        </div>
        <div className="opacity-0 group-hover/urow:opacity-100 flex items-center gap-1.5 transition-all">
          {/* Publish to Shopify */}
          {!p.skuShopify && (
            <button
              onClick={() => openPublish({ id: p.id, name: p.name, nameVi: p.nameVi, priceUsd: p.priceUsd })}
              className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 transition-colors"
            >
              <Upload className="h-2.5 w-2.5" /> Shopify
            </button>
          )}
          {/* Assign to group */}
          {isAssigning ? (
            <div className="flex items-center gap-1">
              <select
                autoFocus
                className="h-7 rounded border border-gray-300 bg-white text-xs px-2 focus:outline-none focus:ring-1 focus:ring-green-400"
                defaultValue=""
                onChange={(e) => { if (e.target.value) assignToGroup(p.id, e.target.value); }}
              >
                <option value="" disabled>Chọn nhóm...</option>
                {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
              <button onClick={() => setAssignProductId(null)} className="p-1 rounded hover:bg-gray-100 text-gray-400">
                <X className="h-3 w-3" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setAssignProductId(p.id)}
              className="text-[10px] text-gray-400 hover:text-green-600 border border-dashed border-gray-300 hover:border-green-400 rounded px-2 py-1 transition-all flex items-center gap-1"
            >
              <Tag className="h-2.5 w-2.5" /> Gán nhóm
            </button>
          )}
          {/* Delete product */}
          {!isAssigning && (
            <button
              onClick={() => deleteProduct(p.id, p.nameVi ?? p.name)}
              className="p-1 rounded hover:bg-red-50 text-gray-300 hover:text-red-600 transition-all"
              title="Xoá sản phẩm"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    );
  }

  // ─── Render ──────────────────────────────────────────────────────────────
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
            {syncing ? "Đang sync..." : "Sync Shopify"}
          </Button>
          <Button variant="outline" size="sm" onClick={cleanTestData} disabled={cleaning}
            className="text-xs text-red-500 hover:text-red-600 hover:border-red-300">
            <Trash2 className="mr-1.5 h-3.5 w-3.5" />
            {cleaning ? "Đang xoá..." : "Xoá data test"}
          </Button>
          <Button onClick={runAutoGroup} disabled={autoGrouping} variant="outline" className="text-xs border-purple-300 text-purple-700 hover:bg-purple-50">
            <Layers className={`mr-1.5 h-3.5 w-3.5 ${autoGrouping ? "animate-spin" : ""}`} />
            {autoGrouping ? "Đang nhóm..." : "Auto-nhóm"}
          </Button>
          <Button onClick={() => setNewGroupOpen(true)} variant="outline" className="text-xs border-green-300 text-green-700 hover:bg-green-50">
            <Plus className="mr-1.5 h-3.5 w-3.5" /> Tạo nhóm
          </Button>
          <Button onClick={openNew} className="bg-green-600 hover:bg-green-700">
            <Plus className="mr-2 h-4 w-4" /> Thêm sản phẩm
          </Button>
        </div>
      </div>

      {/* ─── GROUPED VIEW ─────────────────────────────────────────────────── */}
      <div className="space-y-4">
        {/* Search + stats */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Tìm nhóm hoặc sản phẩm..."
              className="pl-9 h-8 text-sm"
              value={groupSearch}
              onChange={(e) => setGroupSearch(e.target.value)}
            />
          </div>
          {!groupsLoading && groups.length > 0 && (
            <>
              <div className="text-xs text-gray-400">
                <span className="font-medium text-gray-700">{groups.length}</span> nhóm ·{" "}
                <span className="font-medium text-gray-700">{groups.reduce((s, g) => s + g.products.length, 0)}</span> sản phẩm có nhóm ·{" "}
                <span className="font-medium text-gray-700">{ungrouped.length}</span> chưa có nhóm
              </div>
              <div className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                {groups.filter(g => g.baseCostVnd == null).length} nhóm chưa có giá mua gốc
              </div>
            </>
          )}
        </div>

        {groupsLoading ? (
          <div className="flex items-center justify-center py-16 text-gray-400 text-sm gap-2">
            <RefreshCw className="h-4 w-4 animate-spin" /> Đang tải...
          </div>
        ) : (
          <>
            {groups.length === 0 && (
              <div className="rounded-xl border border-dashed border-gray-200 p-10 text-center text-gray-400">
                <Layers className="h-8 w-8 mx-auto mb-2 text-gray-200" />
                <p className="text-sm">Chưa có nhóm sản phẩm nào.</p>
                <p className="text-xs mt-1">Nhấn <span className="font-medium text-green-600">Tạo nhóm</span> để bắt đầu gom các SKU cùng loại.</p>
              </div>
            )}

            {filteredGroups.map((g) => {
              const collapsed = collapsedGroups.has(g.id);
              const isEditing = editingGroupId === g.id;
              // Estimated cost per unit for info
              const totalRevUsd = g.products.reduce((s, p) => s + (p.priceUsd ?? 0), 0);

              return (
                <div key={g.id} className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                  {/* Group Header */}
                  <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 border-b border-gray-200">
                    <button onClick={() => toggleCollapse(g.id)} className="text-gray-400 hover:text-gray-600">
                      {collapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                    </button>

                    {isEditing ? (
                      <div className="flex flex-1 items-center gap-2 flex-wrap">
                        <input
                          autoFocus
                          value={groupEditName}
                          onChange={e => setGroupEditName(e.target.value)}
                          onKeyDown={e => { if (e.key === "Enter") saveGroupEdit(); if (e.key === "Escape") setEditingGroupId(null); }}
                          className="h-7 rounded border border-gray-300 px-2 text-sm font-semibold focus:outline-none focus:ring-1 focus:ring-green-400 w-48"
                          placeholder="Tên nhóm"
                        />
                        <div className="flex items-center gap-1.5">
                          <DollarSign className="h-3.5 w-3.5 text-gray-400" />
                          <input
                            value={groupEditCost}
                            onChange={e => setGroupEditCost(e.target.value)}
                            type="number"
                            className="h-7 rounded border border-gray-300 px-2 text-xs focus:outline-none focus:ring-1 focus:ring-green-400 w-32"
                            placeholder="Giá mua gốc (VND)"
                          />
                          <span className="text-xs text-gray-400">/</span>
                          <input
                            value={groupEditUnit}
                            onChange={e => setGroupEditUnit(e.target.value)}
                            className="h-7 rounded border border-gray-300 px-2 text-xs focus:outline-none focus:ring-1 focus:ring-green-400 w-16"
                            placeholder="kg"
                          />
                        </div>
                        <button onClick={saveGroupEdit} className="p-1.5 rounded bg-green-600 text-white hover:bg-green-700">
                          <Check className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => setEditingGroupId(null)} className="p-1.5 rounded hover:bg-gray-200 text-gray-500">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-1 items-center gap-3 flex-wrap min-w-0">
                        <span className="font-semibold text-gray-900 text-sm">{g.name}</span>
                        <Badge variant="outline" className="text-[10px]">
                          {g.products.length} SKU
                        </Badge>
                        {g.baseCostVnd != null && (
                          <span className="flex items-center gap-1 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-2 py-0.5">
                            <DollarSign className="h-3 w-3" />
                            Mua gốc: {fmt(g.baseCostVnd)} ₫/{g.costUnit}
                          </span>
                        )}
                        {totalRevUsd > 0 && (
                          <span className="text-[10px] text-gray-400">
                            Tổng giá bán: ${totalRevUsd.toFixed(2)}
                          </span>
                        )}
                      </div>
                    )}

                    {!isEditing && (
                      <div className="flex items-center gap-1 ml-auto shrink-0">
                        <button onClick={() => startEditGroup(g)} className="p-1.5 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-700" title="Sửa nhóm">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => deleteGroup(g.id, g.name)} className="p-1.5 rounded hover:bg-red-50 text-gray-300 hover:text-red-500" title="Xoá nhóm">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Group Products */}
                  {!collapsed && (
                    g.products.length === 0 ? (
                      <div className="px-4 py-5 text-center text-xs text-gray-400">
                        Chưa có sản phẩm. Kéo sản phẩm từ &quot;Chưa có nhóm&quot; vào đây.
                      </div>
                    ) : (
                      <div>
                        {/* Column header */}
                        <div className="flex items-center gap-3 px-4 py-1.5 bg-gray-50/50 border-b border-gray-100 text-[10px] font-medium text-gray-400 uppercase tracking-wide">
                          <div className="w-9 shrink-0" />
                          <div className="flex-1">Sản phẩm / SKU</div>
                          <div className="flex items-center gap-4 shrink-0 text-right">
                            <span className="w-16">Giá bán</span>
                            {g.baseCostVnd != null && <span className="w-20">Chi phí NL</span>}
                            {g.baseCostVnd != null && <span className="w-10">Margin</span>}
                          </div>
                          <div className="w-6 shrink-0" />
                        </div>
                        {g.products.map(p => <GroupProductRow key={p.id} p={p} group={g} />)}
                      </div>
                    )
                  )}
                </div>
              );
            })}

            {/* Ungrouped products */}
            {ungrouped.length > 0 && (
              <div className="rounded-xl border border-dashed border-gray-200 bg-white overflow-hidden">
                <div className="px-4 py-2.5 bg-gray-50/60 border-b border-gray-200 flex items-center gap-2">
                  <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Chưa có nhóm</span>
                  <Badge variant="outline" className="text-[10px]">{ungrouped.length}</Badge>
                </div>
                {ungrouped.map(p => <UngroupedRow key={p.id} p={p} />)}
              </div>
            )}
          </>
        )}
      </div>

      {/* ─── New Group Dialog ─────────────────────────────────────────────── */}
      <Dialog open={newGroupOpen} onOpenChange={setNewGroupOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Tạo nhóm sản phẩm mới</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>Tên nhóm *</Label>
              <Input autoFocus placeholder="VD: Mung Bean Seeds" value={newGroupName}
                onChange={e => setNewGroupName(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") createGroup(); }} />
              <p className="text-xs text-gray-400">Đặt tên theo loại hàng, VD: &quot;Lotus Seed&quot;, &quot;Dill Weed&quot;</p>
            </div>
            <div className="space-y-1.5">
              <Label>Giá mua gốc (VND)</Label>
              <div className="flex gap-2">
                <Input type="number" placeholder="VD: 150000" value={newGroupCost} onChange={e => setNewGroupCost(e.target.value)} className="flex-1" />
                <Input placeholder="kg" value={newGroupUnit} onChange={e => setNewGroupUnit(e.target.value)} className="w-20" />
              </div>
              <p className="text-xs text-gray-400">Giá thu mua nguyên liệu thô trên 1 đơn vị</p>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => setNewGroupOpen(false)}>Huỷ</Button>
              <Button onClick={createGroup} className="bg-green-600 hover:bg-green-700">Tạo nhóm</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Edit / Create Product Dialog ────────────────────────────────── */}
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
              <Input
                placeholder="VD: Lotus Seed 200g"
                value={form.name}
                onChange={(e) => {
                  const newName = e.target.value;
                  const sku = !editing && !skuLocked
                    ? computeAutoSku()
                    : form.skuShopify;
                  setForm(prev => ({ ...prev, name: newName, skuShopify: sku }));
                }}
              />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Tên tiếng Việt</Label>
              <Input
                placeholder="VD: Hạt sen"
                value={form.nameVi}
                onChange={(e) => {
                  const newVi = e.target.value;
                  const sku = !editing && !skuLocked
                    ? computeAutoSku()
                    : form.skuShopify;
                  setForm(prev => ({ ...prev, nameVi: newVi, skuShopify: sku }));
                }}
              />
            </div>

            {/* Group selector */}
            <div className="col-span-2 space-y-1.5">
              <Label>Nhóm sản phẩm</Label>
              <select
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                value={formGroupId}
                onChange={e => {
                  const newGid = e.target.value;
                  setFormGroupId(newGid);
                  if (!editing && !skuLocked) {
                    const sku = computeAutoSku();
                    setForm(prev => ({ ...prev, skuShopify: sku }));
                  }
                }}
              >
                <option value="">— Không thuộc nhóm —</option>
                {groups.map(g => (
                  <option key={g.id} value={g.id}>
                    {g.name}{g.baseCostVnd ? ` · ${fmt(g.baseCostVnd)} ₫/${g.costUnit}` : ""}
                  </option>
                ))}
              </select>
            </div>

            {/* SKUs */}
            <div className="col-span-2 rounded-lg border border-gray-100 bg-gray-50 p-3 space-y-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">SKU & Mã hàng</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs flex items-center justify-between">
                    SKU Shopify
                    {!editing && (
                      skuLocked ? (
                        <button
                          type="button"
                          onClick={() => {
                            setSkuLocked(false);
                            setForm(prev => ({ ...prev, skuShopify: computeAutoSku() }));
                          }}
                          className="flex items-center gap-1 text-[10px] text-purple-600 hover:text-purple-700 font-medium"
                        >
                          <Sparkles className="h-2.5 w-2.5" /> Gợi ý lại
                        </button>
                      ) : (
                        <span className="flex items-center gap-1 text-[10px] text-emerald-600 font-medium">
                          <Sparkles className="h-2.5 w-2.5" />
                          {formGroupId ? "Từ nhóm NL" : "Tự động"}
                        </span>
                      )
                    )}
                  </Label>
                  <Input
                    placeholder={!editing && !skuLocked ? "Gõ tên sản phẩm để tự sinh SKU..." : "VD: HS-0514-200G"}
                    value={form.skuShopify}
                    onChange={(e) => {
                      setSkuLocked(true);
                      setForm(prev => ({ ...prev, skuShopify: e.target.value.toUpperCase() }));
                    }}
                    className="font-mono"
                  />
                  {!editing && !skuLocked && form.skuShopify && (
                    <p className="text-[10px] text-emerald-600">
                      ✓ {formGroupId
                        ? "SKU sinh từ nhóm NL + ngày + gram · Chỉnh tay để khoá"
                        : "SKU sinh tự động theo tên · Chọn nhóm NL để sinh chuẩn hơn"}
                    </p>
                  )}
                </div>
                <div className="space-y-1.5"><Label className="text-xs">SKU TikTok</Label><Input placeholder="VD: TT-LOTUS-500" value={form.skuTiktok} onChange={f("skuTiktok")} /></div>
                <div className="space-y-1.5"><Label className="text-xs">SKU Amazon</Label><Input placeholder="VD: AMZ-LOTUS" value={form.skuAmz} onChange={f("skuAmz")} /></div>
                <div className="space-y-1.5">
                  <Label className="text-xs flex items-center gap-1.5">SKU Bros <span className="font-normal text-gray-400 bg-gray-100 rounded px-1.5 py-0.5">Kho US</span></Label>
                  <Input placeholder="Để trống = dùng SKU Amazon" value={form.skuBros} onChange={f("skuBros")} />
                </div>
              </div>
            </div>

            <div className="space-y-1.5"><Label>Đơn vị mua</Label><Input placeholder="kg / gói / hộp" value={form.unit} onChange={f("unit")} /></div>
            <div className="space-y-1.5"><Label>Danh mục</Label><Input placeholder="Hạt / Trà / Thảo mộc" value={form.category} onChange={f("category")} /></div>

            {/* Weight-based */}
            <div className="col-span-2 rounded-lg border border-gray-100 bg-gray-50 p-3 space-y-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Đóng gói theo trọng lượng</p>
              <div className="space-y-1.5">
                <Label className="text-xs">Gram / gói bán</Label>
                <Input
                  type="number"
                  placeholder="VD: 200"
                  value={form.gramsPerUnit}
                  onChange={(e) => {
                    const v = e.target.value;
                    setForm(prev => {
                      const next = { ...prev, gramsPerUnit: v };
                      if (!editing && !skuLocked) {
                        next.skuShopify = computeAutoSku();
                      }
                      return next;
                    });
                  }}
                />
                <p className="text-xs text-gray-400">VD: 200 → 1kg mua được 5 gói 200g</p>
              </div>
            </div>

            {/* Count-based */}
            <div className="col-span-2 rounded-lg border border-orange-100 bg-orange-50 p-3 space-y-3">
              <p className="text-xs font-semibold text-orange-600 uppercase tracking-wide">Đóng gói theo số lượng</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Số hạt / đơn vị mua</Label>
                  <Input type="number" placeholder="VD: 1000" value={form.piecesPerUnit} onChange={f("piecesPerUnit")} />
                  <p className="text-xs text-gray-400">1 {form.unit || "lạng"} = ? hạt</p>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Số hạt / gói bán</Label>
                  <Input
                    type="number"
                    placeholder="VD: 150"
                    value={form.piecesPerPack}
                    onChange={(e) => {
                      const v = e.target.value;
                      setForm(prev => {
                        const next = { ...prev, piecesPerPack: v };
                        if (!editing && !skuLocked && !prev.gramsPerUnit) {
                          next.skuShopify = computeAutoSku();
                        }
                        return next;
                      });
                    }}
                  />
                  <p className="text-xs text-gray-400">1 gói = ? hạt</p>
                </div>
              </div>
              {form.piecesPerUnit && form.piecesPerPack && (
                <p className="text-xs text-orange-700 font-medium">
                  → 1 {form.unit || "đơn vị"} = {Math.floor(Number(form.piecesPerUnit) / Number(form.piecesPerPack))} gói
                  {Number(form.piecesPerUnit) % Number(form.piecesPerPack) > 0
                    ? ` (dư ${Number(form.piecesPerUnit) % Number(form.piecesPerPack)} hạt)` : " (chính xác)"}
                </p>
              )}
            </div>

            <div className="space-y-1.5"><Label>Ngưỡng tồn kho</Label><Input type="number" placeholder="10" value={form.restockThreshold} onChange={f("restockThreshold")} /></div>
            <div className="col-span-2 space-y-1.5"><Label>Ghi chú</Label><Input value={form.notes} onChange={f("notes")} /></div>
            <div className="col-span-2 flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setOpen(false)}>Huỷ</Button>
              <Button onClick={save} className="bg-green-600 hover:bg-green-700">{editing ? "Cập nhật" : "Thêm mới"}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Publish to Shopify Dialog ───────────────────────────────────── */}
      <Dialog open={publishOpen} onOpenChange={setPublishOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="h-4 w-4 text-emerald-600" />
              Tạo listing Shopify
            </DialogTitle>
          </DialogHeader>
          {publishProduct && (
            <div className="space-y-4 pt-1">
              <div className="rounded-lg bg-gray-50 border border-gray-100 px-3 py-2.5">
                <p className="text-sm font-medium text-gray-900 truncate">{publishProduct.name}</p>
                <p className="text-xs text-gray-400 mt-0.5">Sản phẩm sẽ được tạo trên Shopify với thông tin dưới đây</p>
              </div>

              {/* SKU */}
              <div className="space-y-1.5">
                <Label className="flex items-center justify-between">
                  SKU Shopify *
                  <button
                    type="button"
                    onClick={() => setPublishSku(generateSku())}
                    className="flex items-center gap-1 text-[10px] text-purple-600 hover:text-purple-700 font-medium"
                  >
                    <Sparkles className="h-2.5 w-2.5" /> Gợi ý lại
                  </button>
                </Label>
                <Input
                  placeholder="VD: LOTUS-SEED-200G"
                  value={publishSku}
                  onChange={e => setPublishSku(e.target.value.toUpperCase())}
                  className="font-mono"
                />
                <p className="text-xs text-gray-400">SKU sẽ được lưu vào database và Shopify. Chỉnh sửa nếu cần.</p>
              </div>

              {/* Price */}
              <div className="space-y-1.5">
                <Label>Giá bán (USD)</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="9.99"
                    value={publishPrice}
                    onChange={e => setPublishPrice(e.target.value)}
                    className="pl-7"
                  />
                </div>
              </div>

              {/* Status */}
              <div className="space-y-1.5">
                <Label>Trạng thái ban đầu</Label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setPublishStatus("draft")}
                    className={`flex-1 rounded-lg border py-2 text-xs font-medium transition-colors ${
                      publishStatus === "draft"
                        ? "bg-gray-900 text-white border-gray-900"
                        : "border-gray-200 text-gray-600 hover:border-gray-300"
                    }`}
                  >
                    Draft (ẩn)
                  </button>
                  <button
                    type="button"
                    onClick={() => setPublishStatus("active")}
                    className={`flex-1 rounded-lg border py-2 text-xs font-medium transition-colors ${
                      publishStatus === "active"
                        ? "bg-emerald-600 text-white border-emerald-600"
                        : "border-gray-200 text-gray-600 hover:border-gray-300"
                    }`}
                  >
                    Active (công khai)
                  </button>
                </div>
                <p className="text-xs text-gray-400">
                  {publishStatus === "draft"
                    ? "Tạo ẩn để review trên Shopify Admin trước khi publish."
                    : "Đăng công khai ngay trên store."}
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <Button variant="outline" onClick={() => setPublishOpen(false)}>Huỷ</Button>
                <Button
                  onClick={publishToShopify}
                  disabled={publishing || !publishSku.trim()}
                  className="bg-emerald-600 hover:bg-emerald-700 gap-2"
                >
                  {publishing ? (
                    <><RefreshCw className="h-3.5 w-3.5 animate-spin" /> Đang tạo...</>
                  ) : (
                    <><Upload className="h-3.5 w-3.5" /> Tạo trên Shopify</>
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
