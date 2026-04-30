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
import { Plus, Pencil, MapPin, Phone } from "lucide-react";

interface Supplier {
  id: string;
  name: string;
  phone: string | null;
  location: string | null;
  notes: string | null;
  _count: { purchaseOrders: number };
}

const empty = { name: "", phone: "", location: "", notes: "" };

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [form, setForm] = useState(empty);

  const load = () =>
    fetch("/api/suppliers")
      .then((r) => r.json())
      .then(setSuppliers);

  useEffect(() => {
    load();
  }, []);

  function openNew() {
    setEditing(null);
    setForm(empty);
    setOpen(true);
  }

  function openEdit(s: Supplier) {
    setEditing(s);
    setForm({
      name: s.name,
      phone: s.phone ?? "",
      location: s.location ?? "",
      notes: s.notes ?? "",
    });
    setOpen(true);
  }

  async function save() {
    if (!form.name.trim()) {
      toast.error("Vui lòng nhập tên nhà cung cấp");
      return;
    }
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
          <p className="text-sm text-gray-500">Quản lý nguồn hàng tại Việt Nam</p>
        </div>
        <Button onClick={openNew} className="bg-green-600 hover:bg-green-700">
          <Plus className="mr-2 h-4 w-4" /> Thêm nhà cung cấp
        </Button>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editing ? "Sửa nhà cung cấp" : "Thêm nhà cung cấp"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <Label>Tên *</Label>
                <Input
                  placeholder="VD: Vườn trà Bảo Lộc"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Số điện thoại</Label>
                <Input
                  placeholder="0912 345 678"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Địa điểm</Label>
                <Input
                  placeholder="VD: Bảo Lộc, Lâm Đồng"
                  value={form.location}
                  onChange={(e) =>
                    setForm({ ...form, location: e.target.value })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>Ghi chú</Label>
                <Input
                  placeholder="Ghi chú thêm..."
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Huỷ
                </Button>
                <Button
                  onClick={save}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {editing ? "Cập nhật" : "Thêm mới"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {suppliers.length === 0 ? (
        <Card className="flex h-48 items-center justify-center">
          <p className="text-gray-400">Chưa có nhà cung cấp nào</p>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {suppliers.map((s) => (
            <Card key={s.id} className="p-5">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 truncate">{s.name}</p>
                  {s.phone && (
                    <p className="mt-1 flex items-center gap-1 text-xs text-gray-500">
                      <Phone className="h-3 w-3" /> {s.phone}
                    </p>
                  )}
                  {s.location && (
                    <p className="mt-0.5 flex items-center gap-1 text-xs text-gray-500">
                      <MapPin className="h-3 w-3" /> {s.location}
                    </p>
                  )}
                  <p className="mt-2 text-xs text-gray-400">
                    {s._count.purchaseOrders} đơn mua
                  </p>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  className="shrink-0"
                  onClick={() => openEdit(s)}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              </div>
              {s.notes && (
                <p className="mt-3 rounded-md bg-gray-50 px-3 py-2 text-xs text-gray-500">
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
