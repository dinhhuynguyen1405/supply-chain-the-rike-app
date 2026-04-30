"use client";
import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { formatDate, formatVND } from "@/lib/utils";
import {
  Factory, ArrowLeft, CheckCircle2, AlertTriangle, PackageCheck,
  Trash2, Plus, Pencil, X, DollarSign,
} from "lucide-react";

interface Product {
  id: string;
  name: string;
  nameVi: string | null;
  unit: string;
  gramsPerUnit: number | null;
  piecesPerUnit: number | null;
  piecesPerPack: number | null;
  skuShopify: string | null;
}

interface PurchaseItem {
  quantity: number;
  priceVnd: number;
  subtotalVnd: number;
  notes: string | null;
}

interface ProductionItem {
  id: string;
  product: Product;
  purchaseItem: PurchaseItem;
  plannedQty: number;
  actualQty: number | null;
  wasteNote: string | null;
  gramsPerPack: number | null;
  piecesPerUnit: number | null;
  piecesPerPack: number | null;
}

interface ProductionCost {
  id: string;
  type: string;     // "material" | "packaging" | "labor" | "shipping" | "other"
  description: string;
  amountVnd: number;
  note: string | null;
  purchaseOrderId: string | null;
}

interface ProductionOrder {
  id: string;
  code: string;
  status: string;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  notes: string | null;
  purchaseOrder: {
    code: string;
    arrivedDate: string | null;
    supplier: { name: string };
  };
  items: ProductionItem[];
  costs: ProductionCost[];
}

/** Tính số gói dự kiến từ config người dùng nhập */
function calcPlanned(
  quantity: number,
  unit: string,
  gramsPerPack: string,
  piecesPerUnit: string,
  piecesPerPack: string,
): number | null {
  const gpp = Number(gramsPerPack);
  const ppu = Number(piecesPerUnit);
  const ppp = Number(piecesPerPack);
  if (ppu > 0 && ppp > 0) return Math.floor((quantity * ppu) / ppp);
  if (gpp > 0) {
    if (unit === "kg") return Math.floor((quantity * 1000) / gpp);
    if (unit === "g")  return Math.floor(quantity / gpp);
  }
  return null;
}

const STATUS_LABELS: Record<string, string> = {
  pending:       "Chờ sản xuất",
  in_production: "Đang sản xuất",
  done:          "Hoàn tất",
  cancelled:     "Đã hủy",
};

const STATUS_COLORS: Record<string, string> = {
  pending:       "bg-amber-100 text-amber-700",
  in_production: "bg-blue-100 text-blue-700",
  done:          "bg-green-100 text-green-700",
  cancelled:     "bg-gray-100 text-gray-500",
};

const COST_TYPE_LABELS: Record<string, string> = {
  material:  "Nguyên liệu",
  packaging: "Bao bì",
  labor:     "Nhân công",
  shipping:  "Phí ship",
  other:     "Khác",
};

const COST_TYPE_COLORS: Record<string, string> = {
  material:  "bg-blue-100 text-blue-700",
  packaging: "bg-orange-100 text-orange-700",
  labor:     "bg-purple-100 text-purple-700",
  shipping:  "bg-cyan-100 text-cyan-700",
  other:     "bg-gray-100 text-gray-600",
};

interface ItemState {
  actualQty:    string;
  wasteNote:    string;
  gramsPerPack: string;
  piecesPerUnit: string;
  piecesPerPack: string;
}

interface NewCostState {
  type: string;
  description: string;
  amountVnd: string;
  note: string;
}

interface EditCostState {
  description: string;
  amountVnd: string;
  note: string;
}

