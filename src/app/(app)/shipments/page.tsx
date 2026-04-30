"use client";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { formatVND, formatDate } from "@/lib/utils";
import { Plus, Pencil, Trash2, CheckCircle2, Circle } from "lucide-react";

interface Product {
  id: string;
  name: string;
  nameVi: string | null;
  unit: string;
}

interface PurchaseItem {
  id: string;
  quantity: number;
  product: Product;
}

interface Supplier {
  id: string;
  name: string;
}

interface PurchaseOrder {
  id: string;
  code: string;
  totalVnd: number;
  supplier: Supplier;
  items: PurchaseItem[];
}

interface ShipmentBatchOrder {
  purchaseOrderId: string;
  purchaseOrder: PurchaseOrder;
}

interface ShipmentBatch {
  id: string;
  code: string;
  description: string | null;
  carrier: string | null;
  trackingCode: string | null;
  packedDate: string | null;
  departedVnDate: string | null;
  arrivedUsDate: string | null;
  receivedByTdDate: string | null;
  status: string;
  tdSheetUpdated: boolean;
  totalWeightKg: number | null;
  shippingCostVnd: number | null;
  notes: string | null;
  createdAt: string;
  orders: ShipmentBatchOrder[];
}

const STATUS_LABELS: Record<string, string> = {
  packing: "Đang đóng hàng",
  in_transit: "Đang vận chuyển",
  arrived_us: "Đã đến Mỹ",
  received_by_td: "TD đã nhận",
  done: "Hoàn tất",
};

const STATUS_COLORS: Record<string, string> = {
  packing: "bg-gray-100 text-gray-700",
  in_transit: "bg-blue-100 text-blue-700",
  arrived_us: "bg-purple-100 text-purple-700",
  received_by_td: "bg-green-100 text-green-700",
  done: "bg-green-200 text-green-800",
};

const STATUS_ORDER = ["packing", "in_transit", "arrived_us", "received_by_td", "done"];
const TIMELINE_LABELS = ["Đóng gói", "Xuất phát VN", "Đến Mỹ", "TD nhận", "Hoàn tất"];

const today = new Date().toISOString().split("T")[0];

function emptyForm() {
  return {
    description: "",
    carrier: "",
    trackingCode: "",
    packedDate: "",
    departedVnDate: "",
    totalWeightKg: "",
    shippingCostVnd: "",
    notes: "",
    purchaseOrderIds: [] as string[],
  };
}

function emptyEditForm(batch: ShipmentBatch) {
  return {
    status: batch.status,
    carrier: batch.carrier ?? "",
    trackingCode: batch.trackingCode ?? "",
    packedDate: batch.packedDate ? batch.packedDate.split("T")[0] : "",
    departedVnDate: batch.departedVnDate ? batch.departedVnDate.split("T")[0] : "",
    arrivedUsDate: batch.arrivedUsDate ? batch.arrivedUsDate.split("T")[0] : "",
    receivedByTdDate: batch.receivedByTdDate ? batch.receivedByTdDate.split("T")[0] : "",
    totalWeightKg: batch.totalWeightKg?.toString() ?? "",
    shippingCostVnd: batch.shippingCostVnd?.toString() ?? "",
    notes: batch.notes ?? "",
    tdSheetUpdated: batch.tdSheetUpdated,
  };
}

