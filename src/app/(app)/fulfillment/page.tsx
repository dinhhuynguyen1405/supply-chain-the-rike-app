"use client";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { formatDate } from "@/lib/utils";
import {
  Plus, Trash2, CheckCircle2, Circle, Send, Package,
  Home, Warehouse, RefreshCw, Bell, Truck, UserCircle2
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Product { id: string; name: string; nameVi: string | null; skuAmz: string | null; skuShopify: string | null; nhungQty?: number; }

interface FulfillmentItem {
  id: string; productId: string | null; product: Product | null;
  skuRaw: string | null; productName: string; quantity: number;
  warehouseSource: string | null; notes: string | null;
}

interface FulfillmentOrder {
  id: string; code: string; source: string; shopifyOrderId: string | null;
  customerName: string | null; customerAddress: string | null; customerNote: string | null;
  status: string;
  warehouseSource: string | null;
  nhungNotifiedAt: string | null; nhungShippedAt: string | null; nhungTrackingCode: string | null;
  brosNotifiedAt: string | null; brosShippedAt: string | null; brosTrackingCode: string | null;
  shippedAt: string | null; trackingCode: string | null;
  tdSheetSynced: boolean; noteSentToTd: string | null; notes: string | null;
  createdAt: string; items: FulfillmentItem[];
  shopifyFulfilled?: boolean; // derived — true if the Shopify order is already fulfilled
}

interface NewItem { productId: string; skuRaw: string; productName: string; quantity: string; notes: string; }

// ─── Constants ───────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  pending: "Chờ xử lý", notified: "Đã thông báo kho", shipped: "Đã ship", done: "Hoàn tất", cancelled: "Đã huỷ",
};
const STATUS_COLORS: Record<string, string> = {
  pending: "bg-gray-100 text-gray-600", notified: "bg-blue-100 text-blue-700",
  shipped: "bg-purple-100 text-purple-700", done: "bg-green-100 text-green-700", cancelled: "bg-red-100 text-red-600",
};
const SOURCE_LABELS: Record<string, string> = { shopify: "Shopify", tiktok: "TikTok", manual: "Thủ công" };
const SOURCE_COLORS: Record<string, string> = {
  shopify: "bg-emerald-100 text-emerald-700", tiktok: "bg-pink-100 text-pink-700", manual: "bg-gray-100 text-gray-600",
};
const WH_LABELS: Record<string, string> = { nhung: "Kho Nhung", bros: "Kho Bros", mixed: "Hỗn hợp" };
const WH_COLORS: Record<string, string> = {
  nhung: "bg-orange-100 text-orange-700 border-orange-200",
  bros: "bg-purple-100 text-purple-700 border-purple-200",
  mixed: "bg-blue-100 text-blue-700 border-blue-200",
};
const WH_ITEM_COLORS: Record<string, string> = {
  nhung: "bg-orange-50 border-l-2 border-orange-300",
  bros: "bg-purple-50 border-l-2 border-purple-300",
};

function emptyItem(): NewItem { return { productId: "", skuRaw: "", productName: "", quantity: "1", notes: "" }; }

// ─── Component ───────────────────────────────────────────────────────────────

