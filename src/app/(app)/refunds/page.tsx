"use client";
import { useEffect, useState, useMemo } from "react";
import { RotateCcw, Plus, X, AlertCircle } from "lucide-react";

interface SalesRefund {
  id: string;
  source: string;
  shopifyOrderId: string | null;
  orderName: string | null;
  amountUsd: number;
  reason: string | null;
  refundedAt: string;
  notes: string | null;
  createdAt: string;
}

interface RefundData {
  refunds: SalesRefund[];
  totalUsd: number;
  byMonth: Record<string, number>;
}

const REASON_OPTIONS = [
  "Item not as described",
  "Damaged / defective",
  "Wrong item shipped",
  "Customer changed mind",
  "Lost in transit",
  "Duplicate order",
  "Other",
];

function fmtUsd(v: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(v);
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("vi-VN");
}

// ─── Add Refund Modal ─────────────────────────────────────────────────────────

function AddRefundModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    orderName: "",
    shopifyOrderId: "",
    amountUsd: "",
    reason: "",
    refundedAt: new Date().toISOString().split("T")[0],
    notes: "",
    source: "manual",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.amountUsd || Number(form.amountUsd) <= 0) {
      setError("Số tiền phải lớn hơn 0");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/refunds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          amountUsd: Number(form.amountUsd),
        }),
      });
      if (!res.ok) throw new Error("Lỗi lưu dữ liệu");
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi không xác định");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="font-semibold text-gray-900">Thêm hoàn trả</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Mã đơn hàng</label>
              <input
                type="text"
                placeholder="#1234"
                value={form.orderName}
                onChange={e => setForm(f => ({ ...f, orderName: e.target.value }))}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Số tiền (USD) <span className="text-red-500">*</span></label>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                placeholder="0.00"
                value={form.amountUsd}
                onChange={e => setForm(f => ({ ...f, amountUsd: e.target.value }))}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Ngày hoàn trả <span className="text-red-500">*</span></label>
              <input
                type="date"
                required
                value={form.refundedAt}
                onChange={e => setForm(f => ({ ...f, refundedAt: e.target.value }))}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Nguồn</label>
              <select
                value={form.source}
                onChange={e => setForm(f => ({ ...f, source: e.target.value }))}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="manual">Thủ công</option>
                <option value="shopify">Shopify</option>
                <option value="tiktok">TikTok</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Lý do</label>
            <select
              value={form.reason}
              onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">-- Chọn lý do --</option>
              {REASON_OPTIONS.map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Ghi chú</label>
            <textarea
              rows={2}
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="Ghi chú thêm..."
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-gray-900 px-4 py-2 text-sm text-white hover:bg-gray-700 disabled:opacity-60"
            >
              {saving ? "Đang lưu..." : "Lưu"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function RefundsPage() {
  const [data, setData] = useState<RefundData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState("");

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/refunds");
      const json = await res.json();
      setData(json);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    if (!data) return [];
    if (!search.trim()) return data.refunds;
    const q = search.toLowerCase();
    return data.refunds.filter(r =>
      r.orderName?.toLowerCase().includes(q) ||
      r.reason?.toLowerCase().includes(q) ||
      r.notes?.toLowerCase().includes(q) ||
      r.source.toLowerCase().includes(q)
    );
  }, [data, search]);

  // Monthly breakdown sorted descending
  const monthlyEntries = useMemo(() => {
    if (!data) return [];
    return Object.entries(data.byMonth).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 6);
  }, [data]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-gray-400 text-sm">
        Đang tải...
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <RotateCcw className="h-5 w-5 text-red-500" />
            Hoàn trả (Refunds)
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Theo dõi các đơn hàng bị hoàn tiền</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-1.5 rounded-lg bg-gray-900 px-3 py-2 text-sm text-white hover:bg-gray-700"
        >
          <Plus className="h-3.5 w-3.5" />
          Thêm hoàn trả
        </button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-xs text-gray-500 mb-1">Tổng hoàn trả</p>
          <p className="text-2xl font-bold text-red-600">{fmtUsd(data?.totalUsd ?? 0)}</p>
          <p className="text-xs text-gray-400 mt-1">{data?.refunds.length ?? 0} lần hoàn trả</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-xs text-gray-500 mb-1">Tháng này</p>
          {(() => {
            const thisMonth = new Date().toLocaleDateString("vi-VN", { year: "numeric", month: "2-digit" });
            const amount = data?.byMonth[thisMonth] ?? 0;
            return (
              <>
                <p className="text-2xl font-bold text-gray-900">{fmtUsd(amount)}</p>
                <p className="text-xs text-gray-400 mt-1">{thisMonth}</p>
              </>
            );
          })()}
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-xs text-gray-500 mb-1">Trung bình / lần</p>
          <p className="text-2xl font-bold text-gray-900">
            {fmtUsd((data?.refunds.length ?? 0) > 0 ? (data?.totalUsd ?? 0) / (data?.refunds.length ?? 1) : 0)}
          </p>
          <p className="text-xs text-gray-400 mt-1">per refund</p>
        </div>
      </div>

      {/* Monthly breakdown */}
      {monthlyEntries.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Theo tháng (6 tháng gần nhất)</h2>
          <div className="grid grid-cols-6 gap-2">
            {monthlyEntries.map(([month, amount]) => (
              <div key={month} className="text-center">
                <div className="text-xs font-medium text-red-600">{fmtUsd(amount)}</div>
                <div className="text-[10px] text-gray-400 mt-0.5">{month}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Table */}
      <div className="rounded-xl border border-gray-200 bg-white">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700 flex-1">Chi tiết</h2>
          <input
            type="text"
            placeholder="Tìm kiếm..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-48"
          />
        </div>

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <RotateCcw className="h-8 w-8 mb-2 opacity-30" />
            <p className="text-sm">Chưa có dữ liệu hoàn trả</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500">Ngày</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500">Đơn hàng</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500">Nguồn</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500">Lý do</th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500">Số tiền</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500">Ghi chú</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(r => (
                <tr key={r.id} className="hover:bg-gray-50/50">
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{fmtDate(r.refundedAt)}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">{r.orderName ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      r.source === "shopify" ? "bg-green-100 text-green-700" :
                      r.source === "tiktok" ? "bg-pink-100 text-pink-700" :
                      "bg-gray-100 text-gray-600"
                    }`}>
                      {r.source}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{r.reason ?? "—"}</td>
                  <td className="px-4 py-3 text-right font-semibold text-red-600">{fmtUsd(r.amountUsd)}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs max-w-[160px] truncate">{r.notes ?? "—"}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-gray-200 bg-gray-50">
                <td colSpan={4} className="px-4 py-2.5 text-xs font-semibold text-gray-600">
                  Tổng ({filtered.length} mục)
                </td>
                <td className="px-4 py-2.5 text-right text-sm font-bold text-red-600">
                  {fmtUsd(filtered.reduce((s, r) => s + r.amountUsd, 0))}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        )}
      </div>

      {showModal && (
        <AddRefundModal onClose={() => setShowModal(false)} onSaved={load} />
      )}
    </div>
  );
}