export default function ShipmentsPage() {
  const [batches, setBatches] = useState<ShipmentBatch[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ShipmentBatch | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [editForm, setEditForm] = useState<ReturnType<typeof emptyEditForm> | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [batchRes, poRes] = await Promise.all([
        fetch("/api/shipments"),
        fetch("/api/purchases"),
      ]);
      setBatches(await batchRes.json());
      setPurchaseOrders(await poRes.json());
    } catch {
      toast.error("Có lỗi xảy ra khi tải dữ liệu");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function togglePO(id: string) {
    setForm((prev) => ({
      ...prev,
      purchaseOrderIds: prev.purchaseOrderIds.includes(id)
        ? prev.purchaseOrderIds.filter((x) => x !== id)
        : [...prev.purchaseOrderIds, id],
    }));
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/shipments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: form.description || null,
          carrier: form.carrier || null,
          trackingCode: form.trackingCode || null,
          packedDate: form.packedDate || null,
          departedVnDate: form.departedVnDate || null,
          totalWeightKg: form.totalWeightKg ? Number(form.totalWeightKg) : null,
          shippingCostVnd: form.shippingCostVnd ? Number(form.shippingCostVnd) : null,
          notes: form.notes || null,
          purchaseOrderIds: form.purchaseOrderIds,
        }),
      });
      if (!res.ok) { toast.error("Có lỗi xảy ra"); return; }
      toast.success("Đã tạo lô vận chuyển");
      setCreateOpen(false);
      setForm(emptyForm());
      load();
    } finally {
      setSaving(false);
    }
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editTarget || !editForm) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/shipments/${editTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: editForm.status,
          carrier: editForm.carrier || null,
          trackingCode: editForm.trackingCode || null,
          packedDate: editForm.packedDate || null,
          departedVnDate: editForm.departedVnDate || null,
          arrivedUsDate: editForm.arrivedUsDate || null,
          receivedByTdDate: editForm.receivedByTdDate || null,
          totalWeightKg: editForm.totalWeightKg ? Number(editForm.totalWeightKg) : null,
          shippingCostVnd: editForm.shippingCostVnd ? Number(editForm.shippingCostVnd) : null,
          notes: editForm.notes || null,
          tdSheetUpdated: editForm.tdSheetUpdated,
        }),
      });
      if (!res.ok) { toast.error("Có lỗi xảy ra"); return; }
      toast.success("Đã cập nhật lô vận chuyển");
      setEditOpen(false);
      setEditTarget(null);
      load();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Xoá lô vận chuyển này?")) return;
    const res = await fetch(`/api/shipments/${id}`, { method: "DELETE" });
    if (!res.ok) { toast.error("Có lỗi xảy ra"); return; }
    toast.success("Đã xoá");
    load();
  }

  async function toggleTdSheet(batch: ShipmentBatch) {
    const res = await fetch(`/api/shipments/${batch.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tdSheetUpdated: !batch.tdSheetUpdated }),
    });
    if (!res.ok) { toast.error("Có lỗi xảy ra"); return; }
    load();
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-green-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Lô vận chuyển</h1>
          <p className="text-sm text-gray-500">Theo dõi hàng VN → US (Bros Warehouse)</p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="bg-green-600 hover:bg-green-700 text-white gap-2">
          <Plus className="h-4 w-4" />
          Tạo lô mới
        </Button>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Tạo lô vận chuyển mới</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4 mt-2">
              <div className="space-y-1.5">
                <Label>Mô tả lô hàng</Label>
                <Input placeholder="VD: Lô tháng 4/2026" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Hãng vận chuyển</Label>
                  <Input placeholder="DHL, FedEx, USPS, J&T..." value={form.carrier} onChange={(e) => setForm({ ...form, carrier: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Mã tracking</Label>
                  <Input placeholder="Tracking number" value={form.trackingCode} onChange={(e) => setForm({ ...form, trackingCode: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Ngày đóng hàng</Label>
                  <Input type="date" value={form.packedDate} onChange={(e) => setForm({ ...form, packedDate: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Ngày xuất phát VN</Label>
                  <Input type="date" value={form.departedVnDate} onChange={(e) => setForm({ ...form, departedVnDate: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Tổng cân nặng (kg)</Label>
                  <Input type="number" step="0.1" placeholder="0.0" value={form.totalWeightKg} onChange={(e) => setForm({ ...form, totalWeightKg: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Phí vận chuyển (VND)</Label>
                  <Input type="number" placeholder="0" value={form.shippingCostVnd} onChange={(e) => setForm({ ...form, shippingCostVnd: e.target.value })} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Ghi chú</Label>
                <Input placeholder="Ghi chú..." value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </div>

              {/* Purchase order selection */}
              <div className="space-y-2">
                <Label>Đơn mua hàng trong lô</Label>
                <div className="max-h-48 overflow-y-auto rounded-md border border-gray-200 p-2 space-y-1">
                  {purchaseOrders.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-2">Không có đơn mua</p>
                  ) : (
                    purchaseOrders.map((po) => (
                      <label key={po.id} className="flex items-center gap-2.5 rounded-md p-1.5 hover:bg-gray-50 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={form.purchaseOrderIds.includes(po.id)}
                          onChange={() => togglePO(po.id)}
                          className="h-4 w-4 rounded border-gray-300"
                        />
                        <span className="text-sm text-gray-700">
                          <span className="font-mono font-medium">{po.code}</span>
                          {" · "}{po.supplier.name}
                          {" · "}<span className="text-gray-500">{formatVND(po.totalVnd)}</span>
                        </span>
                      </label>
                    ))
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Huỷ</Button>
                <Button type="submit" disabled={saving} className="bg-green-600 hover:bg-green-700 text-white">
                  {saving ? "Đang tạo..." : "Tạo lô"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={(o) => { setEditOpen(o); if (!o) setEditTarget(null); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Cập nhật lô {editTarget?.code}</DialogTitle>
          </DialogHeader>
          {editForm && (
            <form onSubmit={handleEdit} className="space-y-4 mt-2">
              <div className="space-y-1.5">
                <Label>Trạng thái</Label>
                <select
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  value={editForm.status}
                  onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                >
                  {STATUS_ORDER.map((s) => (
                    <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Hãng vận chuyển</Label>
                  <Input value={editForm.carrier} onChange={(e) => setEditForm({ ...editForm, carrier: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Mã tracking</Label>
                  <Input value={editForm.trackingCode} onChange={(e) => setEditForm({ ...editForm, trackingCode: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Ngày đóng hàng</Label>
                  <Input type="date" value={editForm.packedDate} onChange={(e) => setEditForm({ ...editForm, packedDate: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Ngày xuất phát VN</Label>
                  <Input type="date" value={editForm.departedVnDate} onChange={(e) => setEditForm({ ...editForm, departedVnDate: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Ngày đến Mỹ</Label>
                  <Input type="date" value={editForm.arrivedUsDate} onChange={(e) => setEditForm({ ...editForm, arrivedUsDate: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Ngày TD nhận</Label>
                  <Input type="date" value={editForm.receivedByTdDate} onChange={(e) => setEditForm({ ...editForm, receivedByTdDate: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Tổng cân nặng (kg)</Label>
                  <Input type="number" step="0.1" value={editForm.totalWeightKg} onChange={(e) => setEditForm({ ...editForm, totalWeightKg: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Phí vận chuyển (VND)</Label>
                  <Input type="number" value={editForm.shippingCostVnd} onChange={(e) => setEditForm({ ...editForm, shippingCostVnd: e.target.value })} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Ghi chú</Label>
                <Input value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editForm.tdSheetUpdated}
                  onChange={(e) => setEditForm({ ...editForm, tdSheetUpdated: e.target.checked })}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <span className="text-sm text-gray-700">Kho TD đã cập nhật sheet</span>
              </label>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => { setEditOpen(false); setEditTarget(null); }}>Huỷ</Button>
                <Button type="submit" disabled={saving} className="bg-green-600 hover:bg-green-700 text-white">
                  {saving ? "Đang lưu..." : "Lưu"}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Shipment batch cards */}
      {batches.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-gray-400">Chưa có lô vận chuyển nào</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {batches.map((batch) => {
            const statusIdx = STATUS_ORDER.indexOf(batch.status);
            return (
              <Card key={batch.id} className="p-5 space-y-4">
                {/* Header row */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-sm font-bold text-gray-900">{batch.code}</span>
                    <Badge className={STATUS_COLORS[batch.status] ?? "bg-gray-100 text-gray-700"}>
                      {STATUS_LABELS[batch.status] ?? batch.status}
                    </Badge>
                    {batch.carrier && (
                      <span className="text-xs text-gray-500">{batch.carrier}</span>
                    )}
                    {batch.trackingCode && (
                      <span className="font-mono text-xs text-blue-600">{batch.trackingCode}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => { setEditTarget(batch); setEditForm(emptyEditForm(batch)); setEditOpen(true); }}
                      className="text-gray-400 hover:text-blue-500 transition-colors"
                      title="Chỉnh sửa"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(batch.id)}
                      className="text-gray-400 hover:text-red-500 transition-colors"
                      title="Xoá"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {batch.description && (
                  <p className="text-sm text-gray-600">{batch.description}</p>
                )}

                {/* Timeline */}
                <div className="flex items-center gap-0">
                  {TIMELINE_LABELS.map((label, idx) => {
                    const done = idx <= statusIdx;
                    return (
                      <div key={idx} className="flex items-center">
                        <div className="flex flex-col items-center">
                          {done ? (
                            <CheckCircle2 className="h-5 w-5 text-green-500" />
                          ) : (
                            <Circle className="h-5 w-5 text-gray-300" />
                          )}
                          <span className={`text-xs mt-1 whitespace-nowrap ${done ? "text-green-600 font-medium" : "text-gray-400"}`}>
                            {label}
                          </span>
                        </div>
                        {idx < TIMELINE_LABELS.length - 1 && (
                          <div className={`h-0.5 w-10 mx-1 mb-4 ${idx < statusIdx ? "bg-green-400" : "bg-gray-200"}`} />
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Purchase orders */}
                {batch.orders.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-gray-500">Đơn hàng trong lô:</p>
                    <div className="flex flex-wrap gap-2">
                      {batch.orders.map((bo) => (
                        <span key={bo.purchaseOrderId} className="inline-flex items-center gap-1.5 rounded-md bg-gray-100 px-2.5 py-1 text-xs text-gray-700">
                          <span className="font-mono font-medium">{bo.purchaseOrder.code}</span>
                          <span className="text-gray-400">·</span>
                          <span>{bo.purchaseOrder.supplier.name}</span>
                          <span className="text-gray-400">·</span>
                          <span>{formatVND(bo.purchaseOrder.totalVnd)}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Meta row */}
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    {batch.totalWeightKg != null && (
                      <span>{batch.totalWeightKg} kg</span>
                    )}
                    {batch.shippingCostVnd != null && (
                      <span>Phí ship: {formatVND(batch.shippingCostVnd)}</span>
                    )}
                    {batch.packedDate && (
                      <span>Đóng: {formatDate(batch.packedDate)}</span>
                    )}
                    {batch.departedVnDate && (
                      <span>Xuất: {formatDate(batch.departedVnDate)}</span>
                    )}
                  </div>
                  <button
                    onClick={() => toggleTdSheet(batch)}
                    className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md transition-colors ${
                      batch.tdSheetUpdated
                        ? "bg-green-100 text-green-700 hover:bg-green-200"
                        : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                    }`}
                  >
                    {batch.tdSheetUpdated ? (
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    ) : (
                      <Circle className="h-3.5 w-3.5" />
                    )}
                    Kho TD đã cập nhật
                  </button>
                </div>

                {batch.notes && (
                  <p className="text-xs text-gray-400 border-t border-gray-100 pt-2">{batch.notes}</p>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
