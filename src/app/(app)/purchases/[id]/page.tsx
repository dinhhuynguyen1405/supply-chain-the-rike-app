"use client";
import { useEffect, useState, use } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Save, Plus, Trash2, CheckCircle2, Clock, ArrowUpCircle, ArrowDownCircle, Factory, Pencil, X, FileText, Package } from "lucide-react";
import { formatVND, formatDate, STATUS_LABELS, STATUS_COLORS } from "@/lib/utils";
import { exportPurchaseOrderPDF, exportPackingSlipPDF } from "@/lib/pdf-export";

interface Payment {
  id: string;
  direction: string;
  amount: number;
  currency: string;
  paidAt: string;
  method: string | null;
  notes: string | null;
}

interface Order {
  id: string;
  code: string;
  status: string;
  orderDate: string;
  expectedDate: string | null;
  arrivedDate: string | null;
  totalVnd: number;
  isBuyOnBehalf: boolean;
  sellingPriceVnd: number | null;
  shippingCode: string | null;
  shippingUnit: string | null;
  notes: string | null;
  supplier: { name: string; phone: string | null; location: string | null };
  items: {
    id: string;
    quantity: number;
    unit: string | null;
    priceVnd: number;
    subtotalVnd: number;
    notes: string | null;
    groupId: string | null;
    group: { id: string; name: string; costUnit: string } | null;
    product: { id: string; name: string; nameVi: string | null; unit: string; skuShopify: string | null; gramsPerUnit: number | null } | null;
  }[];
  payments: Payment[];
  productionOrder: {
    id: string;
    code: string;
    status: string;
    items: {
      plannedQty: number;
      actualQty: number | null;
      gramsPerPack: number | null;
      product: { id: string; nameVi: string | null; name: string };
    }[];
  } | null;
}

const PROD_STATUS_LABELS: Record<string, string> = {
  pending: "Chờ đóng gói",
  in_production: "Đang đóng gói",
  done: "Đã đóng xong",
  cancelled: "Đã huỷ",
};
const PROD_STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  in_production: "bg-blue-100 text-blue-700",
  done: "bg-green-100 text-green-700",
  cancelled: "bg-gray-100 text-gray-500",
};

const STATUSES = ["draft", "confirmed", "shipping", "arrived", "completed", "cancelled"];
const METHODS = ["Chuyển khoản", "Tiền mặt", "Momo", "ZaloPay", "Khác"];

