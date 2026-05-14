"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus, Pencil, MapPin, Phone, Package, Clock, TrendingUp, CheckCircle2, AlertCircle } from "lucide-react";
import { formatVND, formatDate } from "@/lib/utils";

interface SupplierPerf {
  id: string;
  name: string;
  phone: string | null;
  location: string | null;
  notes: string | null;
  totalOrders: number;
  totalSpendVnd: number;
  avgDeliveryDays: number | null;
  onTimeRate: number | null;
  topProducts: { name: string; qty: number }[];
  lastOrderDate: string | null;
}

const empty = { name: "", phone: "", location: "", notes: "" };

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<SupplierPerf[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<SupplierPerf | null>(null);
  const [form, setForm] = useState(empty);

  const load = () => {
    setLoading(true);
    fetch("/api/suppliers/performance")
      .then((r) => r.json())
      .then((data) => setSuppliers(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  function openNew() {
    setEditing(null);
    setForm(empty);
    setOpen(true);
  }

  function openEdit(s: SupplierPerf) {
    setEditing(s);
    setForm({ name: s.name, phone: s.phone ?? "", location: s.location ?? "", notes: s.notes ?? "" });
    setOpen(true);
  }

  async function save() {
    if (!form.name.trim()) return toast.error("Vui lòng nhập tên nhà cung cấp");
    const url = editing ? `/api/suppliers/${editing.id}` : "/api/suppliers";
    const method = editing ? "PUT" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      toast.success(editing ? "Đã cập nhật" : "Đã thêm nhà cung cấp");
      setOpen(false);
      load();
    } else {
      toast.error("Có lỗi xảy ra");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Nhà cung cấp</h1>
          <p className="text-sm text-gray-500">Quản lý nguồn hàng & hiệu suất nhà cung cấp</p>
        </div>
        <Button onClick={openNew} className="bg-gray-900 hover:bg-gray-800">
          <Plus className="mr-2 h-4 w-4" /> Thêm nhà cung cấp
        </Button>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? "Sửa nhà cung cấp" : "Thêm nhà cung cấp"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <Label>Tên *</Label>
                <Input placeholder="VD: Vườn trà Bảo Lộc" value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Số điện thoại</Label>
                <Input placeholder="0912 345 678" value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Địa điểm</Label>
                <Input placeholder="VD: Bảo Lộc, Lâm Đồng" value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Ghi chú</Label>
                <Input placeholder="Ghi chú thêm..." value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setOpen(false)}>Huỷ</Button>
                <Button onClick={save} className="bg-gray-900 hover:bg-gray-800">
                  {editing ? "Cập nhật" : "Thêm mới"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex h-48 items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-gray-700" />
        </div>
      ) : suppliers.length === 0 ? (
        <Card className="flex h-48 items-center justify-center">
          <p className="text-gray-400">Chưa có nhà cung cấp nào</p>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {suppliers.map((s) => (
            <Card key={s.id} className="p-5 space-y-4">
              {/* Header */}
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 text-base">{s.name}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5">
                    {s.phone && (
                      <span className="flex items-center gap-1 text-xs text-gray-400">
                        <Phone className="h-3 w-3" /> {s.phone}
                      </span>
                    )}
                    {s.location && (
                      <span className="flex items-center gap-1 text-xs text-gray-400">
                        <MapPin className="h-3 w-3" /> {s.location}
                      </span>
                    )}
                  </div>
                </div>
                <Button size="icon" variant="ghost" className="shrink-0 h-8 w-8" onClick={() => openEdit(s)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              </div>

              {/* KPI strip */}
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-lg bg-gray-50 px-3 py-2">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wide">Đơn mua</p>
                  <p className="text-lg font-bold text-gray-900">{s.totalOrders}</p>
                </div>
                <div className="rounded-lg bg-gray-50 px-3 py-2">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wide">Tổng chi</p>
                  <p className="text-sm font-bold text-gray-900 leading-tight mt-0.5">{formatVND(s.totalSpendVnd)}</p>
                </div>
                <div className="rounded-lg bg-gray-50 px-3 py-2">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wide">Giao đúng hạn</p>
                  {s.onTimeRate !== null ? (
                    <div className="flex items-center gap-1 mt-0.5">
                      {s.onTimeRate >= 80
                        ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                        : <AlertCircle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                      }
                      <p className={`text-lg font-bold ${s.onTimeRate >= 80 ? "text-emerald-600" : "text-amber-600"}`}>
                        {s.onTimeRate}%
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-300 mt-0.5">—</p>
                  )}
                </div>
              </div>

              {/* Delivery time + last order */}
              <div className="flex items-center gap-4 text-xs text-gray-500">
                {s.avgDeliveryDays !== null && (
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    TB giao: <strong className="text-gray-700 ml-0.5">{s.avgDeliveryDays} ngày</strong>
                  </span>
                )}
                {s.lastOrderDate && (
                  <span className="flex items-center gap-1">
                    <TrendingUp className="h-3 w-3" />
                    Đơn gần: <strong className="text-gray-700 ml-0.5">{formatDate(s.lastOrderDate)}</strong>
                  </span>
                )}
              </div>

              {/* Top products */}
              {s.topProducts.length > 0 && (
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-gray-400 mb-1.5">Hàng hay mua</p>
                  <div className="flex flex-wrap gap-1.5">
                    {s.topProducts.map((p, i) => (
                      <span key={i} className="flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-700">
                        <Package className="h-2.5 w-2.5 text-gray-400" />
                        {p.name}
                        <span className="text-gray-400">×{p.qty}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {s.notes && (
                <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800 border border-amber-100">
                  {s.notes}
                </p>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
