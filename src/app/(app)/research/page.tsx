"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
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
import {
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  ShoppingCart,
} from "lucide-react";
import { formatVND } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

interface ResearchPrice {
  id: string;
  supplierName: string | null;
  priceVnd: number;
  unit: string;
  quality: string | null;
  isVerified: boolean;
  date: string;
  notes: string | null;
}

interface ResearchItem {
  id: string;
  productName: string;
  productId: string | null;
  unit: string;
  targetPriceVnd: number | null;
  targetQty: number | null;
  priority: number;
  status: string;
  qualityNotes: string | null;
  sourceNotes: string | null;
  generalNotes: string | null;
  createdAt: string;
  prices: ResearchPrice[];
  avgPriceVnd: number | null;
  minPriceVnd: number | null;
  maxPriceVnd: number | null;
  product: { id: string; name: string; nameVi: string | null } | null;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const PRIORITY_LABELS: Record<number, string> = {
  1: "Thấp",
  2: "Bình thường",
  3: "Cao",
  4: "Khẩn",
};

const PRIORITY_COLORS: Record<number, string> = {
  1: "bg-gray-100 text-gray-600",
  2: "bg-blue-100 text-blue-700",
  3: "bg-orange-100 text-orange-700",
  4: "bg-red-100 text-red-700",
};

const STATUS_LABELS: Record<string, string> = {
  researching: "Đang nghiên cứu",
  ready_to_buy: "Sẵn sàng mua",
  purchased: "Đã mua",
  paused: "Tạm dừng",
};

const STATUS_COLORS: Record<string, string> = {
  researching: "bg-yellow-100 text-yellow-700",
  ready_to_buy: "bg-green-100 text-green-700",
  purchased: "bg-gray-100 text-gray-500",
  paused: "bg-gray-100 text-gray-400",
};

// ─── Empty form ───────────────────────────────────────────────────────────────

const emptyForm = {
  productName: "",
  productId: "",
  unit: "kg",
  targetQty: "",
  targetPriceVnd: "",
  priority: "2",
  qualityNotes: "",
  sourceNotes: "",
  generalNotes: "",
};

const emptyPriceForm = {
  supplierName: "",
  priceVnd: "",
  unit: "kg",
  quality: "",
  isVerified: false,
  notes: "",
};

// ─── Price bar component ──────────────────────────────────────────────────────

function PriceBar({
  min,
  max,
  avg,
  target,
}: {
  min: number | null;
  max: number | null;
  avg: number | null;
  target: number | null;
}) {
  if (min === null || max === null) {
    return (
      <p className="text-xs text-gray-400 italic">Chưa có báo giá nào</p>
    );
  }

  const range = max - min || 1;
  const avgPct = avg !== null ? ((avg - min) / range) * 100 : null;
  const targetPct =
    target !== null ? Math.max(0, Math.min(100, ((target - min) / range) * 100)) : null;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2 text-xs text-gray-500">
        <span className="text-green-700 font-medium">{formatVND(min)}</span>
        <div className="relative flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="absolute inset-y-0 left-0 bg-gradient-to-r from-green-400 to-orange-400 rounded-full"
            style={{ width: "100%" }}
          />
          {avgPct !== null && (
            <div
              className="absolute top-1/2 -translate-y-1/2 h-3 w-0.5 bg-blue-600 rounded"
              style={{ left: `${avgPct}%` }}
            />
          )}
          {targetPct !== null && (
            <div
              className="absolute top-1/2 -translate-y-1/2 h-4 w-0.5 bg-purple-600 rounded"
              style={{ left: `${targetPct}%` }}
            />
          )}
        </div>
        <span className="text-red-600 font-medium">{formatVND(max)}</span>
      </div>
      <div className="flex gap-4 text-xs text-gray-500">
        {avg !== null && (
          <span>
            <span className="text-blue-600 font-medium">TB:</span>{" "}
            {formatVND(Math.round(avg))}
          </span>
        )}
        {target !== null && (
          <span>
            <span className="text-purple-600 font-medium">Mục tiêu:</span>{" "}
            {formatVND(target)}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ResearchPage() {
  const [items, setItems] = useState<ResearchItem[]>([]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState(0);
  const [openDialog, setOpenDialog] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [expandedPrices, setExpandedPrices] = useState<Record<string, boolean>>({});
  const [openPriceDialog, setOpenPriceDialog] = useState<string | null>(null);
  const [priceForm, setPriceForm] = useState(emptyPriceForm);
  const [submitting, setSubmitting] = useState(false);

  const load = () =>
    fetch("/api/research")
      .then((r) => r.json())
      .then(setItems);

  useEffect(() => {
    load();
  }, []);

  // ── Filter ──────────────────────────────────────────────────────────────────

  const filtered = items.filter((item) => {
    if (statusFilter !== "all" && item.status !== statusFilter) return false;
    if (priorityFilter !== 0 && item.priority !== priorityFilter) return false;
    return true;
  });

  // ── Create research item ────────────────────────────────────────────────────

  async function createItem() {
    if (!form.productName.trim()) {
      toast.error("Nhập tên sản phẩm");
      return;
    }
    setSubmitting(true);
    const res = await fetch("/api/research", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        productId: form.productId || undefined,
        targetPriceVnd: form.targetPriceVnd ? Number(form.targetPriceVnd) : null,
        targetQty: form.targetQty ? Number(form.targetQty) : null,
        priority: Number(form.priority),
      }),
    });
    setSubmitting(false);
    if (res.ok) {
      toast.success("Đã thêm sản phẩm nghiên cứu");
      setOpenDialog(false);
      setForm(emptyForm);
      load();
    } else {
      toast.error("Có lỗi xảy ra");
    }
  }

  // ── Delete research item ────────────────────────────────────────────────────

  async function deleteItem(id: string) {
    if (!confirm("Xoá mục nghiên cứu này?")) return;
    const res = await fetch(`/api/research/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Đã xoá");
      load();
    } else {
      toast.error("Có lỗi xảy ra");
    }
  }

  // ── Update status ───────────────────────────────────────────────────────────

  async function updateStatus(id: string, status: string) {
    const res = await fetch(`/api/research/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      load();
    } else {
      toast.error("Có lỗi cập nhật trạng thái");
    }
  }

  // ── Add price ───────────────────────────────────────────────────────────────

  async function addPrice(researchId: string) {
    if (!priceForm.priceVnd) {
      toast.error("Nhập giá báo");
      return;
    }
    setSubmitting(true);
    const res = await fetch(`/api/research/${researchId}/prices`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...priceForm,
        priceVnd: Number(priceForm.priceVnd),
      }),
    });
    setSubmitting(false);
    if (res.ok) {
      toast.success("Đã thêm báo giá");
      setOpenPriceDialog(null);
      setPriceForm(emptyPriceForm);
      load();
    } else {
      toast.error("Có lỗi xảy ra");
    }
  }

  // ── Delete price ────────────────────────────────────────────────────────────

  async function deletePrice(researchId: string, priceId: string) {
    const res = await fetch(`/api/research/${researchId}/prices`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ priceId }),
    });
    if (res.ok) {
      load();
    } else {
      toast.error("Có lỗi xoá báo giá");
    }
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Nghiên cứu giá mua</h1>
          <p className="text-sm text-gray-500">
            Phân tích thị trường & xác định mức giá mục tiêu
          </p>
        </div>
        <Button
          onClick={() => { setOpenDialog(true); setForm(emptyForm); }}
          className="bg-green-600 hover:bg-green-700"
        >
          <Plus className="mr-2 h-4 w-4" /> Thêm sản phẩm
        </Button>
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {[
          { key: "all", label: "Tất cả" },
          { key: "researching", label: "Đang nghiên cứu" },
          { key: "ready_to_buy", label: "Sẵn sàng mua" },
          { key: "purchased", label: "Đã mua" },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setStatusFilter(key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              statusFilter === key
                ? "border-green-600 text-green-700"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {label}
            {key !== "all" && (
              <span className="ml-1.5 text-xs text-gray-400">
                ({items.filter((i) => i.status === key).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Priority filter */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500 font-medium">Ưu tiên:</span>
        {[
          { val: 0, label: "Tất cả" },
          { val: 4, label: "Khẩn" },
          { val: 3, label: "Cao" },
          { val: 2, label: "Bình thường" },
          { val: 1, label: "Thấp" },
        ].map(({ val, label }) => (
          <button
            key={val}
            onClick={() => setPriorityFilter(val)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              priorityFilter === val
                ? val === 0
                  ? "bg-gray-800 text-white"
                  : PRIORITY_COLORS[val] + " ring-2 ring-offset-1 ring-current"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Items */}
      {filtered.length === 0 ? (
        <Card className="flex h-48 items-center justify-center">
          <p className="text-gray-400">Chưa có mục nghiên cứu nào</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {filtered.map((item) => {
            const expanded = expandedPrices[item.id] ?? false;
            const visiblePrices = expanded ? item.prices : item.prices.slice(0, 3);

            return (
              <Card key={item.id} className="p-5 space-y-4">
                {/* Card header */}
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge className={`text-xs ${PRIORITY_COLORS[item.priority]}`}>
                      {PRIORITY_LABELS[item.priority]}
                    </Badge>
                    <Badge className={`text-xs ${STATUS_COLORS[item.status]}`}>
                      {STATUS_LABELS[item.status]}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="text-red-400 hover:text-red-600"
                      onClick={() => deleteItem(item.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Product name + unit */}
                <div className="flex items-baseline justify-between">
                  <h3 className="text-lg font-semibold text-gray-900">
                    {item.productName}
                  </h3>
                  <span className="text-sm text-gray-500 shrink-0 ml-2">
                    / {item.unit}
                  </span>
                </div>

                {/* Quality notes */}
                {item.qualityNotes && (
                  <p className="text-sm text-gray-500 italic">{item.qualityNotes}</p>
                )}

                {/* Divider */}
                <div className="border-t border-gray-100" />

                {/* Price analysis */}
                <PriceBar
                  min={item.minPriceVnd}
                  max={item.maxPriceVnd}
                  avg={item.avgPriceVnd}
                  target={item.targetPriceVnd}
                />

                {/* Price quotes */}
                {item.prices.length > 0 && (
                  <div className="space-y-2">
                    <div className="overflow-hidden rounded-lg border border-gray-100">
                      <table className="w-full text-xs">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-3 py-2 text-left text-gray-500 font-medium">Nhà cung cấp</th>
                            <th className="px-3 py-2 text-left text-gray-500 font-medium">Chất lượng</th>
                            <th className="px-3 py-2 text-right text-gray-500 font-medium">Giá</th>
                            <th className="px-3 py-2 text-center text-gray-500 font-medium">XN</th>
                            <th className="px-3 py-2" />
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {visiblePrices.map((price) => (
                            <tr key={price.id} className="hover:bg-gray-50">
                              <td className="px-3 py-2 text-gray-700">
                                {price.supplierName || <span className="text-gray-300">—</span>}
                              </td>
                              <td className="px-3 py-2 text-gray-500">
                                {price.quality || <span className="text-gray-300">—</span>}
                              </td>
                              <td className="px-3 py-2 text-right font-semibold text-gray-900">
                                {formatVND(price.priceVnd)}
                              </td>
                              <td className="px-3 py-2 text-center">
                                {price.isVerified ? (
                                  <CheckCircle2 className="h-3.5 w-3.5 text-green-500 mx-auto" />
                                ) : (
                                  <span className="text-gray-300">—</span>
                                )}
                              </td>
                              <td className="px-3 py-2">
                                <button
                                  onClick={() => deletePrice(item.id, price.id)}
                                  className="text-gray-300 hover:text-red-400 transition-colors"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {item.prices.length > 3 && (
                      <button
                        onClick={() =>
                          setExpandedPrices((prev) => ({
                            ...prev,
                            [item.id]: !prev[item.id],
                          }))
                        }
                        className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600"
                      >
                        {expanded ? (
                          <>
                            <ChevronUp className="h-3 w-3" /> Thu gọn
                          </>
                        ) : (
                          <>
                            <ChevronDown className="h-3 w-3" /> Xem thêm{" "}
                            {item.prices.length - 3} báo giá
                          </>
                        )}
                      </button>
                    )}
                  </div>
                )}

                {/* Add price button */}
                <div className="flex items-center justify-between gap-2">
                  <button
                    onClick={() => {
                      setOpenPriceDialog(item.id);
                      setPriceForm({ ...emptyPriceForm, unit: item.unit });
                    }}
                    className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium"
                  >
                    <Plus className="h-3 w-3" /> Thêm báo giá
                  </button>

                  {item.status === "ready_to_buy" && (
                    <Button
                      size="sm"
                      className="bg-green-600 hover:bg-green-700 text-xs h-7"
                      onClick={() => updateStatus(item.id, "purchased")}
                    >
                      <ShoppingCart className="mr-1 h-3 w-3" /> Tạo đơn mua
                    </Button>
                  )}

                  {item.status === "researching" && item.prices.length > 0 && (
                    <button
                      onClick={() => updateStatus(item.id, "ready_to_buy")}
                      className="text-xs text-green-600 hover:text-green-800 font-medium"
                    >
                      → Đánh dấu sẵn sàng mua
                    </button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create research item dialog */}
      <Dialog open={openDialog} onOpenChange={setOpenDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Thêm sản phẩm nghiên cứu</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>Tên sản phẩm *</Label>
              <Input
                placeholder="VD: Hạt sen tươi Đồng Tháp"
                value={form.productName}
                onChange={(e) => setForm({ ...form, productName: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Đơn vị</Label>
                <select
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={form.unit}
                  onChange={(e) => setForm({ ...form, unit: e.target.value })}
                >
                  <option value="kg">kg</option>
                  <option value="gói">gói</option>
                  <option value="pack">pack</option>
                  <option value="hộp">hộp</option>
                  <option value="unit">unit</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Ưu tiên</Label>
                <select
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={form.priority}
                  onChange={(e) => setForm({ ...form, priority: e.target.value })}
                >
                  <option value="1">1 – Thấp</option>
                  <option value="2">2 – Bình thường</option>
                  <option value="3">3 – Cao</option>
                  <option value="4">4 – Khẩn</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Giá mục tiêu (VND)</Label>
                <Input
                  type="number"
                  placeholder="VD: 150000"
                  value={form.targetPriceVnd}
                  onChange={(e) =>
                    setForm({ ...form, targetPriceVnd: e.target.value })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>Số lượng dự kiến</Label>
                <Input
                  type="number"
                  placeholder="VD: 5"
                  value={form.targetQty}
                  onChange={(e) => setForm({ ...form, targetQty: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Yêu cầu chất lượng</Label>
              <Input
                placeholder="VD: Loại 1, hàng tươi, không dập..."
                value={form.qualityNotes}
                onChange={(e) =>
                  setForm({ ...form, qualityNotes: e.target.value })
                }
              />
            </div>

            <div className="space-y-1.5">
              <Label>Nguồn / địa chỉ mua</Label>
              <Input
                placeholder="VD: Chợ Bình Điền, chợ đầu mối Thủ Đức..."
                value={form.sourceNotes}
                onChange={(e) =>
                  setForm({ ...form, sourceNotes: e.target.value })
                }
              />
            </div>

            <div className="space-y-1.5">
              <Label>Ghi chú chung</Label>
              <Input
                placeholder="Ghi chú thêm..."
                value={form.generalNotes}
                onChange={(e) =>
                  setForm({ ...form, generalNotes: e.target.value })
                }
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setOpenDialog(false)}>
                Huỷ
              </Button>
              <Button
                onClick={createItem}
                disabled={submitting}
                className="bg-green-600 hover:bg-green-700"
              >
                Thêm mới
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add price dialog */}
      <Dialog
        open={openPriceDialog !== null}
        onOpenChange={(open) => { if (!open) setOpenPriceDialog(null); }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Thêm báo giá</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>Nhà cung cấp</Label>
              <Input
                placeholder="Tên người bán / chợ..."
                value={priceForm.supplierName}
                onChange={(e) =>
                  setPriceForm({ ...priceForm, supplierName: e.target.value })
                }
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Giá (VND) *</Label>
                <Input
                  type="number"
                  placeholder="VD: 150000"
                  value={priceForm.priceVnd}
                  onChange={(e) =>
                    setPriceForm({ ...priceForm, priceVnd: e.target.value })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>Chất lượng</Label>
                <Input
                  placeholder="Loại 1, Tươi..."
                  value={priceForm.quality}
                  onChange={(e) =>
                    setPriceForm({ ...priceForm, quality: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Ghi chú</Label>
              <Input
                placeholder="Ghi chú thêm..."
                value={priceForm.notes}
                onChange={(e) =>
                  setPriceForm({ ...priceForm, notes: e.target.value })
                }
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isVerified"
                checked={priceForm.isVerified}
                onChange={(e) =>
                  setPriceForm({ ...priceForm, isVerified: e.target.checked })
                }
                className="rounded"
              />
              <Label htmlFor="isVerified" className="cursor-pointer font-normal">
                Đã xác minh giá
              </Label>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => setOpenPriceDialog(null)}>
                Huỷ
              </Button>
              <Button
                onClick={() => openPriceDialog && addPrice(openPriceDialog)}
                disabled={submitting}
                className="bg-green-600 hover:bg-green-700"
              >
                Thêm báo giá
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