export default function PurchaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [order, setOrder] = useState<Order | null>(null);
  const [editing, setEditing] = useState({
    status: "", shippingCode: "", shippingUnit: "", notes: "", arrivedDate: "",
    isBuyOnBehalf: false, sellingPriceVnd: "",
  });
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentDirection, setPaymentDirection] = useState<"to_supplier" | "from_customer">("to_supplier");
  const [paymentForm, setPaymentForm] = useState({
    amount: "", paidAt: new Date().toISOString().split("T")[0], method: "Chuyển khoản", notes: "",
  });
  // Products list for selectors
  const [allProducts, setAllProducts] = useState<{ id: string; name: string; nameVi: string | null; unit: string; gramsPerUnit: number | null }[]>([]);
  // Groups list for group-mode selector
  const [allGroups, setAllGroups] = useState<{ id: string; name: string; costUnit: string }[]>([]);
  // Inline edit state cho từng dòng hàng
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingProductId, setEditingProductId] = useState<string>("");
  const [editingGroupId, setEditingGroupId] = useState<string>("");
  const [editingMode, setEditingMode] = useState<"sku" | "group">("sku");
  const [editingQty, setEditingQty] = useState<string>("");
  const [editingUnit, setEditingUnit] = useState<string>("");
  const [editingPrice, setEditingPrice] = useState<string>("");
  const [editingProductSearch, setEditingProductSearch] = useState<string>("");
  const [editingGroupSearch, setEditingGroupSearch] = useState<string>("");
  // Thêm dòng hàng mới
  const [addingItem, setAddingItem] = useState(false);
  const [newItem, setNewItem] = useState({
    productId: "", groupId: "", mode: "sku" as "sku" | "group",
    quantity: "1", priceVnd: "", notes: "", productSearch: "", groupSearch: "",
  });

  const load = () =>
    fetch(`/api/purchases/${id}`).then((r) => r.json()).then((o: Order) => {
      setOrder(o);
      setEditing({
        status: o.status,
        shippingCode: o.shippingCode ?? "",
        shippingUnit: o.shippingUnit ?? "",
        notes: o.notes ?? "",
        arrivedDate: o.arrivedDate ? o.arrivedDate.split("T")[0] : "",
        isBuyOnBehalf: o.isBuyOnBehalf,
        sellingPriceVnd: o.sellingPriceVnd ? String(o.sellingPriceVnd) : "",
      });
    });

  useEffect(() => {
    load();
    fetch("/api/products?limit=5000")
      .then((r) => r.json())
      .then((d) => setAllProducts(Array.isArray(d) ? d : (d.products ?? [])));
    fetch("/api/product-groups")
      .then((r) => r.json())
      .then((d) => setAllGroups(Array.isArray(d) ? d : (d.groups ?? [])));
  }, [id]);

  async function save() {
    const res = await fetch(`/api/purchases/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...editing,
        sellingPriceVnd: editing.sellingPriceVnd ? Number(editing.sellingPriceVnd) : null,
      }),
    });
    if (res.ok) { toast.success("Đã cập nhật"); load(); }
    else toast.error("Có lỗi xảy ra");
  }

  function openPayment(direction: "to_supplier" | "from_customer") {
    setPaymentDirection(direction);
    setPaymentForm({ amount: "", paidAt: new Date().toISOString().split("T")[0], method: "Chuyển khoản", notes: "" });
    setPaymentOpen(true);
  }

  async function addPayment() {
    if (!paymentForm.amount || Number(paymentForm.amount) <= 0)
      return toast.error("Nhập số tiền hợp lệ");
    const res = await fetch(`/api/purchases/${id}/payments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        direction: paymentDirection,
        amount: Number(paymentForm.amount),
        paidAt: paymentForm.paidAt,
        method: paymentForm.method,
        notes: paymentForm.notes,
        currency: "VND",
      }),
    });
    if (res.ok) { toast.success("Đã ghi nhận"); setPaymentOpen(false); load(); }
    else toast.error("Có lỗi xảy ra");
  }

  function openEditItem(item: Order["items"][0]) {
    setEditingItemId(item.id);
    setEditingProductId(item.product?.id ?? "");
    setEditingGroupId(item.groupId ?? "");
    setEditingMode(item.groupId ? "group" : "sku");
    setEditingQty(String(item.quantity));
    setEditingUnit(item.unit || item.product?.unit || item.group?.costUnit || "kg");
    setEditingPrice(String(item.priceVnd));
    setEditingProductSearch("");
    setEditingGroupSearch("");
  }

  async function saveItem(itemId: string) {
    const body: Record<string, unknown> = { itemId };
    if (editingMode === "group") {
      body.groupId = editingGroupId || null;
      body.productId = null;
    } else {
      body.productId = editingProductId || null;
      body.groupId = null;
    }
    if (editingQty) body.quantity = Number(editingQty);
    if (editingUnit) body.unit = editingUnit;
    if (editingPrice !== "") body.priceVnd = Number(editingPrice);
    const res = await fetch(`/api/purchases/${id}/items`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      toast.success("Đã cập nhật dòng hàng");
      setEditingItemId(null);
      load();
    } else {
      toast.error("Lỗi cập nhật");
    }
  }

  async function deleteItem(itemId: string) {
    if (!confirm("Xoá dòng hàng này khỏi đơn?")) return;
    const res = await fetch(`/api/purchases/${id}/items`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemId }),
    });
    if (res.ok) { toast.success("Đã xoá dòng hàng"); load(); }
    else toast.error("Lỗi xoá");
  }

  async function addNewItem() {
    if (newItem.mode === "sku" && !newItem.productId) return toast.error("Chọn sản phẩm");
    if (newItem.mode === "group" && !newItem.groupId) return toast.error("Chọn nhóm sản phẩm");
    if (!newItem.quantity || Number(newItem.quantity) <= 0) return toast.error("Nhập số lượng hợp lệ");
    const res = await fetch(`/api/purchases/${id}/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productId: newItem.mode === "sku" ? newItem.productId : null,
        groupId:   newItem.mode === "group" ? newItem.groupId : null,
        quantity: Number(newItem.quantity),
        priceVnd: Number(newItem.priceVnd) || 0,
        notes: newItem.notes || null,
      }),
    });
    if (res.ok) {
      toast.success("Đã thêm dòng hàng");
      setAddingItem(false);
      setNewItem({ productId: "", groupId: "", mode: "sku", quantity: "1", priceVnd: "", notes: "", productSearch: "", groupSearch: "" });
      load();
    } else {
      toast.error("Lỗi thêm dòng hàng");
    }
  }

  async function deletePayment(paymentId: string) {
    if (!confirm("Xoá khoản này?")) return;
    const res = await fetch(`/api/purchases/${id}/payments`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentId }),
    });
    if (res.ok) { toast.success("Đã xoá"); load(); }
  }

  async function createProductionOrderManually() {
    // Re-trigger arrived → the PATCH route's needsProduction check creates the order if missing
    const res = await fetch(`/api/purchases/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "arrived" }),
    });
    if (res.ok) {
      toast.success("Đã tạo lệnh sản xuất ✓");
      load();
    } else {
      toast.error("Lỗi tạo lệnh sản xuất");
    }
  }

  if (!order) return (
    <div className="flex h-64 items-center justify-center">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-green-600 border-t-transparent" />
    </div>
  );

  const toSupplierPaid = order.payments.filter((p) => p.direction === "to_supplier").reduce((s, p) => s + p.amount, 0);
  const fromCustomerReceived = order.payments.filter((p) => p.direction === "from_customer").reduce((s, p) => s + p.amount, 0);
  const supplierRemaining = order.totalVnd - toSupplierPaid;
  const sellingPrice = order.sellingPriceVnd ?? order.totalVnd;
  const customerRemaining = sellingPrice - fromCustomerReceived;
  const supplierPct = order.totalVnd > 0 ? Math.min(100, (toSupplierPaid / order.totalVnd) * 100) : 0;
  const customerPct = sellingPrice > 0 ? Math.min(100, (fromCustomerReceived / sellingPrice) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold text-gray-900">{order.code}</h1>
            <Badge className={STATUS_COLORS[order.status]}>{STATUS_LABELS[order.status]}</Badge>
            {order.isBuyOnBehalf && (
              <Badge className="bg-purple-100 text-purple-700 text-xs">Mua hộ</Badge>
            )}
            {supplierRemaining <= 0 && (
              <Badge className="bg-green-100 text-green-700 text-xs flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" /> Đã trả NCC đủ
              </Badge>
            )}
            {order.isBuyOnBehalf && customerRemaining <= 0 && fromCustomerReceived > 0 && (
              <Badge className="bg-blue-100 text-blue-700 text-xs flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" /> Khách đã trả đủ
              </Badge>
            )}
            {order.isBuyOnBehalf && customerRemaining > 0 && (
              <Badge className="bg-red-100 text-red-700 text-xs flex items-center gap-1">
                <Clock className="h-3 w-3" /> Khách còn nợ {formatVND(customerRemaining)}
              </Badge>
            )}
          </div>
          <p className="text-sm text-gray-500">
            {order.supplier.name}{" · "}{formatDate(order.orderDate)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5"
            onClick={() => exportPurchaseOrderPDF(order)}>
            <FileText className="h-3.5 w-3.5" /> Xuất PDF
          </Button>
          {order.productionOrder && (
            <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5"
              onClick={() => exportPackingSlipPDF(order)}>
              <Package className="h-3.5 w-3.5" /> Phiếu đóng gói
            </Button>
          )}
          <Button onClick={save} className="bg-green-600 hover:bg-green-700">
            <Save className="mr-2 h-4 w-4" /> Lưu
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left: Items + Payments */}
        <div className="lg:col-span-2 space-y-6">
          {/* Items */}
          <Card className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-700">Danh sách hàng</h2>
              <Button
                size="sm" variant="outline"
                className="h-7 text-xs border-green-300 text-green-700 hover:bg-green-50"
                onClick={() => { setAddingItem(true); setNewItem({ productId: "", groupId: "", mode: "sku", quantity: "1", priceVnd: "", notes: "", productSearch: "", groupSearch: "" }); }}
              >
                <Plus className="mr-1 h-3 w-3" /> Thêm dòng
              </Button>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="pb-2 text-left font-medium text-gray-500">Sản phẩm / Nhóm</th>
                  <th className="pb-2 text-right font-medium text-gray-500">Số lượng</th>
                  <th className="pb-2 text-right font-medium text-gray-500">Thành phẩm</th>
                  <th className="pb-2 text-right font-medium text-gray-500">Đơn giá</th>
                  <th className="pb-2 text-right font-medium text-gray-500">Thành tiền</th>
                  <th className="pb-2 w-16" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {order.items.map((item) => {
                  const isEditing = editingItemId === item.id;
                  const g = item.product?.gramsPerUnit;
                  const yieldPacks = g && item.product?.unit === "kg"
                    ? Math.floor((item.quantity * 1000) / g)
                    : null;

                  // Filtered lists: only show items when search string >= 2 chars, else show up to 50
                  const filteredProducts = editingProductSearch.trim().length >= 2
                    ? allProducts.filter((p) => {
                        const q = editingProductSearch.toLowerCase();
                        return p.name.toLowerCase().includes(q) || (p.nameVi ?? "").toLowerCase().includes(q);
                      })
                    : allProducts.slice(0, 50);

                  const filteredGroups = editingGroupSearch.trim().length >= 2
                    ? allGroups.filter((g) => g.name.toLowerCase().includes(editingGroupSearch.toLowerCase()))
                    : allGroups;

                  return (
                    <tr key={item.id} className={isEditing ? "bg-indigo-50/50" : ""}>
                      <td className="py-2.5">
                        {isEditing ? (
                          <div className="space-y-1">
                            {/* Mode toggle */}
                            <div className="flex gap-1 mb-1">
                              <button
                                className={`text-xs px-2 py-0.5 rounded border ${editingMode === "sku" ? "bg-indigo-100 border-indigo-300 text-indigo-700" : "border-gray-200 text-gray-500"}`}
                                onClick={() => setEditingMode("sku")}
                              >SKU cụ thể</button>
                              <button
                                className={`text-xs px-2 py-0.5 rounded border ${editingMode === "group" ? "bg-purple-100 border-purple-300 text-purple-700" : "border-gray-200 text-gray-500"}`}
                                onClick={() => setEditingMode("group")}
                              >Theo nhóm</button>
                            </div>
                            {editingMode === "sku" ? (
                              <>
                                <Input
                                  placeholder="Tìm sản phẩm (nhập 2+ ký tự)..."
                                  className="h-7 text-xs"
                                  value={editingProductSearch}
                                  onChange={(e) => setEditingProductSearch(e.target.value)}
                                />
                                <select
                                  className="w-full rounded-md border border-indigo-300 bg-white px-2 py-1 text-xs"
                                  value={editingProductId}
                                  onChange={(e) => setEditingProductId(e.target.value)}
                                >
                                  <option value="">
                                    {editingProductSearch.trim().length >= 2
                                      ? `— ${filteredProducts.length} kết quả —`
                                      : `— Nhập 2+ ký tự để tìm (hiện ${filteredProducts.length}/tổng) —`}
                                  </option>
                                  {filteredProducts.map((p) => (
                                    <option key={p.id} value={p.id}>
                                      {p.nameVi ? `${p.nameVi} — ${p.name.slice(0, 35)}` : p.name} · {p.unit}
                                      {p.gramsPerUnit ? ` (${p.gramsPerUnit}g/gói)` : ""}
                                    </option>
                                  ))}
                                </select>
                              </>
                            ) : (
                              <>
                                <Input
                                  placeholder="Tìm nhóm sản phẩm..."
                                  className="h-7 text-xs"
                                  value={editingGroupSearch}
                                  onChange={(e) => setEditingGroupSearch(e.target.value)}
                                />
                                <select
                                  className="w-full rounded-md border border-purple-300 bg-white px-2 py-1 text-xs"
                                  value={editingGroupId}
                                  onChange={(e) => setEditingGroupId(e.target.value)}
                                >
                                  <option value="">— {filteredGroups.length} nhóm —</option>
                                  {filteredGroups.map((g) => (
                                    <option key={g.id} value={g.id}>
                                      {g.name} · {g.costUnit}
                                    </option>
                                  ))}
                                </select>
                              </>
                            )}
                          </div>
                        ) : (
                          <div>
                            {item.group ? (
                              <>
                                <span className="font-medium text-gray-900">{item.group.name}</span>
                                <Badge className="ml-1.5 text-[10px] bg-purple-100 text-purple-700">Nhóm</Badge>
                                <p className="text-xs text-gray-400">Mua theo nhóm · {item.group.costUnit}</p>
                              </>
                            ) : item.product ? (
                              <>
                                <a href={`/products/${item.product.id}`} className="font-medium text-gray-900 hover:text-green-600 hover:underline">
                                  {item.product.nameVi || item.product.name}
                                </a>
                                {item.product.skuShopify && (
                                  <p className="text-xs text-gray-400 font-mono">SKU: {item.product.skuShopify}</p>
                                )}
                              </>
                            ) : (
                              <span className="text-gray-400 text-xs">Không rõ</span>
                            )}
                            {item.notes && (
                              <p className="mt-0.5 text-xs text-amber-700 bg-amber-50 rounded px-1.5 py-0.5 inline-block">
                                {item.notes}
                              </p>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 text-right">
                        {isEditing ? (
                          <Input
                            type="number"
                            className="w-20 h-7 text-xs text-right ml-auto"
                            value={editingQty}
                            onChange={(e) => setEditingQty(e.target.value)}
                          />
                        ) : (
                          <span className="text-gray-600">
                            {item.quantity} {item.product?.unit ?? item.group?.costUnit ?? "kg"}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 text-right">
                        {isEditing ? (
                          <span className="text-xs text-gray-400">—</span>
                        ) : yieldPacks != null ? (
                          <span className="font-semibold text-green-700">~{yieldPacks} gói</span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="py-2.5 text-right">
                        {isEditing ? (
                          <Input
                            type="number"
                            className="w-28 h-7 text-xs text-right ml-auto"
                            value={editingPrice}
                            onChange={(e) => setEditingPrice(e.target.value)}
                          />
                        ) : (
                          <span className="text-gray-600">{formatVND(item.priceVnd)}</span>
                        )}
                      </td>
                      <td className="py-2.5 text-right font-medium text-gray-900">
                        {isEditing
                          ? <span className="text-xs text-indigo-600 font-semibold">{formatVND(Number(editingQty || 0) * Number(editingPrice || 0))}</span>
                          : formatVND(item.subtotalVnd)
                        }
                      </td>
                      <td className="py-2.5">
                        {isEditing ? (
                          <div className="flex items-center justify-end gap-1">
                            <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 h-6 text-[11px] px-2"
                              onClick={() => saveItem(item.id)}
                            >Lưu</Button>
                            <Button size="sm" variant="ghost" className="h-6 text-[11px] px-2"
                              onClick={() => setEditingItemId(null)}
                            ><X className="h-3 w-3" /></Button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => openEditItem(item)}
                              className="p-1 text-gray-300 hover:text-indigo-500"
                              title="Sửa dòng hàng"
                            ><Pencil className="h-3 w-3" /></button>
                            <button
                              onClick={() => deleteItem(item.id)}
                              className="p-1 text-gray-300 hover:text-red-500"
                              title="Xoá dòng hàng"
                            ><Trash2 className="h-3 w-3" /></button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}

                {/* Thêm dòng hàng mới inline */}
                {addingItem && (() => {
                  const fp = newItem.productSearch.trim().length >= 2
                    ? allProducts.filter((p) => {
                        const q = newItem.productSearch.toLowerCase();
                        return p.name.toLowerCase().includes(q) || (p.nameVi ?? "").toLowerCase().includes(q);
                      })
                    : allProducts.slice(0, 50);

                  const fg = newItem.groupSearch.trim().length >= 2
                    ? allGroups.filter((g) => g.name.toLowerCase().includes(newItem.groupSearch.toLowerCase()))
                    : allGroups;

                  return (
                    <tr className="bg-green-50/60">
                      <td className="py-2 pr-2">
                        {/* Mode toggle for new item */}
                        <div className="flex gap-1 mb-1">
                          <button
                            className={`text-xs px-2 py-0.5 rounded border ${newItem.mode === "sku" ? "bg-green-100 border-green-300 text-green-700" : "border-gray-200 text-gray-500"}`}
                            onClick={() => setNewItem((n) => ({ ...n, mode: "sku" }))}
                          >SKU cụ thể</button>
                          <button
                            className={`text-xs px-2 py-0.5 rounded border ${newItem.mode === "group" ? "bg-purple-100 border-purple-300 text-purple-700" : "border-gray-200 text-gray-500"}`}
                            onClick={() => setNewItem((n) => ({ ...n, mode: "group" }))}
                          >Theo nhóm</button>
                        </div>
                        <div className="space-y-1">
                          {newItem.mode === "sku" ? (
                            <>
                              <Input
                                placeholder="Tìm sản phẩm (nhập 2+ ký tự)..."
                                className="h-7 text-xs"
                                value={newItem.productSearch}
                                onChange={(e) => setNewItem((n) => ({ ...n, productSearch: e.target.value }))}
                                autoFocus
                              />
                              <select
                                className="w-full rounded-md border border-green-300 bg-white px-2 py-1 text-xs"
                                value={newItem.productId}
                                onChange={(e) => setNewItem((n) => ({ ...n, productId: e.target.value }))}
                              >
                                <option value="">
                                  {newItem.productSearch.trim().length >= 2
                                    ? `— ${fp.length} kết quả —`
                                    : `— Nhập 2+ ký tự để tìm (hiện ${fp.length}/tổng) —`}
                                </option>
                                {fp.map((p) => (
                                  <option key={p.id} value={p.id}>
                                    {p.nameVi ? `${p.nameVi} — ${p.name.slice(0, 35)}` : p.name} · {p.unit}
                                  </option>
                                ))}
                              </select>
                            </>
                          ) : (
                            <>
                              <Input
                                placeholder="Tìm nhóm sản phẩm..."
                                className="h-7 text-xs"
                                value={newItem.groupSearch}
                                onChange={(e) => setNewItem((n) => ({ ...n, groupSearch: e.target.value }))}
                                autoFocus
                              />
                              <select
                                className="w-full rounded-md border border-purple-300 bg-white px-2 py-1 text-xs"
                                value={newItem.groupId}
                                onChange={(e) => setNewItem((n) => ({ ...n, groupId: e.target.value }))}
                              >
                                <option value="">— {fg.length} nhóm —</option>
                                {fg.map((g) => (
                                  <option key={g.id} value={g.id}>
                                    {g.name} · {g.costUnit}
                                  </option>
                                ))}
                              </select>
                            </>
                          )}
                          <Input
                            placeholder="Ghi chú..."
                            className="h-7 text-xs"
                            value={newItem.notes}
                            onChange={(e) => setNewItem((n) => ({ ...n, notes: e.target.value }))}
                          />
                        </div>
                      </td>
                      <td className="py-2 text-right align-top pt-3">
                        <Input type="number" className="w-20 h-7 text-xs text-right ml-auto" placeholder="SL"
                          value={newItem.quantity}
                          onChange={(e) => setNewItem((n) => ({ ...n, quantity: e.target.value }))}
                        />
                      </td>
                      <td />
                      <td className="py-2 text-right align-top pt-3">
                        <Input type="number" className="w-28 h-7 text-xs text-right ml-auto" placeholder="Giá (VND)"
                          value={newItem.priceVnd}
                          onChange={(e) => setNewItem((n) => ({ ...n, priceVnd: e.target.value }))}
                        />
                      </td>
                      <td className="py-2 text-right align-top pt-3 text-xs font-semibold text-green-700">
                        {newItem.quantity && newItem.priceVnd
                          ? formatVND(Number(newItem.quantity) * Number(newItem.priceVnd))
                          : "—"
                        }
                      </td>
                      <td className="py-2 align-top pt-3">
                        <div className="flex items-center justify-end gap-1">
                          <Button size="sm" className="bg-green-600 hover:bg-green-700 h-6 text-[11px] px-2"
                            onClick={addNewItem}
                          >Thêm</Button>
                          <Button size="sm" variant="ghost" className="h-6 text-[11px] px-2"
                            onClick={() => setAddingItem(false)}
                          ><X className="h-3 w-3" /></Button>
                        </div>
                      </td>
                    </tr>
                  );
                })()}
              </tbody>
              <tfoot>
                <tr className="border-t border-gray-200">
                  <td colSpan={5} className="pt-3 text-right font-semibold text-gray-700">Tổng giá vốn</td>
                  <td className="pt-3 text-right text-lg font-bold text-gray-900">{formatVND(order.totalVnd)}</td>
                </tr>
                {order.isBuyOnBehalf && order.sellingPriceVnd && order.sellingPriceVnd !== order.totalVnd && (
                  <tr>
                    <td colSpan={5} className="pt-1 text-right text-sm text-gray-500">Giá bán lại</td>
                    <td className="pt-1 text-right text-sm font-semibold text-blue-600">{formatVND(order.sellingPriceVnd)}</td>
                  </tr>
                )}
              </tfoot>
            </table>
          </Card>

          {/* Lệnh sản xuất / đóng gói */}
          {/* Case 1: No production order + arrived + raw_material → show create button */}
          {!order.productionOrder && order.status === "arrived" && !order.isBuyOnBehalf && (
            <Card className="p-5 border-dashed border-2 border-orange-200 bg-orange-50/40">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Factory className="h-4 w-4 text-orange-600" />
                  <div>
                    <p className="text-sm font-semibold text-orange-800">Chưa có lệnh sản xuất</p>
                    <p className="text-xs text-orange-600">Hàng đã về — cần tạo lệnh để phân bổ SKU và đóng gói</p>
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={createProductionOrderManually}
                  className="bg-orange-600 hover:bg-orange-700 text-white shrink-0"
                >
                  <Factory className="mr-1.5 h-3.5 w-3.5" />
                  Tạo lệnh sản xuất
                </Button>
              </div>
            </Card>
          )}

          {order.productionOrder && (
            <Card className={`p-5 border-2 ${
              order.productionOrder.status === "done" ? "border-green-200 bg-green-50/30" :
              order.productionOrder.status === "in_production" ? "border-blue-200 bg-blue-50/30" :
              "border-amber-200 bg-amber-50/30"
            }`}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Factory className="h-4 w-4 text-indigo-600" />
                  <h2 className="text-sm font-semibold text-gray-800">Lệnh sản xuất / đóng gói</h2>
                  <span className="font-mono text-xs text-gray-500">{order.productionOrder.code}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={`text-xs ${PROD_STATUS_COLORS[order.productionOrder.status] ?? "bg-gray-100 text-gray-500"}`}>
                    {PROD_STATUS_LABELS[order.productionOrder.status] ?? order.productionOrder.status}
                  </Badge>
                  <a
                    href={`/production/${order.productionOrder.id}`}
                    className="text-xs text-indigo-600 hover:underline"
                  >
                    Mở lệnh sản xuất →
                  </a>
                </div>
              </div>

              {/* Case 2: Production order exists but 0 items → guide to add SKUs */}
              {order.productionOrder.items.length === 0 ? (
                <div className="rounded-lg border border-orange-200 bg-orange-50 p-4 text-sm">
                  <p className="font-semibold text-orange-800 mb-1 flex items-center gap-1.5">
                    <Package className="h-4 w-4" /> Chưa khai báo SKU
                  </p>
                  <p className="text-xs text-orange-700 mb-3">
                    Lệnh sản xuất đã tạo nhưng chưa có sản phẩm nào. Vào trang sản xuất để phân bổ SKU từ nhóm nguyên liệu.
                  </p>
                  <a
                    href={`/production/${order.productionOrder.id}`}
                    className="inline-flex items-center gap-1.5 text-xs bg-orange-600 text-white rounded px-3 py-1.5 hover:bg-orange-700"
                  >
                    <Factory className="h-3.5 w-3.5" />
                    Vào trang sản xuất để thêm SKU
                  </a>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="text-xs text-gray-500 border-b border-gray-200">
                    <tr>
                      <th className="pb-2 text-left font-medium">Sản phẩm</th>
                      <th className="pb-2 text-right font-medium text-amber-600">Dự kiến</th>
                      <th className="pb-2 text-right font-medium text-green-600">Thực tế</th>
                      <th className="pb-2 text-right font-medium text-gray-400">Quy cách</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {order.productionOrder.items.map((pi, idx) => (
                      <tr key={idx}>
                        <td className="py-2.5 font-medium text-gray-900">
                          {pi.product.nameVi ?? pi.product.name}
                        </td>
                        <td className="py-2.5 text-right">
                          <span className="font-bold text-amber-700">{Math.round(pi.plannedQty)} gói</span>
                        </td>
                        <td className="py-2.5 text-right">
                          {pi.actualQty != null
                            ? <span className="font-bold text-green-700">{Math.round(pi.actualQty)} gói</span>
                            : <span className="text-gray-300">—</span>
                          }
                        </td>
                        <td className="py-2.5 text-right text-xs text-gray-400">
                          {pi.gramsPerPack ? `${pi.gramsPerPack}g/gói` : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t border-gray-200">
                    <tr>
                      <td className="pt-2 text-xs text-gray-500">Tổng</td>
                      <td className="pt-2 text-right font-bold text-amber-700">
                        {Math.round(order.productionOrder.items.reduce((s, i) => s + i.plannedQty, 0))} gói
                      </td>
                      <td className="pt-2 text-right font-bold text-green-700">
                        {order.productionOrder.items.some(i => i.actualQty != null)
                          ? `${Math.round(order.productionOrder.items.reduce((s, i) => s + (i.actualQty ?? 0), 0))} gói`
                          : "—"
                        }
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              )}
            </Card>
          )}

          {/* Two-sided payment tracking */}
          <Card className="p-5">
            <h2 className="mb-4 text-sm font-semibold text-gray-700">Thanh toán</h2>
            <Tabs defaultValue="supplier">
              <TabsList className="mb-4">
                <TabsTrigger value="supplier" className="flex items-center gap-1.5">
                  <ArrowUpCircle className="h-3.5 w-3.5 text-red-500" />
                  Tôi trả NCC
                </TabsTrigger>
                {order.isBuyOnBehalf && (
                  <TabsTrigger value="customer" className="flex items-center gap-1.5">
                    <ArrowDownCircle className="h-3.5 w-3.5 text-green-500" />
                    Khách trả lại
                  </TabsTrigger>
                )}
              </TabsList>

              {/* TO SUPPLIER */}
              <TabsContent value="supplier" className="space-y-4">
                <div className="space-y-1.5">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Tiến độ trả nhà cung cấp</span>
                    <span className="font-semibold">{supplierPct.toFixed(0)}%</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                    <div className={`h-full rounded-full ${supplierRemaining <= 0 ? "bg-green-500" : "bg-red-400"}`}
                      style={{ width: `${supplierPct}%` }} />
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">Đã trả: <span className="font-semibold text-red-600">{formatVND(toSupplierPaid)}</span></span>
                    <span className="text-gray-500">Còn lại: <span className={`font-semibold ${supplierRemaining > 0 ? "text-red-500" : "text-gray-400"}`}>{formatVND(Math.max(0, supplierRemaining))}</span></span>
                  </div>
                </div>
                <Button size="sm" onClick={() => openPayment("to_supplier")} className="bg-red-500 hover:bg-red-600 text-white">
                  <Plus className="mr-1 h-3.5 w-3.5" /> Ghi nhận trả NCC
                </Button>
                {order.payments.filter((p) => p.direction === "to_supplier").length === 0 ? (
                  <p className="text-sm text-gray-400">Chưa có khoản nào</p>
                ) : (
                  <div className="space-y-2">
                    {order.payments.filter((p) => p.direction === "to_supplier").map((p) => (
                      <div key={p.id} className="flex items-center justify-between rounded-lg border border-red-100 bg-red-50 px-4 py-2.5">
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{formatVND(p.amount)}</p>
                          <p className="text-xs text-gray-500">{formatDate(p.paidAt)}{p.method && ` · ${p.method}`}{p.notes && ` · ${p.notes}`}</p>
                        </div>
                        <Button size="icon" variant="ghost" className="text-red-400" onClick={() => deletePayment(p.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* FROM CUSTOMER (buy on behalf) */}
              {order.isBuyOnBehalf && (
                <TabsContent value="customer" className="space-y-4">
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Khách đã trả lại</span>
                      <span className="font-semibold">{customerPct.toFixed(0)}%</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                      <div className={`h-full rounded-full ${customerRemaining <= 0 ? "bg-green-500" : "bg-blue-400"}`}
                        style={{ width: `${customerPct}%` }} />
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">Đã nhận: <span className="font-semibold text-green-600">{formatVND(fromCustomerReceived)}</span></span>
                      <span className="text-gray-500">Còn nợ: <span className={`font-semibold ${customerRemaining > 0 ? "text-blue-600" : "text-gray-400"}`}>{formatVND(Math.max(0, customerRemaining))}</span></span>
                    </div>
                  </div>
                  <Button size="sm" onClick={() => openPayment("from_customer")} className="bg-blue-500 hover:bg-blue-600 text-white">
                    <Plus className="mr-1 h-3.5 w-3.5" /> Ghi nhận khách trả
                  </Button>
                  {order.payments.filter((p) => p.direction === "from_customer").length === 0 ? (
                    <p className="text-sm text-red-400">Chưa nhận tiền từ khách</p>
                  ) : (
                    <div className="space-y-2">
                      {order.payments.filter((p) => p.direction === "from_customer").map((p) => (
                        <div key={p.id} className="flex items-center justify-between rounded-lg border border-blue-100 bg-blue-50 px-4 py-2.5">
                          <div>
                            <p className="text-sm font-semibold text-gray-900">{formatVND(p.amount)}</p>
                            <p className="text-xs text-gray-500">{formatDate(p.paidAt)}{p.method && ` · ${p.method}`}{p.notes && ` · ${p.notes}`}</p>
                          </div>
                          <Button size="icon" variant="ghost" className="text-blue-400" onClick={() => deletePayment(p.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>
              )}
            </Tabs>
          </Card>
        </div>

        {/* Right: Edit panel */}
        <div className="space-y-5">
          <Card className="p-5 space-y-4">
            <h2 className="text-sm font-semibold text-gray-700">Cập nhật đơn</h2>

            <div className="space-y-1.5">
              <Label>Trạng thái</Label>
              <Select value={editing.status} onValueChange={(v) => v && setEditing({ ...editing, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Buy on behalf toggle */}
            <div className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2.5">
              <div>
                <p className="text-sm font-medium text-gray-700">Đơn mua hộ</p>
                <p className="text-xs text-gray-400">Bật nếu có người nhờ mua → hiện tab "Khách trả lại"</p>
              </div>
              <button
                type="button"
                onClick={() => setEditing({ ...editing, isBuyOnBehalf: !editing.isBuyOnBehalf })}
                className={`relative h-5 w-9 rounded-full transition-colors ${editing.isBuyOnBehalf ? "bg-purple-500" : "bg-gray-200"}`}
              >
                <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${editing.isBuyOnBehalf ? "translate-x-4" : "translate-x-0.5"}`} />
              </button>
            </div>

            {editing.isBuyOnBehalf && (
              <div className="space-y-1.5">
                <Label>Giá bán lại (VND)</Label>
                <Input type="number" placeholder={`Giá vốn: ${formatVND(order.totalVnd)}`}
                  value={editing.sellingPriceVnd}
                  onChange={(e) => setEditing({ ...editing, sellingPriceVnd: e.target.value })} />
                {order.sellingPriceVnd && order.sellingPriceVnd > order.totalVnd && (
                  <p className="text-xs text-green-600">
                    Lợi nhuận: {formatVND(order.sellingPriceVnd - order.totalVnd)}
                  </p>
                )}
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Đơn vị vận chuyển</Label>
              <Input placeholder="FedEx, DHL, USPS..." value={editing.shippingUnit}
                onChange={(e) => setEditing({ ...editing, shippingUnit: e.target.value })} />
            </div>

            <div className="space-y-1.5">
              <Label>Mã vận đơn</Label>
              <Input value={editing.shippingCode}
                onChange={(e) => setEditing({ ...editing, shippingCode: e.target.value })} />
            </div>

            <div className="space-y-1.5">
              <Label>Ngày hàng đến</Label>
              <Input type="date" value={editing.arrivedDate}
                onChange={(e) => setEditing({ ...editing, arrivedDate: e.target.value })} />
            </div>

            <div className="space-y-1.5">
              <Label>Ghi chú</Label>
              <Input value={editing.notes}
                onChange={(e) => setEditing({ ...editing, notes: e.target.value })} />
            </div>
          </Card>

          <Card className="p-5 space-y-2">
            <h2 className="text-sm font-semibold text-gray-700">Nhà cung cấp</h2>
            <p className="font-medium text-gray-900">{order.supplier.name}</p>
            {order.supplier.phone && <p className="text-xs text-gray-400">{order.supplier.phone}</p>}
            {order.expectedDate && (
              <div className="pt-1">
                <p className="text-xs text-gray-400">Dự kiến đến</p>
                <p className="text-sm font-medium text-gray-700">{formatDate(order.expectedDate)}</p>
              </div>
            )}
            {order.arrivedDate && (
              <div className="pt-1">
                <p className="text-xs text-gray-400">Thực tế đến</p>
                <p className="text-sm font-medium text-green-600">{formatDate(order.arrivedDate)}</p>
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Payment Dialog */}
      <Dialog open={paymentOpen} onOpenChange={setPaymentOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {paymentDirection === "to_supplier"
                ? "Ghi nhận trả nhà cung cấp"
                : "Ghi nhận khách trả lại"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>Số tiền (VND) *</Label>
              <Input type="number" placeholder="VD: 1000000"
                value={paymentForm.amount}
                onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })} />
              <div className="flex gap-2 pt-1 flex-wrap">
                {paymentDirection === "to_supplier" && supplierRemaining > 0 && (
                  <>
                    <button onClick={() => setPaymentForm({ ...paymentForm, amount: String(Math.round(supplierRemaining / 2)) })}
                      className="text-xs text-red-500 underline">50% ({formatVND(Math.round(supplierRemaining / 2))})</button>
                    <button onClick={() => setPaymentForm({ ...paymentForm, amount: String(supplierRemaining) })}
                      className="text-xs text-red-500 underline">Thanh lý ({formatVND(supplierRemaining)})</button>
                  </>
                )}
                {paymentDirection === "from_customer" && customerRemaining > 0 && (
                  <>
                    <button onClick={() => setPaymentForm({ ...paymentForm, amount: String(Math.round(customerRemaining / 2)) })}
                      className="text-xs text-blue-500 underline">50% ({formatVND(Math.round(customerRemaining / 2))})</button>
                    <button onClick={() => setPaymentForm({ ...paymentForm, amount: String(customerRemaining) })}
                      className="text-xs text-blue-500 underline">Thanh lý ({formatVND(customerRemaining)})</button>
                  </>
                )}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Ngày</Label>
              <Input type="date" value={paymentForm.paidAt}
                onChange={(e) => setPaymentForm({ ...paymentForm, paidAt: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Phương thức</Label>
              <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={paymentForm.method}
                onChange={(e) => setPaymentForm({ ...paymentForm, method: e.target.value })}>
                {METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Ghi chú</Label>
              <Input placeholder="Cọc, Thanh lý, Đợt 2..."
                value={paymentForm.notes}
                onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setPaymentOpen(false)}>Huỷ</Button>
              <Button onClick={addPayment}
                className={paymentDirection === "to_supplier" ? "bg-red-500 hover:bg-red-600" : "bg-blue-500 hover:bg-blue-600"}>
                Ghi nhận
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
