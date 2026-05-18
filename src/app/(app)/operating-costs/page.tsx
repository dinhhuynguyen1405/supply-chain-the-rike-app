"use client";
import { useEffect, useState, useMemo } from "react";
import { Receipt, Plus, X, AlertCircle } from "lucide-react";

interface OperatingCost {
  id: string;
  type: string;
  channel: string | null;
  amountUsd: number | null;
  amountVnd: number | null;
  date: string;
  description: string;
  notes: string | null;
  createdAt: string;
}

interface CostData {
  costs: OperatingCost[];
  totalUsd: number;
  totalVnd: number;
  totalVndEquiv: number;
  byType: Record<string, number>;
  usdToVnd: number;
}

const COST_TYPES: { value: string; label: string }[] = [
  { value: "shopify_fee", label: "Phí Shopify" },
  { value: "tiktok_commission", label: "Hoa hồng TikTok" },
  { value: "ads", label: "Quảng cáo" },
  { value: "shipping_domestic", label: "Ship nội địa (VN)" },
  { value: "packaging", label: "Bao bì & vật tư" },
  { value: "platform_fee", label: "Phí nền tảng khác" },
  { value: "other", label: "Khác" },
];

function typeLabel(type: string) {
  return COST_TYPES.find(t => t.value === type)?.label ?? type;
}

function fmtVnd(v: number) {
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(v);
}

function fmtUsd(v: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(v);
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("vi-VN");
}

// ─── Add Cost Modal ───────────────────────────────────────────────────────────

