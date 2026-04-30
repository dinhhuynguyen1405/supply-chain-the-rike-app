"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus, Eye, Trash2, X, Package, Truck, CheckCircle2 } from "lucide-react";
import { formatVND, formatDate, STATUS_LABELS, STATUS_COLORS } from "@/lib/utils";

interface Product { id: string; name: string; nameVi: string | null; unit: string; }
interface Supplier { id: string; name: string; }
interface OrderItem { productId: string; quantity: number; priceVnd: number; subtotalVnd: number; notes: string; }

interface PurchaseOrder {
  id: string;
  code: string;
  status: string;
  orderDate: string;
  expectedDate: string | null;
  arrivedDate: string | null;
  totalVnd: number;
  shippingCostVnd: number | null;
  packingLaborVnd: number | null;
  packingStatus: string | null;
  isBuyOnBehalf: boolean;
  shippingCode: string | null;
  shippingUnit: string | null;
  supplier: Supplier;
  items: { product: { name: string; nameVi: string | null }; quantity: number; priceVnd: number }[];
  payments: { amount: number; direction: string }[];
}

const PACKING_LABELS: Record<string, string> = {
  pending: "Chờ đóng hàng",
  done: "Đã đóng xong",
};
const PACKING_COLORS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  done: "bg-green-100 text-green-700",
};