export default function FulfillmentPage() {
  const [orders, setOrders] = useState<FulfillmentOrder[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterWh, setFilterWh] = useState<"all" | "nhung" | "bros" | "done">("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [trackingOpen, setTrackingOpen] = useState(false);
  const [trackingTarget, setTrackingTarget] = useState<{ orderId: string; action: string; label: string } | null>(null);
  const [trackingInput, setTrackingInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    source: "shopify", shopifyOrderId: "", customerName: "",
    customerAddress: "", customerNote: "", notes: "",
  });
  const [items, setItems] = useState<NewItem[]>([emptyItem()]);

  async function load() {
    setLoading(true);
    try {
      const [foRes, prodRes] = await Promise.all([
        fetch("/api/fulfillment"),
        fetch("/api/products?limit=200"),
      ]);
      setOrders(await foRes.json());
      const prodData = await prodRes.json();
      setProducts(Array.isArray(prodData) ? prodData : (prodData.products ?? []));
    } catch { toast.error("Lỗi tải dữ liệu"); } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  function updateItem(idx: number, field: keyof NewItem, value: string) {
    setItems((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      if (field === "productId" && value) {
        const prod = products.find((p) => p.id === value);
        if (prod) { next[idx].productName = prod.nameVi ?? prod.name; next[idx].skuRaw = prod.skuAmz ?? prod.skuShopify ?? ""; }
      }
      return next;
    });
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (items.some((it) => !it.productName || !it.quantity)) { toast.error("Vui lòng điền đủ thông tin"); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/fulfillment", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          items: items.map((it) => ({ productId: it.productId || null, skuRaw: it.skuRaw || null, productName: it.productName, quantity: Number(it.quantity), notes: it.notes || null })),
        }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error("Có lỗi xảy ra"); return; }
      const whLabel = WH_LABELS[data.warehouseSource ?? "nhung"] ?? "";
      toast.success(`Đã tạo lệnh — phân công: ${whLabel}`);
      setCreateOpen(false);
      setForm({ source: "shopify", shopifyOrderId: "", customerName: "", customerAddress: "", customerNote: "", notes: "" });
      setItems([emptyItem()]);
      load();
    } finally { setSaving(false); }
  }

  async function warehouseAction(orderId: string, action: string, trackingCode?: string) {
    setSaving(true);
    try {
      const res = await fetch(`/api/fulfillment/${orderId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, trackingCode: trackingCode || undefined }),
      });
      if (!res.ok) { toast.error("Có lỗi xảy ra"); return; }
      const labels: Record<string, string> = {
        nhung_notify: "Đã thông báo Kho Nhung ✓",
        nhung_shipped: "Kho Nhung đã ship ✓",
        bros_notify: "Đã thông báo Kho Bros ✓",
        bros_shipped: "Kho Bros đã ship ✓",
        done: "Đơn hoàn tất ✓",
        cancelled: "Đã huỷ đơn",
      };
      toast.success(labels[action] ?? "Đã cập nhật");
      load();
    } finally { setSaving(false); }
  }

  async function handleDelete(id: string) {
    if (!confirm("Xoá lệnh đóng hàng này?")) return;
    await fetch(`/api/fulfillment/${id}`, { method: "DELETE" });
    toast.success("Đã xoá"); load();
  }

  // An order is considered "effectively done" if our status is done/cancelled OR
  // if Shopify has already fulfilled it (label created, item prepared on US side).
  function isEffectivelyDone(o: FulfillmentOrder) {
    return o.status === "done" || o.status === "cancelled" || o.shopifyFulfilled === true;
  }

  // Filter
  const filtered = orders.filter((o) => {
    if (filterWh === "all") return !isEffectivelyDone(o);
    if (filterWh === "done") return isEffectivelyDone(o);
    return (o.warehouseSource === filterWh || o.warehouseSource === "mixed") && !isEffectivelyDone(o);
  });

  const pendingNhung = orders.filter((o) => (o.warehouseSource === "nhung" || o.warehouseSource === "mixed") && !o.nhungShippedAt && !isEffectivelyDone(o)).length;
  const pendingBros = orders.filter((o) => (o.warehouseSource === "bros" || o.warehouseSource === "mixed") && !o.brosShippedAt && !isEffectivelyDone(o)).length;

  if (loading) return <div className="flex h-64 items-center justify-center"><div className="h-6 w-6 animate-spin rounded-full border-2 border-green-600 border-t-transparent" /></div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Lệnh đóng hàng</h1>
          <p className="text-sm text-gray-500">Ưu tiên kho Nhung → kho Bros tự động</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button onClick={() => setCreateOpen(true)} className="bg-green-600 hover:bg-green-700 text-white gap-1.5">
            <Plus className="h-4 w-4" /> Tạo lệnh mới
          </Button>
        </div>
      </div>

      {/* Warehouse summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-3 border-orange-200 bg-orange-50">
          <div className="flex items-center gap-2">
            <Home className="h-4 w-4 text-orange-500" />
            <div>
              <p className="text-xs text-orange-600">Kho Nhung chờ xử lý</p>
              <p className="text-xl font-bold text-orange-700">{pendingNhung}</p>
            </div>
          </div>
        </Card>
        <Card className="p-3 border-purple-200 bg-purple-50">
          <div className="flex items-center gap-2">
            <Warehouse className="h-4 w-4 text-purple-500" />
            <div>
              <p className="text-xs text-purple-600">Kho Bros chờ xử lý</p>
              <p className="text-xl font-bold text-purple-700">{pendingBros}</p>
            </div>
          </div>
        </Card>
        <Card className="p-3 border-green-200 bg-green-50">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            <div>
              <p className="text-xs text-green-600">Hoàn tất hôm nay</p>
              <p className="text-xl font-bold text-green-700">
                {orders.filter((o) => o.status === "done" && o.createdAt.startsWith(new Date().toISOString().slice(0, 10))).length}
              </p>
            </div>
          </div>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-gray-400" />
            <div>
              <p className="text-xs text-gray-500">Tổng đơn</p>
              <p className="text-xl font-bold text-gray-700">{orders.length}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 rounded-xl bg-gray-100 p-1 w-fit flex-wrap">
        {[
          { key: "all" as const, label: "Đang xử lý", count: orders.filter((o) => !isEffectivelyDone(o)).length },
          { key: "nhung" as const, label: "Kho Nhung", count: pendingNhung, icon: <Home className="h-3.5 w-3.5" /> },
          { key: "bros" as const, label: "Kho Bros", count: pendingBros, icon: <Warehouse className="h-3.5 w-3.5" /> },
          { key: "done" as const, label: "Hoàn tất / Huỷ", count: orders.filter((o) => isEffectivelyDone(o)).length },
        ].map((item) => (
          <button
            key={item.key}
            onClick={() => setFilterWh(item.key)}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${filterWh === item.key ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
          >
            {item.icon}{item.label}
            <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${filterWh === item.key ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-500"}`}>{item.count}</span>
          </button>
        ))}
      </div>

      {/* Order cards */}
      {filtered.length === 0 ? (
        <Card className="p-10 text-center text-gray-400">Không có đơn nào{filterWh !== "all" ? ` cho ${WH_LABELS[filterWh] ?? filterWh}` : ""}</Card>
      ) : (
        <div className="space-y-4">
          {filtered.map((order) => {
            const ws = order.warehouseSource ?? "nhung";
            const isNhung = ws === "nhung" || ws === "mixed";
            const isBros = ws === "bros" || ws === "mixed";
            const nhungDone = !!order.nhungShippedAt;
            const brosDone = !!order.brosShippedAt;

            return (
              <Card key={order.id} className={`p-4 space-y-3 shadow-[0_2px_8px_-4px_rgba(0,0,0,0.1)] border-l-4 ${ws === "nhung" ? "border-l-orange-400" : ws === "bros" ? "border-l-purple-400" : "border-l-blue-400"} hover:shadow-md transition-shadow`}>
                {/* Header row */}
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-base font-bold text-gray-900 tracking-tight">{order.code}</span>
                    <Badge variant="outline" className={SOURCE_COLORS[order.source] ?? "bg-gray-100 text-gray-600"}>
                      {SOURCE_LABELS[order.source] ?? order.source}
                    </Badge>
                    <Badge variant="outline" className={`border ${WH_COLORS[ws] ?? "bg-gray-100 text-gray-600"}`}>
                      {ws === "nhung" && <Home className="h-3 w-3 mr-1 inline" />}
                      {ws === "bros" && <Warehouse className="h-3 w-3 mr-1 inline" />}
                      {WH_LABELS[ws] ?? ws}
                    </Badge>
                    <Badge variant="outline" className={STATUS_COLORS[order.status] ?? "bg-gray-100 text-gray-600"}>
                      {STATUS_LABELS[order.status] ?? order.status}
                    </Badge>
                    {order.shopifyFulfilled && (
                      <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]">
                        ✓ Shopify đã fulfilled
                      </Badge>
                    )}
                    {order.shopifyOrderId && <span className="text-xs text-gray-400 font-mono">#{order.shopifyOrderId}</span>}
                  </div>
                  <button onClick={() => handleDelete(order.id)} className="text-gray-300 hover:text-red-500 transition-colors p-1" title="Xoá">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 pt-1">
                  
                  {/* Cột 1: Thông tin khách & Kho xử lý */}
                  <div className="md:col-span-4 space-y-3 border-r border-gray-100 pr-4">
                    {/* Customer */}
                    {(order.customerName || order.customerAddress) ? (
                      <div className="text-xs space-y-1">
                        <div className="flex items-center gap-1.5 text-gray-700 font-semibold">
                          <UserCircle2 className="h-3.5 w-3.5 text-gray-400" />
                          {order.customerName || "Khách hàng"}
                        </div>
                        {order.customerAddress && <p className="text-gray-500 line-clamp-2 pl-5">{order.customerAddress}</p>}
                        {order.customerNote && <p className="text-amber-600 italic pl-5 line-clamp-2">Ghi chú: {order.customerNote}</p>}
                      </div>
                    ) : (
                      <div className="text-xs text-gray-400 italic">Không có thông tin KH</div>
                    )}
                  </div>

                  {/* Cột 2: Items */}
                  <div className="md:col-span-8 flex flex-col gap-2">
                    <div className="space-y-1">
                      {order.items.map((item) => {
                        const itemWh = item.warehouseSource ?? "nhung";
                        return (
                          <div key={item.id} className="flex items-center justify-between py-1 border-b border-gray-50 last:border-0 hover:bg-gray-50 rounded px-1 transition-colors">
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              {itemWh === "nhung"
                                ? <Home className="h-3 w-3 text-orange-400 shrink-0" />
                                : <Warehouse className="h-3 w-3 text-purple-400 shrink-0" />}
                              <span className="text-sm font-medium text-gray-800 truncate">{item.productName}</span>
                              {(item.skuRaw ?? item.product?.skuAmz) && (
                                <span className="font-mono text-[10px] bg-gray-100 px-1.5 rounded text-gray-500 shrink-0 border border-gray-200 tracking-tighter">
                                  {item.skuRaw ?? item.product?.skuAmz}
                                </span>
                              )}
                            </div>
                            <span className="text-sm font-bold text-gray-900 bg-gray-100 rounded px-2 py-0.5 ml-3 shrink-0">x{item.quantity}</span>
                          </div>
                        );
                      })}
                    </div>

                    {/* Warehouse action rows (compact) */}
                    <div className="mt-auto pt-2 flex flex-col gap-2">
                      {/* Kho Nhung row */}
                      {isNhung && (
                        <div className="flex items-center gap-2 justify-between rounded bg-orange-50/50 border border-orange-100 px-2.5 py-1.5">
                          <div className="flex items-center gap-1.5 shrink-0">
                            <Home className="h-3 w-3 text-orange-500" />
                            <span className="text-xs font-semibold text-orange-700">Nhung</span>
                          </div>
                          
                          <div className="flex items-center gap-2 justify-end flex-1 min-w-0">
                            {!order.nhungNotifiedAt ? (
                              <Button size="sm" onClick={() => warehouseAction(order.id, "nhung_notify")}
                                className="h-6 text-[10px] px-2 bg-orange-500 hover:bg-orange-600 text-white rounded">
                                <Bell className="h-3 w-3 mr-1" /> Báo chốt đơn
                              </Button>
                            ) : !order.nhungShippedAt ? (
                              <>
                                <span className="text-[10px] text-orange-600 truncate border-r border-orange-200 pr-2 mr-1 hidden sm:inline-block">
                                  Báo {formatDate(order.nhungNotifiedAt)}
                                </span>
                                <Button size="sm" onClick={() => { setTrackingTarget({ orderId: order.id, action: "nhung_shipped", label: "Nhung đã ship" }); setTrackingOpen(true); }}
                                  className="h-6 text-[10px] px-2 bg-orange-600 hover:bg-orange-700 text-white rounded">
                                  <Truck className="h-3 w-3 mr-1.5" /> Xác nhận Ship
                                </Button>
                              </>
                            ) : (
                              <div className="flex items-center gap-1.5 max-w-full">
                                <CheckCircle2 className="h-3 w-3 text-green-500 shrink-0" />
                                <span className="text-[10px] text-green-600 font-medium truncate hidden sm:inline-block">
                                  Tới {formatDate(order.nhungShippedAt)}
                                </span>
                                {order.nhungTrackingCode && <span className="font-mono text-[10px] text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100 truncate">{order.nhungTrackingCode}</span>}
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Kho Bros row */}
                      {isBros && (
                        <div className="flex items-center gap-2 justify-between rounded bg-purple-50/50 border border-purple-100 px-2.5 py-1.5">
                          <div className="flex items-center gap-1.5 shrink-0">
                            <Warehouse className="h-3 w-3 text-purple-500" />
                            <span className="text-xs font-semibold text-purple-700">Bros</span>
                          </div>
                          
                          <div className="flex items-center gap-2 justify-end flex-1 min-w-0">
                            {!order.brosNotifiedAt ? (
                              <Button size="sm" onClick={() => warehouseAction(order.id, "bros_notify")}
                                className="h-6 text-[10px] px-2 bg-purple-500 hover:bg-purple-600 text-white rounded">
                                <Bell className="h-3 w-3 mr-1" /> Báo chốt đơn
                              </Button>
                            ) : !order.brosShippedAt ? (
                              <>
                                <span className="text-[10px] text-purple-600 truncate border-r border-purple-200 pr-2 mr-1 hidden sm:inline-block">
                                  Báo {formatDate(order.brosNotifiedAt)}
                                </span>
                                <Button size="sm" onClick={() => { setTrackingTarget({ orderId: order.id, action: "bros_shipped", label: "Bros đã ship" }); setTrackingOpen(true); }}
                                  className="h-6 text-[10px] px-2 bg-purple-600 hover:bg-purple-700 text-white rounded">
                                  <Truck className="h-3 w-3 mr-1.5" /> Xác nhận Ship
                                </Button>
                              </>
                            ) : (
                              <div className="flex items-center gap-1.5 max-w-full">
                                <CheckCircle2 className="h-3 w-3 text-green-500 shrink-0" />
                                <span className="text-[10px] text-green-600 font-medium truncate hidden sm:inline-block">
                                  Tới {formatDate(order.brosShippedAt)}
                                </span>
                                {order.brosTrackingCode && <span className="font-mono text-[10px] text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100 truncate">{order.brosTrackingCode}</span>}
                              </div>
                            )}
                          </div>
                      </div>
                    )}
                  </div>
                  
                  {/* Done action button area */}
                  {order.status === "shipped" && (
                    <div className="mt-3 flex justify-end">
                      <Button size="sm" onClick={() => warehouseAction(order.id, "done")}
                        className="h-7 text-[10px] px-3 bg-green-500 hover:bg-green-600 text-white rounded">
                        <CheckCircle2 className="h-3 w-3 mr-1" /> Xác nhận Hoàn tất
                      </Button>
                    </div>
                  )}

                  {/* Footer meta */}
                  <div className="mt-3 flex items-center justify-between text-[10px] text-gray-400 border-t border-gray-100 pt-2">
                    <span>Tạo: {formatDate(order.createdAt)}</span>
                    {order.notes && <span className="italic truncate max-w-[150px]">{order.notes}</span>}
                  </div>
                  
                </div>
              </div>
            </Card>
          );
          })}
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Tạo lệnh đóng hàng mới</DialogTitle>
          </DialogHeader>
          <div className="text-xs text-blue-600 bg-blue-50 rounded-lg px-3 py-2 mb-3">
            ⚡ Hệ thống sẽ tự động phân công kho: ưu tiên <strong>Kho Nhung</strong> nếu đủ hàng, nếu không sẽ dùng <strong>Kho Bros</strong>.
          </div>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Nguồn đơn</Label>
                <select className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" value={form.source}
                  onChange={(e) => setForm({ ...form, source: e.target.value })}>
                  <option value="shopify">Shopify</option>
                  <option value="tiktok">TikTok</option>
                  <option value="manual">Thủ công</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Mã đơn (tuỳ chọn)</Label>
                <Input placeholder="#1234" value={form.shopifyOrderId}
                  onChange={(e) => setForm({ ...form, shopifyOrderId: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Tên khách hàng</Label>
                <Input placeholder="Tên người nhận" value={form.customerName}
                  onChange={(e) => setForm({ ...form, customerName: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Ghi chú khách</Label>
                <Input placeholder="Yêu cầu đặc biệt..." value={form.customerNote}
                  onChange={(e) => setForm({ ...form, customerNote: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Địa chỉ giao hàng</Label>
              <Input placeholder="123 Main St, Houston, TX..." value={form.customerAddress}
                onChange={(e) => setForm({ ...form, customerAddress: e.target.value })} />
            </div>

            {/* Items */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="font-semibold">Sản phẩm</Label>
                <Button type="button" variant="outline" size="sm" onClick={() => setItems((p) => [...p, emptyItem()])} className="gap-1 text-xs">
                  <Plus className="h-3.5 w-3.5" /> Thêm
                </Button>
              </div>
              {items.map((item, idx) => (
                <div key={idx} className="rounded-lg border p-3 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-500">Sản phẩm {idx + 1}</span>
                    {items.length > 1 && <button type="button" onClick={() => setItems((p) => p.filter((_, i) => i !== idx))} className="text-gray-400 hover:text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Sản phẩm</Label>
                      <select className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm" value={item.productId}
                        onChange={(e) => updateItem(idx, "productId", e.target.value)}>
                        <option value="">-- Chọn --</option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>{p.nameVi ?? p.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Số lượng *</Label>
                      <Input type="number" min={1} value={item.quantity} onChange={(e) => updateItem(idx, "quantity", e.target.value)} className="text-sm h-8" required />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Tên hiển thị *</Label>
                      <Input placeholder="Tên sản phẩm" value={item.productName} onChange={(e) => updateItem(idx, "productName", e.target.value)} className="text-sm h-8" required />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">SKU</Label>
                      <Input placeholder="SKU" value={item.skuRaw} onChange={(e) => updateItem(idx, "skuRaw", e.target.value)} className="text-sm h-8" />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Huỷ</Button>
              <Button type="submit" disabled={saving} className="bg-green-600 hover:bg-green-700 text-white">
                {saving ? "Đang tạo..." : "Tạo & phân công kho"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Tracking dialog */}
      <Dialog open={trackingOpen} onOpenChange={(o) => { setTrackingOpen(o); if (!o) { setTrackingTarget(null); setTrackingInput(""); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{trackingTarget?.label}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label>Mã tracking (tuỳ chọn)</Label>
              <Input placeholder="Tracking number..." value={trackingInput} onChange={(e) => setTrackingInput(e.target.value)} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setTrackingOpen(false); setTrackingTarget(null); setTrackingInput(""); }}>Huỷ</Button>
              <Button disabled={saving}
                onClick={() => { if (trackingTarget) { warehouseAction(trackingTarget.orderId, trackingTarget.action, trackingInput); setTrackingOpen(false); setTrackingTarget(null); setTrackingInput(""); } }}
                className="bg-green-600 hover:bg-green-700 text-white">
                {saving ? "Đang lưu..." : "Xác nhận"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
