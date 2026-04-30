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
import { Plus, Trash2 } from "lucide-react";

interface FundTransaction {
  id: string;
  date: string;
  type: string;
  amountVnd: number;
  description: string | null;
  purchaseOrderId: string | null;
  purchaseOrder: { code: string } | null;
}

interface FundSummary {
  totalNhungIn: number;
  totalSpent: number;
  totalNhungOut: number;
  balance: number;
}

const TYPE_LABELS: Record<string, string> = {
  nhung_in: "Nhung gửi",
  spent: "Chi mua hàng",
  nhung_out: "Trả Nhung",
  other_in: "Thu khác",
  other_out: "Chi khác",
};

const TYPE_BADGE_COLORS: Record<string, string> = {
  nhung_in: "bg-green-100 text-green-700",
  spent: "bg-red-100 text-red-700",
  nhung_out: "bg-blue-100 text-blue-700",
  other_in: "bg-gray-100 text-gray-700",
  other_out: "bg-gray-100 text-gray-700",
};

const today = new Date().toISOString().split("T")[0];

export default function FundPage() {
  const [transactions, setTransactions] = useState<FundTransaction[]>([]);
  const [summary, setSummary] = useState<FundSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    date: today,
    type: "nhung_in",
    amountVnd: "",
    description: "",
    purchaseOrderId: "",
  });

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/fund");
      const data = await res.json();
      setTransactions(data.transactions);
      setSummary(data.summary);
    } catch {
      toast.error("Có lỗi xảy ra khi tải dữ liệu");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/fund", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: form.date,
          type: form.type,
          amountVnd: Number(form.amountVnd),
          description: form.description || null,
          purchaseOrderId: form.type === "spent" && form.purchaseOrderId ? form.purchaseOrderId : null,
        }),
      });
      if (!res.ok) { toast.error("Có lỗi xảy ra"); return; }
      toast.success("Đã ghi nhận giao dịch");
      setOpen(false);
      setForm({ date: today, type: "nhung_in", amountVnd: "", description: "", purchaseOrderId: "" });
      load();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Xoá giao dịch này?")) return;
    const res = await fetch(`/api/fund/${id}`, { method: "DELETE" });
    if (!res.ok) { toast.error("Có lỗi xảy ra"); return; }
    toast.success("Đã xoá");
    load();
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-green-600 border-t-transparent" />
      </div>
    );
  }

  const balance = summary?.balance ?? 0;
  const isPositive = balance >= 0;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sổ quỹ</h1>
          <p className="text-sm text-gray-500">Theo dõi dòng tiền bạn ↔ Nhung</p>
        </div>
        <Button onClick={() => setOpen(true)} className="bg-green-600 hover:bg-green-700 text-white gap-2">
          <Plus className="h-4 w-4" />
          Ghi nhận
        </Button>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Ghi nhận giao dịch</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4 mt-2">
              <div className="space-y-1.5">
                <Label>Ngày</Label>
                <Input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label>Loại giao dịch</Label>
                <select
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                >
                  <option value="nhung_in">Nhung gửi tiền</option>
                  <option value="spent">Chi mua hàng</option>
                  <option value="nhung_out">Trả lại Nhung</option>
                  <option value="other_in">Thu khác</option>
                  <option value="other_out">Chi khác</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Số tiền (VND)</Label>
                <Input
                  type="number"
                  min={0}
                  placeholder="0"
                  value={form.amountVnd}
                  onChange={(e) => setForm({ ...form, amountVnd: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label>Mô tả</Label>
                <Input
                  placeholder="Ghi chú..."
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </div>
              {form.type === "spent" && (
                <div className="space-y-1.5">
                  <Label>Mã đơn mua (tuỳ chọn)</Label>
                  <Input
                    placeholder="VD: PO260415-123"
                    value={form.purchaseOrderId}
                    onChange={(e) => setForm({ ...form, purchaseOrderId: e.target.value })}
                  />
                </div>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Huỷ</Button>
                <Button type="submit" disabled={saving} className="bg-green-600 hover:bg-green-700 text-white">
                  {saving ? "Đang lưu..." : "Lưu"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary card */}
      {summary && (
        <Card className="p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Tổng hợp quỹ</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-lg bg-green-50 p-4">
              <p className="text-xs text-green-600 font-medium">Nhung đã nạp</p>
              <p className="text-xl font-bold text-green-700 mt-1">{formatVND(summary.totalNhungIn)}</p>
            </div>
            <div className="rounded-lg bg-red-50 p-4">
              <p className="text-xs text-red-600 font-medium">Đã chi mua hàng</p>
              <p className="text-xl font-bold text-red-700 mt-1">{formatVND(summary.totalSpent)}</p>
            </div>
            <div className={`rounded-lg p-4 ${isPositive ? "bg-blue-50" : "bg-orange-50"}`}>
              <p className={`text-xs font-medium ${isPositive ? "text-blue-600" : "text-orange-600"}`}>
                Số dư {isPositive ? "(Nhung còn credit)" : "(Bạn đang ứng)"}
              </p>
              <p className={`text-xl font-bold mt-1 ${isPositive ? "text-blue-700" : "text-orange-700"}`}>
                {formatVND(Math.abs(balance))}
                {!isPositive && <span className="text-sm ml-1">(âm)</span>}
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Transactions table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Ngày</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Loại</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Mô tả</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">Số tiền</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Đơn mua</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-400">Chưa có giao dịch nào</td>
                </tr>
              ) : (
                transactions.map((t) => (
                  <tr key={t.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{formatDate(t.date)}</td>
                    <td className="px-4 py-3">
                      <Badge className={TYPE_BADGE_COLORS[t.type] ?? "bg-gray-100 text-gray-700"}>
                        {TYPE_LABELS[t.type] ?? t.type}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-gray-600 max-w-xs truncate">{t.description ?? "—"}</td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900 whitespace-nowrap">
                      {formatVND(t.amountVnd)}
                    </td>
                    <td className="px-4 py-3 text-gray-500 font-mono text-xs">
                      {t.purchaseOrder?.code ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleDelete(t.id)}
                        className="text-gray-400 hover:text-red-500 transition-colors"
                        title="Xoá"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
