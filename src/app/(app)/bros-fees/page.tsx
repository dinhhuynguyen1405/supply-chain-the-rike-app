"use client";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { formatUSD, formatDate } from "@/lib/utils";
import { Plus, Trash2, Warehouse, DollarSign, Package, TrendingDown } from "lucide-react";

interface BrosFee {
  id: string;
  type: string;
  description: string;
  amountUsd: number;
  amountVnd: number | null;
  sku: string | null;
  quantity: number | null;
  shipmentBatchId: string | null;
  fulfillmentOrderId: string | null;
  paidAt: string | null;
  note: string | null;
  createdAt: string;
}

interface Summary {
  totalUsd: number;
  byType: Record<string, number>;
}

const TYPE_OPTIONS = [
  { value: "inbound",     label: "Phí nhận hàng (Inbound)" },
  { value: "storage",     label: "Phí lưu kho (Storage)" },
  { value: "fulfillment", label: "Phí đóng hàng (Fulfillment)" },
  { value: "return",      label: "Phí hàng trả về (Return)" },
  { value: "other",       label: "Phí khác" },
];

const TYPE_COLORS: Record<string, string> = {
  inbound:     "bg-blue-100 text-blue-700",
  storage:     "bg-purple-100 text-purple-700",
  fulfillment: "bg-green-100 text-green-700",
  return:      "bg-red-100 text-red-700",
  other:       "bg-gray-100 text-gray-700",
};

const TYPE_ICONS: Record<string, React.ReactNode> = {
  inbound:     <Package className="h-4 w-4" />,
  storage:     <Warehouse className="h-4 w-4" />,
  fulfillment: <TrendingDown className="h-4 w-4" />,
  return:      <TrendingDown className="h-4 w-4" />,
  other:       <DollarSign className="h-4 w-4" />,
};

interface FormState {
  type: string;
  description: string;
  amountUsd: string;
  amountVnd: string;
  sku: string;
  quantity: string;
  shipmentBatchId: string;
  paidAt: string;
  note: string;
}

const EMPTY_FORM: FormState = {
  type: "inbound",
  description: "",
  amountUsd: "",
  amountVnd: "",
  sku: "",
  quantity: "",
  shipmentBatchId: "",
  paidAt: new Date().toISOString().split("T")[0],
  note: "",
};