export default function ProductionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const [order, setOrder] = useState<ProductionOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [itemStates, setItemStates] = useState<Record<string, ItemState>>({});
  const [notes, setNotes] = useState("");

  // Cost form
  const [showAddCost, setShowAddCost] = useState(false);
  const [newCost, setNewCost] = useState<NewCostState>({
    type: "packaging", description: "", amountVnd: "", note: "",
  });
  const [editingCostId, setEditingCostId] = useState<string | null>(null);
  const [editCost, setEditCost] = useState<EditCostState>({ description: "", amountVnd: "", note: "" });
  const [costSaving, setCostSaving] = useState(false);

  async function load() {
    const res = await fetch(`/api/production/${id}`);
    if (!res.ok) { toast.error("Không tìm thấy lệnh sản xuất"); return; }
    const data: ProductionOrder = await res.json();
    setOrder(data);
    setNotes(data.notes ?? "");
    const init: Record<string, ItemState> = {};
    for (const item of data.items) {
      init[item.id] = {
        actualQty:    item.actualQty != null ? String(item.actualQty) : "",
        wasteNote:    item.wasteNote ?? "",
        gramsPerPack: item.gramsPerPack != null ? String(item.gramsPerPack) : "",
        piecesPerUnit: item.piecesPerUnit != null ? String(item.piecesPerUnit) : "",
        piecesPerPack: item.piecesPerPack != null ? String(item.piecesPerPack) : "",
      };
    }
    setItemStates(init);
    setLoading(false);
  }

  useEffect(() => { load(); }, [id]);

  function setField(itemId: string, field: keyof ItemState, value: string) {
    setItemStates((prev) => ({ ...prev, [itemId]: { ...prev[itemId], [field]: value } }));
  }

  async function patch(body: Record<string, unknown>) {
    setSaving(true);
    const res = await fetch(`/api/production/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setSaving(false);
    if (!res.ok) { toast.error("Lỗi lưu dữ liệu"); return false; }
    return true;
  }

  function buildItemsPayload() {
    if (!order) return [];
    return order.items.map((item) => {
      const s = itemStates[item.id];
      const planned = calcPlanned(
        item.purchaseItem.quantity,
        item.product.unit,
        s?.gramsPerPack ?? "",
        s?.piecesPerUnit ?? "",
        s?.piecesPerPack ?? "",
      );
      return {
        id: item.id,
        actualQty:    s?.actualQty !== "" ? Number(s?.actualQty) : null,
        wasteNote:    s?.wasteNote || null,
        gramsPerPack: s?.gramsPerPack  ? Number(s.gramsPerPack)  : null,
        piecesPerUnit: s?.piecesPerUnit ? Number(s.piecesPerUnit) : null,
        piecesPerPack: s?.piecesPerPack ? Number(s.piecesPerPack) : null,
        plannedQty:   planned ?? item.plannedQty,
      };
    });
  }

  async function handleStart() {
    const ok = await patch({ status: "in_production", items: buildItemsPayload() });
    if (ok) { toast.success("Đã bắt đầu sản xuất"); load(); }
  }

  async function handleSave() {
    const ok = await patch({ items: buildItemsPayload(), notes: notes || null });
    if (ok) { toast.success("Đã lưu"); load(); }
  }

  async function handleComplete() {
    const ok = await patch({ status: "done", items: buildItemsPayload(), notes: notes || null });
    if (ok) { toast.success("Lệnh sản xuất hoàn tất!"); load(); }
  }

  async function handleDelete() {
    if (!confirm("Xóa lệnh sản xuất này?")) return;
    const res = await fetch(`/api/production/${id}`, { method: "DELETE" });
    if (res.ok) { toast.success("Đã xóa"); router.push("/production"); }
    else toast.error("Lỗi xóa");
  }

  async function handleAddCost() {
    if (!newCost.description.trim() || !newCost.amountVnd) {
      toast.error("Vui lòng nhập mô tả và số tiền");
      return;
    }
    setCostSaving(true);
    const res = await fetch(`/api/production/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        addCost: {
          type:        newCost.type,
          description: newCost.description.trim(),
          amountVnd:   Number(newCost.amountVnd),
          note:        newCost.note.trim() || null,
        },
      }),
    });
    setCostSaving(false);
    if (!res.ok) { toast.error("Lỗi thêm chi phí"); return; }
    const data = await res.json();
    setOrder(data);
    setNewCost({ type: "packaging", description: "", amountVnd: "", note: "" });
    setShowAddCost(false);
    toast.success("Đã thêm chi phí");
  }

  async function handleDeleteCost(costId: string) {
    if (!confirm("Xóa dòng chi phí này?")) return;
    setCostSaving(true);
    const res = await fetch(`/api/production/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deleteCostId: costId }),
    });
    setCostSaving(false);
    if (!res.ok) { toast.error("Lỗi xóa chi phí"); return; }
    const data = await res.json();
    setOrder(data);
    toast.success("Đã xóa");
  }

  function startEditCost(cost: ProductionCost) {
    setEditingCostId(cost.id);
    setEditCost({ description: cost.description, amountVnd: String(cost.amountVnd), note: cost.note ?? "" });
  }

  async function handleUpdateCost(costId: string) {
    if (!editCost.description.trim() || !editCost.amountVnd) {
      toast.error("Vui lòng nhập mô tả và số tiền");
      return;
    }
    setCostSaving(true);
    const res = await fetch(`/api/production/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        updateCost: {
          id:          costId,
          description: editCost.description.trim(),
          amountVnd:   Number(editCost.amountVnd),
          note:        editCost.note.trim() || null,
        },
      }),
    });
    setCostSaving(false);
    if (!res.ok) { toast.error("Lỗi cập nhật chi phí"); return; }
    const data = await res.json();
    setOrder(data);
    setEditingCostId(null);
    toast.success("Đã cập nhật");
  }

  if (loading || !order) return <div className="text-sm text-gray-400">Đang tải...</div>;

  const isDone = order.status === "done";

  const totals = order.items.map((item) => {
    const s = itemStates[item.id];
    const planned = calcPlanned(
      item.purchaseItem.quantity,
      item.product.unit,
      s?.gramsPerPack ?? "",
      s?.piecesPerUnit ?? "",
      s?.piecesPerPack ?? "",
    ) ?? item.plannedQty;
    const actual = s?.actualQty !== "" ? Number(s?.actualQty) : null;
    return { planned, actual };
  });

  const totalPlanned   = totals.reduce((s, t) => s + t.planned, 0);
  const totalActual    = totals.reduce((s, t) => s + (t.actual ?? 0), 0);
  const confirmedCount = totals.filter((t) => t.actual != null).length;
  const allConfirmed   = confirmedCount === order.items.length && order.items.length > 0;

  // Cost calculations
  const totalCost    = (order.costs ?? []).reduce((s, c) => s + c.amountVnd, 0);
  const costPerUnit  = totalActual > 0 ? Math.round(totalCost / totalActual) : null;

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.push("/production")} className="text-gray-400 hover:text-gray-600">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <Factory className="h-6 w-6 text-orange-600" />
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-gray-900">{order.code}</h1>
            <Badge className={STATUS_COLORS[order.status]}>{STATUS_LABELS[order.status]}</Badge>
          </div>
          <p className="text-sm text-gray-500">
            Từ đơn mua <span className="font-mono">{order.purchaseOrder.code}</span>
            {" — "}{order.purchaseOrder.supplier.name}
            {order.purchaseOrder.arrivedDate && ` · Nhận: ${formatDate(order.purchaseOrder.arrivedDate)}`}
          </p>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-4 gap-3">
        <Card className="p-4 text-center">
          <div className="text-2xl font-bold text-gray-800">{order.items.length}</div>
          <div className="text-xs text-gray-500 mt-1">Loại SP</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-2xl font-bold text-blue-700">{totalPlanned}</div>
          <div className="text-xs text-gray-500 mt-1">Gói dự kiến</div>
        </Card>
        <Card className={`p-4 text-center ${isDone ? "bg-green-50" : ""}`}>
          <div className={`text-2xl font-bold ${isDone ? "text-green-700" : totalActual > 0 ? "text-orange-600" : "text-gray-300"}`}>
            {totalActual || "—"}
          </div>
          <div className="text-xs text-gray-500 mt-1">Gói thực tế</div>
        </Card>
        <Card className={`p-4 text-center ${costPerUnit ? "bg-amber-50" : ""}`}>
          <div className={`text-lg font-bold ${costPerUnit ? "text-amber-700" : "text-gray-300"}`}>
            {costPerUnit ? formatVND(costPerUnit) : "—"}
          </div>
          <div className="text-xs text-gray-500 mt-1">Giá vốn/gói</div>
        </Card>
      </div>

      {/* Items */}
      <Card className="p-5">
        <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <PackageCheck className="h-4 w-4 text-orange-600" />
          Danh sách sản phẩm
        </h2>
        <div className="space-y-6">
          {order.items.map((item) => {
            const s = itemStates[item.id] ?? {
              actualQty: "", wasteNote: "", gramsPerPack: "", piecesPerUnit: "", piecesPerPack: "",
            };
            const planned = calcPlanned(
              item.purchaseItem.quantity,
              item.product.unit,
              s.gramsPerPack,
              s.piecesPerUnit,
              s.piecesPerPack,
            );
            const actual = s.actualQty !== "" ? Number(s.actualQty) : null;
            const waste  = actual != null && planned != null ? planned - actual : null;
            const isCountMode = Number(s.piecesPerUnit) > 0 || Number(s.piecesPerPack) > 0;

            return (
              <div key={item.id} className="border border-gray-100 rounded-lg p-4 space-y-4">
                {/* Product header */}
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-semibold text-gray-800">
                      {item.product.nameVi ?? item.product.name}
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      {item.product.name}
                      {item.product.skuShopify && ` · ${item.product.skuShopify}`}
                    </div>
                  </div>
                  {actual != null && <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />}
                </div>

                {/* Packing config */}
                {!isDone && (
                  <div className="rounded-lg bg-orange-50 border border-orange-100 p-3 space-y-3">
                    <p className="text-xs font-semibold text-orange-700">
                      Cấu hình đóng gói
                      <span className="font-normal text-orange-500 ml-1">
                        (mua: {item.purchaseItem.quantity} {item.product.unit})
                      </span>
                    </p>
                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <Label className="text-xs text-gray-500">Gram / gói</Label>
                        <Input
                          type="number" min={0} placeholder="VD: 200"
                          value={s.gramsPerPack} disabled={isCountMode}
                          onChange={(e) => setField(item.id, "gramsPerPack", e.target.value)}
                          className="h-8 mt-1 text-sm"
                        />
                      </div>
                      <div className="pt-5 text-gray-300 text-sm">hoặc</div>
                      <div className="flex-1">
                        <Label className="text-xs text-gray-500">Hạt / {item.product.unit} mua</Label>
                        <Input
                          type="number" min={0} placeholder="VD: 1000"
                          value={s.piecesPerUnit}
                          disabled={!!s.gramsPerPack && !isCountMode}
                          onChange={(e) => setField(item.id, "piecesPerUnit", e.target.value)}
                          className="h-8 mt-1 text-sm"
                        />
                      </div>
                      <div className="pt-5 text-gray-400 text-xs">÷</div>
                      <div className="flex-1">
                        <Label className="text-xs text-gray-500">Hạt / gói bán</Label>
                        <Input
                          type="number" min={0} placeholder="VD: 150"
                          value={s.piecesPerPack}
                          disabled={!!s.gramsPerPack && !isCountMode}
                          onChange={(e) => setField(item.id, "piecesPerPack", e.target.value)}
                          className="h-8 mt-1 text-sm"
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-sm font-medium">
                      {isCountMode && Number(s.piecesPerUnit) > 0 && Number(s.piecesPerPack) > 0 ? (
                        <span className="text-gray-600">
                          {item.purchaseItem.quantity} {item.product.unit}
                          {" × "}<span className="text-orange-700">{s.piecesPerUnit}</span> hạt/{item.product.unit}
                          {" ÷ "}<span className="text-orange-700">{s.piecesPerPack}</span> hạt/gói
                          {" = "}
                          <span className="text-blue-700 text-base font-bold">{planned ?? "..."} gói</span>
                        </span>
                      ) : s.gramsPerPack && Number(s.gramsPerPack) > 0 ? (
                        <span className="text-gray-600">
                          {item.purchaseItem.quantity} {item.product.unit}
                          {" ÷ "}<span className="text-orange-700">{s.gramsPerPack}g</span>/gói
                          {" = "}
                          <span className="text-blue-700 text-base font-bold">{planned ?? "..."} gói</span>
                        </span>
                      ) : (
                        <span className="text-gray-400 text-xs">Nhập gram/gói hoặc số hạt để tính tự động</span>
                      )}
                    </div>
                  </div>
                )}

                {/* Done mode: show formula summary */}
                {isDone && (
                  <div className="text-sm text-gray-500 bg-gray-50 rounded p-2">
                    {item.piecesPerUnit && item.piecesPerPack ? (
                      <span>
                        {item.purchaseItem.quantity} {item.product.unit}
                        {" × "}{item.piecesPerUnit} hạt/{item.product.unit}
                        {" ÷ "}{item.piecesPerPack} hạt/gói
                        {" = "}<strong className="text-blue-700">{item.plannedQty} gói</strong>
                      </span>
                    ) : item.gramsPerPack ? (
                      <span>
                        {item.purchaseItem.quantity} {item.product.unit}
                        {" ÷ "}{item.gramsPerPack}g/gói
                        {" = "}<strong className="text-blue-700">{item.plannedQty} gói</strong>
                      </span>
                    ) : (
                      <span>Dự kiến: <strong className="text-blue-700">{item.plannedQty} gói</strong></span>
                    )}
                  </div>
                )}

                {/* Actual qty */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-gray-500">
                      Số gói thực tế
                      {planned != null && <span className="text-gray-400 ml-1">(dự kiến: {planned})</span>}
                    </Label>
                    <Input
                      type="number" min={0}
                      placeholder={planned != null ? String(planned) : "Nhập..."}
                      value={s.actualQty} disabled={isDone}
                      onChange={(e) => setField(item.id, "actualQty", e.target.value)}
                      className="mt-1 h-9"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">Ghi chú hao hụt</Label>
                    <Input
                      type="text" placeholder="VD: Vỡ túi, đo sai..."
                      value={s.wasteNote} disabled={isDone}
                      onChange={(e) => setField(item.id, "wasteNote", e.target.value)}
                      className="mt-1 h-9"
                    />
                  </div>
                </div>

                {waste != null && (
                  <div className={`text-sm font-semibold flex items-center gap-1.5 ${
                    waste > 0 ? "text-red-600" : "text-green-600"
                  }`}>
                    {waste > 0 ? (
                      <><AlertTriangle className="h-3.5 w-3.5" />Hao hụt {waste} gói ({Math.round(waste / (planned ?? 1) * 100)}%)</>
                    ) : waste < 0 ? (
                      <><CheckCircle2 className="h-3.5 w-3.5" />Hơn kế hoạch {Math.abs(waste)} gói</>
                    ) : (
                      <><CheckCircle2 className="h-3.5 w-3.5" />Đúng kế hoạch</>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {/* Cost analysis */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-800 flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-amber-600" />
            Chi phí lô sản xuất
          </h2>
          {!showAddCost && (
            <Button
              size="sm" variant="outline"
              className="h-7 text-xs text-amber-700 border-amber-300 hover:bg-amber-50"
              onClick={() => setShowAddCost(true)}
            >
              <Plus className="h-3 w-3 mr-1" />
              Thêm chi phí
            </Button>
          )}
        </div>

        {/* Cost rows */}
        <div className="space-y-2">
          {(order.costs ?? []).length === 0 && !showAddCost && (
            <p className="text-xs text-gray-400 text-center py-3">Chưa có chi phí nào. Thêm bao bì, nhân công, ship...</p>
          )}
          {(order.costs ?? []).map((cost) => (
            <div key={cost.id} className="rounded-lg border border-gray-100 bg-gray-50">
              {editingCostId === cost.id ? (
                /* Inline edit */
                <div className="p-3 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs text-gray-500">Mô tả</Label>
                      <Input
                        value={editCost.description}
                        onChange={(e) => setEditCost((p) => ({ ...p, description: e.target.value }))}
                        className="h-8 mt-1 text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500">Số tiền (VND)</Label>
                      <Input
                        type="number" min={0}
                        value={editCost.amountVnd}
                        onChange={(e) => setEditCost((p) => ({ ...p, amountVnd: e.target.value }))}
                        className="h-8 mt-1 text-sm"
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">Ghi chú (tuỳ chọn)</Label>
                    <Input
                      value={editCost.note}
                      onChange={(e) => setEditCost((p) => ({ ...p, note: e.target.value }))}
                      placeholder="Ghi chú thêm..."
                      className="h-8 mt-1 text-sm"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm" className="h-7 text-xs bg-amber-600 hover:bg-amber-700 text-white"
                      onClick={() => handleUpdateCost(cost.id)} disabled={costSaving}
                    >
                      Lưu
                    </Button>
                    <Button
                      size="sm" variant="ghost" className="h-7 text-xs"
                      onClick={() => setEditingCostId(null)}
                    >
                      Huỷ
                    </Button>
                  </div>
                </div>
              ) : (
                /* Display row */
                <div className="flex items-center gap-3 px-3 py-2.5">
                  <Badge className={`text-xs shrink-0 ${COST_TYPE_COLORS[cost.type] ?? "bg-gray-100 text-gray-600"}`}>
                    {COST_TYPE_LABELS[cost.type] ?? cost.type}
                  </Badge>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-800 truncate">{cost.description}</p>
                    {cost.note && <p className="text-xs text-gray-400 truncate">{cost.note}</p>}
                  </div>
                  <span className="text-sm font-semibold text-gray-800 shrink-0">{formatVND(cost.amountVnd)}</span>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => startEditCost(cost)}
                      className="p-1 text-gray-400 hover:text-amber-600 rounded"
                      title="Sửa"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteCost(cost.id)}
                      disabled={costSaving}
                      className="p-1 text-gray-400 hover:text-red-500 rounded"
                      title="Xóa"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Add cost form */}
        {showAddCost && (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-3">
            <p className="text-xs font-semibold text-amber-700">Thêm chi phí mới</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs text-gray-500">Loại chi phí</Label>
                <select
                  value={newCost.type}
                  onChange={(e) => setNewCost((p) => ({ ...p, type: e.target.value }))}
                  className="mt-1 h-8 w-full rounded-md border border-input bg-white px-2 text-sm"
                >
                  <option value="packaging">Bao bì</option>
                  <option value="labor">Nhân công</option>
                  <option value="shipping">Phí ship</option>
                  <option value="material">Nguyên liệu</option>
                  <option value="other">Khác</option>
                </select>
              </div>
              <div>
                <Label className="text-xs text-gray-500">Số tiền (VND)</Label>
                <Input
                  type="number" min={0} placeholder="VD: 500000"
                  value={newCost.amountVnd}
                  onChange={(e) => setNewCost((p) => ({ ...p, amountVnd: e.target.value }))}
                  className="h-8 mt-1 text-sm"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs text-gray-500">Mô tả</Label>
              <Input
                placeholder="VD: Túi zip 8x12cm, 500 cái"
                value={newCost.description}
                onChange={(e) => setNewCost((p) => ({ ...p, description: e.target.value }))}
                className="h-8 mt-1 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs text-gray-500">Ghi chú (tuỳ chọn)</Label>
              <Input
                placeholder="Ghi chú thêm..."
                value={newCost.note}
                onChange={(e) => setNewCost((p) => ({ ...p, note: e.target.value }))}
                className="h-8 mt-1 text-sm"
              />
            </div>
            <div className="flex gap-2">
              <Button
                size="sm" className="h-7 text-xs bg-amber-600 hover:bg-amber-700 text-white"
                onClick={handleAddCost} disabled={costSaving}
              >
                {costSaving ? "Đang lưu..." : "Thêm"}
              </Button>
              <Button
                size="sm" variant="ghost" className="h-7 text-xs"
                onClick={() => { setShowAddCost(false); setNewCost({ type: "packaging", description: "", amountVnd: "", note: "" }); }}
              >
                <X className="h-3 w-3 mr-1" />
                Huỷ
              </Button>
            </div>
          </div>
        )}

        {/* Cost totals */}
        {(order.costs ?? []).length > 0 && (
          <div className="mt-4 pt-3 border-t border-gray-200 space-y-1.5">
            {/* Breakdown by type */}
            {(["material", "packaging", "labor", "shipping", "other"] as const).map((type) => {
              const typeTotal = (order.costs ?? []).filter((c) => c.type === type).reduce((s, c) => s + c.amountVnd, 0);
              if (!typeTotal) return null;
              return (
                <div key={type} className="flex items-center justify-between text-xs text-gray-500">
                  <span>{COST_TYPE_LABELS[type]}</span>
                  <span>{formatVND(typeTotal)}</span>
                </div>
              );
            })}
            <div className="flex items-center justify-between pt-2 border-t border-gray-100">
              <span className="text-sm font-semibold text-gray-800">Tổng chi phí</span>
              <span className="text-sm font-bold text-amber-700">{formatVND(totalCost)}</span>
            </div>

            {/* Per-product cost allocation */}
            {order.items.length > 1 && totalCost > 0 && (() => {
              const totalMaterialBase = order.items.reduce((s, item) => s + item.purchaseItem.subtotalVnd, 0);
              if (totalMaterialBase === 0) return null;
              return (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <p className="text-xs font-semibold text-gray-500 mb-2">Giá vốn / sản phẩm (phân bổ theo tỷ lệ nguyên liệu)</p>
                  <div className="space-y-1.5">
                    {order.items.map((item) => {
                      const ratio = item.purchaseItem.subtotalVnd / totalMaterialBase;
                      const allocated = Math.round(totalCost * ratio);
                      const actual = itemStates[item.id]?.actualQty !== ""
                        ? Number(itemStates[item.id]?.actualQty)
                        : item.actualQty;
                      const cpp = actual ? Math.round(allocated / actual) : null;
                      return (
                        <div key={item.id} className="flex items-center justify-between text-xs">
                          <span className="text-gray-600 truncate max-w-[180px]">
                            {item.product.nameVi ?? item.product.name}
                          </span>
                          <div className="flex items-center gap-3 shrink-0">
                            <span className="text-gray-400">{formatVND(allocated)}</span>
                            {cpp ? (
                              <span className="font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">
                                {formatVND(cpp)}/gói
                              </span>
                            ) : (
                              <span className="text-gray-300">—/gói</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {/* Single-product cost per pack */}
            {(order.items.length === 1 || totalCost > 0) && costPerUnit && (
              <div className="flex items-center justify-between rounded-lg bg-amber-50 px-3 py-2 mt-1">
                <span className="text-sm font-semibold text-amber-800">
                  {order.items.length === 1
                    ? `Giá vốn / gói · ${order.items[0].product.nameVi ?? order.items[0].product.name}`
                    : "Giá vốn trung bình / gói"}
                </span>
                <span className="text-base font-bold text-amber-700">{formatVND(costPerUnit)}</span>
              </div>
            )}
            {!costPerUnit && totalActual === 0 && (
              <p className="text-xs text-gray-400 text-center pt-1">
                Nhập số gói thực tế để xem giá vốn/gói
              </p>
            )}
          </div>
        )}
      </Card>

      {/* Notes */}
      <Card className="p-5">
        <Label className="text-xs text-gray-500 font-semibold">Ghi chú lô sản xuất</Label>
        <Input
          type="text" placeholder="Ghi chú thêm..."
          value={notes} disabled={isDone}
          onChange={(e) => setNotes(e.target.value)}
          className="mt-2 h-9"
        />
      </Card>

      {/* Result summary (when done) */}
      {isDone && (
        <Card className="p-5 border-green-200 bg-green-50">
          <h2 className="font-semibold text-green-800 mb-3 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" />
            Kết quả lô sản xuất
          </h2>
          <div className="space-y-2">
            {order.items.map((item) => item.actualQty != null && (
              <div key={item.id} className="flex items-center justify-between text-sm">
                <span className="text-gray-700">{item.product.nameVi ?? item.product.name}</span>
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-green-800">{item.actualQty} gói</span>
                  {item.product.skuShopify && (
                    <span className="text-xs text-gray-400 font-mono">{item.product.skuShopify}</span>
                  )}
                  {item.actualQty < item.plannedQty && (
                    <span className="text-xs text-red-500">hao {item.plannedQty - item.actualQty}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 pt-3 border-t border-green-200 flex items-center justify-between text-sm font-semibold">
            <span className="text-green-800">Tổng cộng</span>
            <span className="text-green-800">{totalActual} gói sẵn sàng ship</span>
          </div>
          {totalCost > 0 && (
            <div className="mt-3 pt-3 border-t border-green-200 space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="text-green-700">Tổng chi phí lô</span>
                <span className="font-semibold text-green-800">{formatVND(totalCost)}</span>
              </div>
              {costPerUnit && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-green-700">Giá vốn / gói</span>
                  <span className="font-bold text-amber-700 text-base">{formatVND(costPerUnit)}</span>
                </div>
              )}
            </div>
          )}
          {order.completedAt && (
            <p className="text-xs text-gray-400 mt-2">Hoàn tất: {formatDate(order.completedAt)}</p>
          )}
        </Card>
      )}

      {/* Action buttons */}
      {!isDone && (
        <div className="flex items-center gap-3 pt-2 flex-wrap">
          {order.status === "pending" && (
            <Button onClick={handleStart} disabled={saving} variant="outline" className="text-blue-700 border-blue-300 hover:bg-blue-50">
              Bắt đầu sản xuất
            </Button>
          )}
          {order.status === "in_production" && (
            <>
              <Button onClick={handleSave} disabled={saving} variant="outline">
                {saving ? "Đang lưu..." : "Lưu tạm"}
              </Button>
              <Button
                onClick={handleComplete}
                disabled={saving || !allConfirmed}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                {saving ? "Đang lưu..." : "Xác nhận hoàn tất"}
              </Button>
              {!allConfirmed && (
                <span className="text-xs text-gray-400">
                  Còn {order.items.length - confirmedCount} mục chưa nhập thực tế
                </span>
              )}
            </>
          )}
          <Button
            onClick={handleDelete}
            variant="outline" disabled={saving}
            className="ml-auto text-red-500 border-red-200 hover:bg-red-50"
          >
            Xóa lệnh
          </Button>
        </div>
      )}
    </div>
  );
}
