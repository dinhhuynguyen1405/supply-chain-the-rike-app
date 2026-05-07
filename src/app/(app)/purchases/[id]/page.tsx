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
import { ArrowLeft, Save, Plus, Trash2, CheckCircle2, Clock, ArrowUpCircle, ArrowDownCircle, Factory } from "lucide-react";
import { formatVND, formatDate, STATUS_LABELS, STATUS_COLORS } from "@/lib/utils";

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
    priceVnd: number;
    subtotalVnd: number;
    notes: string | null;
    product: { id: string; name: string; nameVi: string | null; unit: string; skuShopify: string | null; gramsPerUnit: number | null };
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
  // Đổi sản phẩm liên kết của purchase item
  const [allProducts, setAllProducts] = useState<{ id: string; name: string; nameVi: string | null; unit: string; gramsPerUnit: number | null }[]>([]);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingProductId, setEditingProductId] = useState<string>("");

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

  async function changeItemProduct(itemId: string, newProductId: string) {
    if (!newProductId) return;
    const res = await fetch(`/api/purchases/${id}/items`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemId, productId: newProductId }),
    });
    if (res.ok) {
      toast.success("Đã cập nhật sản phẩm ✓");
      setEditingItemId(null);
      load();
    } else {
      toast.error("Lỗi cập nhật");
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
        <Button onClick={save} className="bg-green-600 hover:bg-green-700">
          <Save className="mr-2 h-4 w-4" /> Lưu
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left: Items + Payments */}
        <div className="lg:col-span-2 space-y-6">
          {/* Items */}
          <Card className="p-5">
            <h2 className="mb-4 text-sm font-semibold text-gray-700">Danh sách hàng</h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="pb-2 text-left font-medium text-gray-500">Sản phẩm</th>
                  <th className="pb-2 text-right font-medium text-gray-500">Số lượng mua</th>
                  <th className="pb-2 text-right font-medium text-gray-500">Thành phẩm</th>
                  <th className="pb-2 text-right font-medium text-gray-500">Đơn giá</th>
                  <th className="pb-2 text-right font-medium text-gray-500">Thành tiền</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {order.items.map((item) => {
                  const g = item.product.gramsPerUnit;
                  const yieldPacks = g && item.product.unit === "kg"
                    ? Math.floor((item.quantity * 1000) / g)
                    : null;
                  return (
                    <tr key={item.id}>
                      <td className="py-2.5">
                        {editingItemId === item.id ? (
                          <div className="flex items-center gap-2">
                            <select
                              className="flex-1 rounded-md border border-indigo-300 bg-white px-2 py-1 text-sm ring-1 ring-indigo-200"
                              value={editingProductId}
                              onChange={(e) => setEditingProductId(e.target.value)}
                              autoFocus
                            >
                              <option value="">Chọn sản phẩm đúng...</option>
                              {allProducts.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.nameVi ? `${p.nameVi} — ${p.name.slice(0, 40)}` : p.name} · {p.unit}
                                  {p.gramsPerUnit ? ` (${p.gramsPerUnit}g/gói)` : ""}
                                </option>
                              ))}
                            </select>
                            <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 shrink-0 h-7 text-xs"
                              onClick={() => changeItemProduct(item.id, editingProductId)}
                              disabled={!editingProductId}
                            >Lưu</Button>
                            <Button size="sm" variant="ghost" className="h-7 text-xs"
                              onClick={() => setEditingItemId(null)}
                            >Huỷ</Button>
                          </div>
                        ) : (
                          <div className="flex items-start gap-1">
                            <div>
                              <a href={`/products/${item.product.id}`} className="font-medium text-gray-900 hover:text-green-600 hover:underline">
                                {item.product.nameVi || item.product.name}
                              </a>
                              {item.product.skuShopify && (
                                <p className="text-xs text-gray-400 font-mono">SKU: {item.product.skuShopify}</p>
                              )}
                              {item.notes && (
                                <p className="mt-0.5 text-xs text-amber-700 bg-amber-50 rounded px-1.5 py-0.5 inline-block">
                                  📝 {item.notes}
                                </p>
                              )}
                            </div>
                            <button
                              onClick={() => { setEditingItemId(item.id); setEditingProductId(item.product.id); }}
                              className="ml-1 mt-0.5 shrink-0 text-[10px] text-gray-300 hover:text-indigo-500 hover:underline"
                              title="Đổi sản phẩm liên kết"
                            >✎</button>
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 text-right text-gray-600">{item.quantity} {item.product.unit}</td>
                      <td className="py-2.5 text-right">
                        {yieldPacks != null ? (
                          <span className="font-semibold text-green-700">~{yieldPacks} gói</span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="py-2.5 text-right text-gray-600">{formatVND(item.priceVnd)}</td>
                      <td className="py-2.5 text-right font-medium text-gray-900">{formatVND(item.subtotalVnd)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t border-gray-200">
                  <td colSpan={4} className="pt-3 text-right font-semibold text-gray-700">Tổng giá vốn</td>
                  <td className="pt-3 text-right text-lg font-bold text-gray-900">{formatVND(order.totalVnd)}</td>
                </tr>
                {order.isBuyOnBehalf && order.sellingPriceVnd && order.sellingPriceVnd !== order.totalVnd && (
                  <tr>
                    <td colSpan={4} className="pt-1 text-right text-sm text-gray-500">Giá bán lại</td>
                    <td className="pt-1 text-right text-sm font-semibold text-blue-600">{formatVND(order.sellingPriceVnd)}</td>
                  </tr>
                )}
              </tfoot>
            </table>
          </Card>

          {/* Lệnh sản xuất / đóng gói */}
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
                    href="/production"
                    className="text-xs text-indigo-600 hover:underline"
                  >
                    Mở trang sản xuất →
                  </a>
                </div>
              </div>
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
                    <p className="text-sm text-red-400">⚠ Chưa nhận tiền từ khách</p>
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
                ? "🔴 Ghi nhận trả nhà cung cấp"
                : "🔵 Ghi nhận khách trả lại"}
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