export default function PurchasesPage() {
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [open, setOpen] = useState(false);

  // Packing confirmation dialog
  const [packingOrder, setPackingOrder] = useState<PurchaseOrder | null>(null);
  const [packingLabor, setPackingLabor] = useState("");
  const [packingLoading, setPackingLoading] = useState(false);

  const [form, setForm] = useState({
    supplierId: "",
    orderDate: new Date().toISOString().split("T")[0],
    expectedDate: "",
    shippingCode: "",
    shippingUnit: "",
    shippingCostVnd: "",   // Tiền ship mua về (từ chợ về nhà)
    notes: "",
    isBuyOnBehalf: false,
    sellingPriceVnd: "",
  });
  const [items, setItems] = useState<OrderItem[]>([
    { productId: "", quantity: 1, priceVnd: 0, subtotalVnd: 0, notes: "" },
  ]);

  const load = () =>
    fetch("/api/purchases")
      .then((r) => r.json())
      .then(setOrders);

  useEffect(() => {
    load();
    fetch("/api/suppliers").then((r) => r.json()).then(setSuppliers);
    fetch("/api/products?limit=500")
      .then((r) => r.json())
      .then((d) => setProducts(Array.isArray(d) ? d : (d.products ?? [])));
  }, []);

  function updateItem(idx: number, field: keyof OrderItem, val: string) {
    const next = [...items];
    const strFields = ["productId", "notes"];
    const item = { ...next[idx], [field]: strFields.includes(field) ? val : Number(val) };
    item.subtotalVnd = item.quantity * item.priceVnd;
    next[idx] = item;
    setItems(next);
  }

  async function submit() {
    if (!form.supplierId) return toast.error("Chọn nhà cung cấp");
    if (items.some((i) => !i.productId)) return toast.error("Chọn sản phẩm cho tất cả dòng");
    const res = await fetch("/api/purchases", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        shippingCostVnd: form.shippingCostVnd ? Number(form.shippingCostVnd) : null,
        sellingPriceVnd: form.sellingPriceVnd ? Number(form.sellingPriceVnd) : null,
        items,
      }),
    });
    if (res.ok) {
      toast.success("Đã tạo đơn mua");
      setOpen(false);
      load();
      setItems([{ productId: "", quantity: 1, priceVnd: 0, subtotalVnd: 0, notes: "" }]);
      setForm({ supplierId: "", orderDate: new Date().toISOString().split("T")[0], expectedDate: "", shippingCode: "", shippingUnit: "", shippingCostVnd: "", notes: "", isBuyOnBehalf: false, sellingPriceVnd: "" });
    } else {
      toast.error("Có lỗi xảy ra");
    }
  }

  async function deleteOrder(id: string) {
    if (!confirm("Xoá đơn mua này?")) return;
    const res = await fetch(`/api/purchases/${id}`, { method: "DELETE" });
    if (res.ok) { toast.success("Đã xoá"); load(); }
  }

  async function confirmPacking() {
    if (!packingOrder) return;
    setPackingLoading(true);
    const res = await fetch(`/api/purchases/${packingOrder.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        packingStatus: "done",
        packingLaborVnd: packingLabor ? Number(packingLabor) : null,
      }),
    });
    setPackingLoading(false);
    if (res.ok) {
      toast.success("Đã xác nhận đóng hàng xong ✓");
      setPackingOrder(null);
      setPackingLabor("");
      load();
    } else {
      toast.error("Có lỗi xảy ra");
    }
  }

  const total = items.reduce((s, i) => s + i.subtotalVnd, 0);
  const totalWithShipping = total + (Number(form.shippingCostVnd) || 0);

  // Phân loại đơn: cần đóng hàng (arrived, not buyOnBehalf, packingStatus=pending)
  const pendingPacking = orders.filter(
    (o) => o.packingStatus === "pending" && (o.status === "arrived" || o.status === "completed")
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Thu mua</h1>
          <p className="text-sm text-gray-500">Quản lý đơn mua hàng từ Việt Nam</p>
        </div>
        <Button onClick={() => setOpen(true)} className="bg-green-600 hover:bg-green-700">
          <Plus className="mr-2 h-4 w-4" /> Tạo đơn mua
        </Button>
      </div>

      {/* Alert: đơn đang chờ đóng hàng */}
      {pendingPacking.length > 0 && (
        <Card className="border-amber-200 bg-amber-50 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Package className="h-4 w-4 text-amber-600" />
            <span className="text-sm font-semibold text-amber-800">
              {pendingPacking.length} đơn đang chờ đóng hàng
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {pendingPacking.map((o) => (
              <button
                key={o.id}
                onClick={() => { setPackingOrder(o); setPackingLabor(""); }}
                className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-100 flex items-center gap-1.5"
              >
                <Package className="h-3 w-3" />
                {o.code} · {o.items.map(i => i.product.nameVi ?? i.product.name).join(", ")}
              </button>
            ))}
          </div>
        </Card>
      )}

      {/* Order list */}
      {orders.length === 0 ? (
        <Card className="flex h-48 items-center justify-center">
          <p className="text-gray-400">Chưa có đơn mua nào</p>
        </Card>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Mã đơn</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">NCC / Hàng</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Ngày mua</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Trạng thái</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">Tổng tiền</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {orders.map((o) => {
                const totalCost = o.totalVnd + (o.shippingCostVnd ?? 0) + (o.packingLaborVnd ?? 0);
                const paidSupplier = o.payments.filter(p => p.direction === "to_supplier").reduce((s, p) => s + p.amount, 0);
                return (
                  <tr key={o.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-0.5">
                        <span className="font-mono text-xs font-semibold text-gray-700">{o.code}</span>
                        {o.isBuyOnBehalf && (
                          <Badge className="w-fit bg-purple-100 text-purple-700 text-xs">Mua hộ</Badge>
                        )}
                        {o.packingStatus && !o.isBuyOnBehalf && (
                          <Badge className={`w-fit text-xs ${PACKING_COLORS[o.packingStatus]}`}>
                            {o.packingStatus === "done"
                              ? <><CheckCircle2 className="inline h-3 w-3 mr-0.5" />Đã đóng</>
                              : <><Package className="inline h-3 w-3 mr-0.5" />Chờ đóng</>
                            }
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{o.supplier.name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {o.items.slice(0, 3).map(i => i.product.nameVi ?? i.product.name).join(" · ")}
                        {o.items.length > 3 && ` +${o.items.length - 3}`}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{formatDate(o.orderDate)}</td>
                    <td className="px-4 py-3">
                      <Badge className={`${STATUS_COLORS[o.status] ?? "bg-gray-100 text-gray-600"} text-xs`}>
                        {STATUS_LABELS[o.status] ?? o.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <p className="font-medium text-gray-900">{formatVND(totalCost)}</p>
                      {(o.shippingCostVnd || o.packingLaborVnd) && (
                        <p className="text-xs text-gray-400 mt-0.5">
                          hàng {formatVND(o.totalVnd)}
                          {o.shippingCostVnd ? ` + ship ${formatVND(o.shippingCostVnd)}` : ""}
                          {o.packingLaborVnd ? ` + đóng ${formatVND(o.packingLaborVnd)}` : ""}
                        </p>
                      )}
                      {paidSupplier < o.totalVnd && (
                        <p className="text-xs text-red-400">Còn nợ {formatVND(o.totalVnd - paidSupplier)}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {/* Nút đóng hàng nhanh */}
                        {o.packingStatus === "pending" && !o.isBuyOnBehalf && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs h-7 border-amber-300 text-amber-700 hover:bg-amber-50"
                            onClick={() => { setPackingOrder(o); setPackingLabor(""); }}
                          >
                            <Package className="mr-1 h-3 w-3" />
                            Đóng hàng
                          </Button>
                        )}
                        {o.packingStatus === "done" && !o.isBuyOnBehalf && (
                          <Link
                            href={`/shipments?from=${o.id}`}
                            className="inline-flex items-center text-xs h-7 px-2 rounded-md border border-blue-300 text-blue-700 hover:bg-blue-50"
                          >
                            <Truck className="mr-1 h-3 w-3" />
                              Tạo lô ship
                            </Link>
                        )}
                        <Link href={`/purchases/${o.id}`}>
                          <Button size="icon" variant="ghost"><Eye className="h-3.5 w-3.5" /></Button>
                        </Link>
                        <Button
                          size="icon" variant="ghost"
                          className="text-red-500 hover:text-red-600"
                          onClick={() => deleteOrder(o.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Tạo đơn mua hàng</DialogTitle>
          </DialogHeader>
          <div className="space-y-5 pt-2">
            {/* Loại đơn */}
            <div className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2.5">
              <div>
                <p className="text-sm font-medium text-gray-700">Đơn mua hộ</p>
                <p className="text-xs text-gray-400">
                  {form.isBuyOnBehalf
                    ? "Mua giúp người khác → không cần đóng hàng"
                    : "Mua cho mình → tự động tạo lệnh đóng hàng sau"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setForm({ ...form, isBuyOnBehalf: !form.isBuyOnBehalf, sellingPriceVnd: "" })}
                className={`relative h-5 w-9 rounded-full transition-colors ${form.isBuyOnBehalf ? "bg-purple-500" : "bg-gray-200"}`}
              >
                <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${form.isBuyOnBehalf ? "translate-x-4" : "translate-x-0.5"}`} />
              </button>
            </div>

            {/* Basic info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-1.5">
                <Label>Nhà cung cấp *</Label>
                <select
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={form.supplierId}
                  onChange={(e) => setForm({ ...form, supplierId: e.target.value })}
                >
                  <option value="">Chọn nhà cung cấp...</option>
                  {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Ngày mua *</Label>
                <Input type="date" value={form.orderDate} onChange={(e) => setForm({ ...form, orderDate: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Dự kiến đến</Label>
                <Input type="date" value={form.expectedDate} onChange={(e) => setForm({ ...form, expectedDate: e.target.value })} />
              </div>

              {/* Vận chuyển + tiền ship */}
              <div className="space-y-1.5">
                <Label>Đơn vị vận chuyển</Label>
                <Input placeholder="Grab, xe ôm, tự đi..." value={form.shippingUnit} onChange={(e) => setForm({ ...form, shippingUnit: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1">
                  <Truck className="h-3.5 w-3.5 text-gray-400" />
                  Phí ship mua về (VND)
                </Label>
                <Input
                  type="number"
                  placeholder="VD: 50000"
                  value={form.shippingCostVnd}
                  onChange={(e) => setForm({ ...form, shippingCostVnd: e.target.value })}
                />
              </div>
            </div>

            {/* Items */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Danh sách hàng *</Label>
                <Button type="button" size="sm" variant="outline" onClick={() => setItems([...items, { productId: "", quantity: 1, priceVnd: 0, subtotalVnd: 0, notes: "" }])}>
                  <Plus className="mr-1 h-3 w-3" /> Thêm dòng
                </Button>
              </div>
              <div className="space-y-3">
                {items.map((item, idx) => (
                  <div key={idx} className="rounded-lg border border-gray-100 bg-gray-50 p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <select
                        className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={item.productId}
                        onChange={(e) => updateItem(idx, "productId", e.target.value)}
                      >
                        <option value="">Chọn sản phẩm...</option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.nameVi ? `${p.nameVi} (${p.name.substring(0, 40)})` : p.name} · {p.unit}
                          </option>
                        ))}
                      </select>
                      <Input type="number" className="w-20" placeholder="SL" value={item.quantity || ""} onChange={(e) => updateItem(idx, "quantity", e.target.value)} />
                      <Input type="number" className="w-32" placeholder="Giá/đv (VND)" value={item.priceVnd || ""} onChange={(e) => updateItem(idx, "priceVnd", e.target.value)} />
                      <span className="w-28 shrink-0 text-right text-xs font-semibold text-gray-700">{formatVND(item.subtotalVnd)}</span>
                      <Button type="button" size="icon" variant="ghost" className="shrink-0 text-red-400" onClick={() => setItems(items.filter((_, i) => i !== idx))}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    <Input placeholder="Ghi chú: Hàng Loại 1, đã deal giá..." className="text-xs bg-white" value={item.notes} onChange={(e) => updateItem(idx, "notes", e.target.value)} />
                  </div>
                ))}
              </div>
              <div className="flex justify-end gap-4 pt-1 text-sm text-gray-700">
                <span>Hàng: <strong>{formatVND(total)}</strong></span>
                {form.shippingCostVnd && <span>Ship: <strong>{formatVND(Number(form.shippingCostVnd))}</strong></span>}
                <span className="text-green-700">Tổng: <strong>{formatVND(totalWithShipping)}</strong></span>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Ghi chú</Label>
              <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>

            {form.isBuyOnBehalf && (
              <div className="space-y-1.5">
                <Label>Giá bán lại cho khách (VND)</Label>
                <Input type="number" placeholder="Để trống = bằng giá vốn" value={form.sellingPriceVnd} onChange={(e) => setForm({ ...form, sellingPriceVnd: e.target.value })} />
                {form.sellingPriceVnd && Number(form.sellingPriceVnd) > total && total > 0 && (
                  <p className="text-xs text-green-600">Lợi nhuận: {formatVND(Number(form.sellingPriceVnd) - total)}</p>
                )}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setOpen(false)}>Huỷ</Button>
              <Button onClick={submit} className="bg-green-600 hover:bg-green-700">Tạo đơn mua</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Packing confirmation dialog */}
      <Dialog open={!!packingOrder} onOpenChange={(o) => { if (!o) setPackingOrder(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-amber-600" />
              Xác nhận đóng hàng
            </DialogTitle>
          </DialogHeader>
          {packingOrder && (
            <div className="space-y-4 pt-2">
              <div className="rounded-lg bg-gray-50 p-3 text-sm">
                <p className="font-medium text-gray-900">{packingOrder.code}</p>
                <p className="text-gray-500 text-xs mt-1">
                  {packingOrder.items.map(i => `${i.quantity}${packingOrder.items[0] && 'kg'} ${i.product.nameVi ?? i.product.name}`).join(" · ")}
                </p>
              </div>

              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5">
                  Tiền nhân công đóng hàng (VND)
                  <span className="text-xs text-gray-400 font-normal">— để trống nếu tự làm</span>
                </Label>
                <Input
                  type="number"
                  placeholder="VD: 100000"
                  value={packingLabor}
                  onChange={(e) => setPackingLabor(e.target.value)}
                  autoFocus
                />
                {packingLabor && (
                  <p className="text-xs text-gray-500">
                    Tổng chi phí đơn này: {formatVND(
                      packingOrder.totalVnd +
                      (packingOrder.shippingCostVnd ?? 0) +
                      Number(packingLabor)
                    )}
                  </p>
                )}
              </div>

              <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-xs text-green-800">
                <p className="font-medium mb-1">Sau khi xác nhận:</p>
                <p>→ Đơn chuyển trạng thái "Đã đóng xong"</p>
                <p>→ Có thể thêm vào lô ship VN → US</p>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setPackingOrder(null)}>Huỷ</Button>
                <Button
                  onClick={confirmPacking}
                  disabled={packingLoading}
                  className="bg-amber-600 hover:bg-amber-700"
                >
                  <CheckCircle2 className="mr-1.5 h-4 w-4" />
                  Xác nhận đóng xong
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