export default function BrosFeesPage() {
  const [fees, setFees] = useState<BrosFee[]>([]);
  const [summary, setSummary] = useState<Summary>({ totalUsd: 0, byType: {} });
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [filterType, setFilterType] = useState("all");

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/bros-fees");
      const data = await res.json();
      setFees(data.fees ?? []);
      setSummary(data.summary ?? { totalUsd: 0, byType: {} });
    } catch {
      toast.error("Không tải được dữ liệu");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function set(k: keyof FormState, v: string) {
    setForm((p) => ({ ...p, [k]: v }));
  }

  async function handleCreate() {
    if (!form.description.trim() || !form.amountUsd || !form.type) {
      toast.error("Vui lòng điền đủ: Loại phí, Mô tả, Số tiền");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/bros-fees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: form.type,
          description: form.description.trim(),
          amountUsd: Number(form.amountUsd),
          amountVnd: form.amountVnd ? Number(form.amountVnd) : null,
          sku: form.sku.trim() || null,
          quantity: form.quantity ? Number(form.quantity) : null,
          shipmentBatchId: form.shipmentBatchId.trim() || null,
          paidAt: form.paidAt ? new Date(form.paidAt).toISOString() : null,
          note: form.note.trim() || null,
        }),
      });
      if (!res.ok) throw new Error();
      toast.success("Đã thêm phí");
      setOpen(false);
      setForm(EMPTY_FORM);
      await load();
    } catch {
      toast.error("Lỗi khi lưu");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Xoá khoản phí này?")) return;
    try {
      await fetch(`/api/bros-fees/${id}`, { method: "DELETE" });
      toast.success("Đã xoá");
      setFees((p) => p.filter((f) => f.id !== id));
      await load(); // reload summary
    } catch {
      toast.error("Lỗi khi xoá");
    }
  }

  const filtered = filterType === "all" ? fees : fees.filter((f) => f.type === filterType);
  const usdToVnd = 25500; // fallback — ideally fetch from settings

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Phí kho Bros</h1>
          <p className="text-sm text-gray-500 mt-0.5">Theo dõi tất cả chi phí phát sinh tại kho Bros (US)</p>
        </div>
        <Button className="bg-green-600 hover:bg-green-700" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4 mr-1.5" /> Thêm phí
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {/* Total */}
        <Card className="col-span-2 lg:col-span-1 p-4 bg-gradient-to-br from-slate-50 to-slate-100 border-slate-200">
          <p className="text-xs font-medium text-slate-500 mb-1">Tổng chi phí</p>
          <p className="text-2xl font-bold text-slate-800">{formatUSD(summary.totalUsd)}</p>
          <p className="text-xs text-slate-400 mt-0.5">≈ {((summary.totalUsd * usdToVnd) / 1_000_000).toFixed(1)}M VND</p>
        </Card>

        {TYPE_OPTIONS.map((t) => (
          <Card key={t.value} className={`p-4 border ${TYPE_COLORS[t.value]?.replace("text-", "border-").replace("bg-", "border-").split(" ")[0] ?? ""}`}>
            <p className="text-xs font-medium text-gray-500 mb-1 truncate">{t.label.split(" ")[1]?.replace("(", "").replace(")", "") ?? t.label}</p>
            <p className="text-xl font-bold text-gray-800">{formatUSD(summary.byType[t.value] ?? 0)}</p>
          </Card>
        ))}
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm text-gray-500">Lọc:</span>
        {[{ value: "all", label: "Tất cả" }, ...TYPE_OPTIONS].map((t) => (
          <button
            key={t.value}
            onClick={() => setFilterType(t.value)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-all border ${
              filterType === t.value
                ? "bg-green-600 text-white border-green-600"
                : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
            }`}
          >
            {t.label}
            {t.value !== "all" && (
              <span className="ml-1 opacity-60">
                ({fees.filter((f) => f.type === t.value).length})
              </span>
            )}
          </button>
        ))}
        <span className="ml-auto text-xs text-gray-400">{filtered.length} khoản</span>
      </div>

      {/* Table */}
      <Card className="overflow-hidden">
        {loading ? (
          <div className="flex h-40 items-center justify-center">
            <div className="h-7 w-7 animate-spin rounded-full border-[3px] border-green-600 border-t-transparent" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex h-40 flex-col items-center justify-center text-gray-400">
            <Warehouse className="h-8 w-8 mb-2 opacity-30" />
            <p className="text-sm">Chưa có khoản phí nào</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Loại</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Mô tả</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">SKU</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500">Số tiền (USD)</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Ngày thanh toán</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Ghi chú</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((fee) => (
                  <tr key={fee.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <Badge className={`${TYPE_COLORS[fee.type] ?? "bg-gray-100 text-gray-600"} flex items-center gap-1 w-fit`}>
                        {TYPE_ICONS[fee.type]}
                        <span>{TYPE_OPTIONS.find((t) => t.value === fee.type)?.label ?? fee.type}</span>
                      </Badge>
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-800 max-w-xs">
                      <p className="truncate">{fee.description}</p>
                      {fee.shipmentBatchId && (
                        <p className="text-xs text-gray-400">Lô: {fee.shipmentBatchId}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500 font-mono text-xs">
                      {fee.sku ?? "—"}
                      {fee.quantity != null && (
                        <span className="ml-1 text-gray-400">×{fee.quantity}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-gray-900">
                      {formatUSD(fee.amountUsd)}
                      {fee.amountVnd && (
                        <p className="text-xs font-normal text-gray-400">
                          ≈ {(fee.amountVnd / 1_000_000).toFixed(2)}M VND
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {fee.paidAt ? formatDate(fee.paidAt) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs max-w-[140px]">
                      <p className="truncate">{fee.note ?? "—"}</p>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleDelete(fee.id)}
                        className="rounded p-1.5 text-gray-300 hover:bg-red-50 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-gray-200 bg-gray-50">
                <tr>
                  <td colSpan={3} className="px-4 py-3 text-sm font-semibold text-gray-700">
                    Tổng ({filtered.length} khoản)
                  </td>
                  <td className="px-4 py-3 text-right text-base font-bold text-gray-900">
                    {formatUSD(filtered.reduce((s, f) => s + f.amountUsd, 0))}
                  </td>
                  <td colSpan={3} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>

      {/* Create dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Thêm phí kho Bros</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            {/* Loại phí */}
            <div className="space-y-1.5">
              <Label>Loại phí <span className="text-red-500">*</span></Label>
              <Select value={form.type ?? "inbound"} onValueChange={(v) => set("type", v ?? "inbound")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TYPE_OPTIONS.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Mô tả */}
            <div className="space-y-1.5">
              <Label>Mô tả <span className="text-red-500">*</span></Label>
              <Input
                placeholder='VD: "Lô SHP-20260415-001 inbound fee", "Q2/2026 storage"'
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
              />
            </div>

            {/* Số tiền */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Số tiền (USD) <span className="text-red-500">*</span></Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                  <Input
                    type="number" step="0.01" min="0"
                    className="pl-7"
                    placeholder="0.00"
                    value={form.amountUsd}
                    onChange={(e) => set("amountUsd", e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Quy đổi VND (tuỳ chọn)</Label>
                <Input
                  type="number" min="0"
                  placeholder="VND"
                  value={form.amountVnd}
                  onChange={(e) => set("amountVnd", e.target.value)}
                />
              </div>
            </div>

            {/* SKU + Số lượng */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>SKU (tuỳ chọn)</Label>
                <Input
                  placeholder="VIET-001"
                  value={form.sku}
                  onChange={(e) => set("sku", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Số lượng (tuỳ chọn)</Label>
                <Input
                  type="number" min="0"
                  placeholder="VD: số đơn fulfillment"
                  value={form.quantity}
                  onChange={(e) => set("quantity", e.target.value)}
                />
              </div>
            </div>

            {/* Lô hàng + Ngày */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Mã lô hàng (tuỳ chọn)</Label>
                <Input
                  placeholder="SHP-20260415-001"
                  value={form.shipmentBatchId}
                  onChange={(e) => set("shipmentBatchId", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Ngày thanh toán</Label>
                <Input
                  type="date"
                  value={form.paidAt}
                  onChange={(e) => set("paidAt", e.target.value)}
                />
              </div>
            </div>

            {/* Ghi chú */}
            <div className="space-y-1.5">
              <Label>Ghi chú</Label>
              <Input
                placeholder="Ghi chú thêm..."
                value={form.note}
                onChange={(e) => set("note", e.target.value)}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setOpen(false)}>Huỷ</Button>
              <Button
                className="bg-green-600 hover:bg-green-700"
                onClick={handleCreate}
                disabled={saving}
              >
                {saving ? "Đang lưu..." : "Thêm phí"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