function AddCostModal({ onClose, onSaved, usdToVnd }: {
  onClose: () => void;
  onSaved: () => void;
  usdToVnd: number;
}) {
  const [form, setForm] = useState({
    type: "shopify_fee",
    channel: "",
    amountUsd: "",
    amountVnd: "",
    date: new Date().toISOString().split("T")[0],
    description: "",
    notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.amountUsd && !form.amountVnd) {
      setError("Nhập ít nhất một trong: USD hoặc VND");
      return;
    }
    if (!form.description.trim()) {
      setError("Mô tả không được để trống");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/operating-costs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          amountUsd: form.amountUsd ? Number(form.amountUsd) : null,
          amountVnd: form.amountVnd ? Number(form.amountVnd) : null,
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

  const preview = useMemo(() => {
    const usd = Number(form.amountUsd) || 0;
    const vnd = Number(form.amountVnd) || 0;
    return usd * usdToVnd + vnd;
  }, [form.amountUsd, form.amountVnd, usdToVnd]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="font-semibold text-gray-900">Thêm chi phí vận hành</h2>
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
              <label className="block text-xs font-medium text-gray-600 mb-1">Loại chi phí <span className="text-red-500">*</span></label>
              <select
                value={form.type}
                onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {COST_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Kênh / Nền tảng</label>
              <input
                type="text"
                placeholder="Shopify, TikTok..."
                value={form.channel}
                onChange={e => setForm(f => ({ ...f, channel: e.target.value }))}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Mô tả <span className="text-red-500">*</span></label>
            <input
              type="text"
              required
              placeholder="VD: Phí đăng ký Shopify tháng 5/2025"
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Số tiền USD</label>
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={form.amountUsd}
                onChange={e => setForm(f => ({ ...f, amountUsd: e.target.value }))}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Số tiền VND</label>
              <input
                type="number"
                step="1000"
                min="0"
                placeholder="0"
                value={form.amountVnd}
                onChange={e => setForm(f => ({ ...f, amountVnd: e.target.value }))}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {preview > 0 && (
            <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
              Tương đương: <span className="font-semibold text-gray-800">{fmtVnd(preview)}</span>
              <span className="text-gray-400"> (tỷ giá {usdToVnd.toLocaleString()})</span>
            </p>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Ngày <span className="text-red-500">*</span></label>
            <input
              type="date"
              required
              value={form.date}
              onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
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

// ─── Type badge colors ─────────────────────────────────────────────────────────

function typeBadge(type: string) {
  const colors: Record<string, string> = {
    shopify_fee: "bg-green-100 text-green-700",
    tiktok_commission: "bg-pink-100 text-pink-700",
    ads: "bg-blue-100 text-blue-700",
    shipping_domestic: "bg-orange-100 text-orange-700",
    packaging: "bg-purple-100 text-purple-700",
    platform_fee: "bg-yellow-100 text-yellow-700",
    other: "bg-gray-100 text-gray-600",
  };
  return colors[type] ?? "bg-gray-100 text-gray-600";
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OperatingCostsPage() {
  const [data, setData] = useState<CostData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/operating-costs");
      const json = await res.json();
      setData(json);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    if (!data) return [];
    let list = data.costs;
    if (filterType !== "all") list = list.filter(c => c.type === filterType);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(c =>
        c.description.toLowerCase().includes(q) ||
        c.channel?.toLowerCase().includes(q) ||
        c.notes?.toLowerCase().includes(q) ||
        typeLabel(c.type).toLowerCase().includes(q)
      );
    }
    return list;
  }, [data, search, filterType]);

  const filteredTotalVndEquiv = useMemo(() => {
    const rate = data?.usdToVnd ?? 25500;
    return filtered.reduce((s, c) => s + (c.amountUsd ?? 0) * rate + (c.amountVnd ?? 0), 0);
  }, [filtered, data]);

  // By-type breakdown sorted descending
  const byTypeSorted = useMemo(() => {
    if (!data) return [];
    return Object.entries(data.byType).sort((a, b) => b[1] - a[1]);
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
            <Receipt className="h-5 w-5 text-blue-500" />
            Chi phí vận hành
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Phí Shopify, hoa hồng TikTok, quảng cáo, vận chuyển, bao bì...</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-1.5 rounded-lg bg-gray-900 px-3 py-2 text-sm text-white hover:bg-gray-700"
        >
          <Plus className="h-3.5 w-3.5" />
          Thêm chi phí
        </button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-xs text-gray-500 mb-1">Tổng chi phí</p>
          <p className="text-2xl font-bold text-gray-900">{fmtVnd(data?.totalVndEquiv ?? 0)}</p>
          <p className="text-xs text-gray-400 mt-1">{data?.costs.length ?? 0} khoản</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-xs text-gray-500 mb-1">Bằng USD</p>
          <p className="text-2xl font-bold text-gray-900">{fmtUsd(data?.totalUsd ?? 0)}</p>
          <p className="text-xs text-gray-400 mt-1">Chi trả bằng USD</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-xs text-gray-500 mb-1">Bằng VND</p>
          <p className="text-2xl font-bold text-gray-900">{fmtVnd(data?.totalVnd ?? 0)}</p>
          <p className="text-xs text-gray-400 mt-1">Chi trả bằng VND</p>
        </div>
      </div>

      {/* Breakdown by type */}
      {byTypeSorted.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Phân loại chi phí</h2>
          <div className="space-y-2">
            {byTypeSorted.map(([type, vndEquiv]) => {
              const pct = data?.totalVndEquiv ? (vndEquiv / data.totalVndEquiv) * 100 : 0;
              return (
                <div key={type} className="flex items-center gap-3">
                  <span className={`w-28 shrink-0 rounded-full px-2 py-0.5 text-center text-[10px] font-semibold ${typeBadge(type)}`}>
                    {typeLabel(type)}
                  </span>
                  <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-2 bg-blue-400 rounded-full" style={{ width: `${Math.max(pct, 1)}%` }} />
                  </div>
                  <span className="text-xs font-medium text-gray-700 w-32 text-right">{fmtVnd(vndEquiv)}</span>
                  <span className="text-xs text-gray-400 w-10 text-right">{pct.toFixed(0)}%</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Table */}
      <div className="rounded-xl border border-gray-200 bg-white">
        <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700 flex-1">Chi tiết</h2>
          <select
            value={filterType}
            onChange={e => setFilterType(e.target.value)}
            className="rounded-lg border border-gray-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Tất cả loại</option>
            {COST_TYPES.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
          <input
            type="text"
            placeholder="Tìm kiếm..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-44"
          />
        </div>

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <Receipt className="h-8 w-8 mb-2 opacity-30" />
            <p className="text-sm">Chưa có dữ liệu chi phí</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500">Ngày</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500">Loại</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500">Mô tả</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500">Kênh</th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500">USD</th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500">VND</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500">Ghi chú</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(c => (
                <tr key={c.id} className="hover:bg-gray-50/50">
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{fmtDate(c.date)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${typeBadge(c.type)}`}>
                      {typeLabel(c.type)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-900 max-w-[200px] truncate">{c.description}</td>
                  <td className="px-4 py-3 text-gray-500">{c.channel ?? "—"}</td>
                  <td className="px-4 py-3 text-right text-gray-700">
                    {c.amountUsd ? fmtUsd(c.amountUsd) : "—"}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700">
                    {c.amountVnd ? fmtVnd(c.amountVnd) : "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs max-w-[140px] truncate">{c.notes ?? "—"}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-gray-200 bg-gray-50">
                <td colSpan={4} className="px-4 py-2.5 text-xs font-semibold text-gray-600">
                  Tổng ({filtered.length} mục)
                </td>
                <td className="px-4 py-2.5 text-right text-xs font-bold text-gray-700">
                  {fmtUsd(filtered.reduce((s, c) => s + (c.amountUsd ?? 0), 0))}
                </td>
                <td className="px-4 py-2.5 text-right text-xs font-bold text-gray-700">
                  {fmtVnd(filtered.reduce((s, c) => s + (c.amountVnd ?? 0), 0))}
                </td>
                <td />
              </tr>
              <tr className="bg-blue-50">
                <td colSpan={4} className="px-4 py-2 text-xs font-semibold text-blue-700">
                  Tương đương VND (tỷ giá {(data?.usdToVnd ?? 25500).toLocaleString()})
                </td>
                <td colSpan={3} className="px-4 py-2 text-right text-sm font-bold text-blue-700">
                  {fmtVnd(filteredTotalVndEquiv)}
                </td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>

      {showModal && (
        <AddCostModal
          onClose={() => setShowModal(false)}
          onSaved={load}
          usdToVnd={data?.usdToVnd ?? 25500}
        />
      )}
    </div>
  );
}
