"use client";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Bot, CheckCircle2, AlertTriangle, Zap, RefreshCw,
  Database, ShoppingCart, TrendingUp, Package, DollarSign,
} from "lucide-react";

interface AgentStatus {
  shopifyConnected: boolean;
  productCount: number;
  pendingFulfillments: number;
  nhungZero: number;
  warnings: string[];
  availableActions: { action: string; description: string; options?: string }[];
}

interface AgentResult {
  action: string;
  ok: boolean;
  summary: string;
  details?: unknown;
  errors?: string[];
  timestamp: string;
}

interface MismatchItem {
  productId: string;
  nameVi: string | null;
  name: string;
  skuShopify: string;
  nhungQty: number;
  brosQty: number;
  expectedShopify: number;
  actualShopify: number;
  diff: number;
}

const ACTION_META: Record<string, { label: string; icon: React.ReactNode; color: string; desc: string }> = {
  check: {
    label: "Kiểm tra sai lệch",
    icon: <CheckCircle2 className="h-4 w-4" />,
    color: "bg-blue-600 hover:bg-blue-700",
    desc: "So sánh nhungQty + brosQty với Shopify inventory, báo cáo các sản phẩm bị lệch",
  },
  fix_inventory: {
    label: "Đồng bộ tất cả inventory",
    icon: <Zap className="h-4 w-4" />,
    color: "bg-green-600 hover:bg-green-700",
    desc: "Đẩy nhungQty + brosQty lên Shopify cho toàn bộ sản phẩm",
  },
  init_nhung: {
    label: "Khởi tạo Kho Nhung từ Shopify",
    icon: <Database className="h-4 w-4" />,
    color: "bg-orange-600 hover:bg-orange-700",
    desc: "Copy số lượng Shopify hiện tại → nhungQty (chỉ set cho sản phẩm đang = 0)",
  },
  push_all_sheets: {
    label: "Sync tất cả Google Sheets",
    icon: <RefreshCw className="h-4 w-4" />,
    color: "bg-purple-600 hover:bg-purple-700",
    desc: "Kích hoạt sync toàn bộ tabs: Sản phẩm, Kho Nhung, FBM, Sản xuất...",
  },
};

export default function AgentPage() {
  const [status, setStatus] = useState<AgentStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<AgentResult | null>(null);
  const [mismatches, setMismatches] = useState<MismatchItem[]>([]);

  async function loadStatus() {
    setLoading(true);
    try {
      const res = await fetch("/api/agent/sync");
      if (res.ok) setStatus(await res.json());
    } catch { /* ignore */ } finally { setLoading(false); }
  }

  useEffect(() => { loadStatus(); }, []);

  async function runAction(action: string, options?: Record<string, unknown>) {
    setRunning(action);
    setLastResult(null);
    setMismatches([]);
    try {
      const res = await fetch("/api/agent/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, options }),
      });
      const data: AgentResult = await res.json();
      setLastResult(data);
      if (action === "check" && data.details) {
        const d = data.details as { mismatches?: MismatchItem[] };
        setMismatches(d.mismatches ?? []);
      }
      if (data.ok) toast.success(data.summary);
      else toast.error(data.summary);
      await loadStatus();
    } catch { toast.error("Lỗi kết nối"); } finally { setRunning(null); }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Bot className="h-6 w-6 text-green-600" />
            Agent Control Panel
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Tự động phát hiện & sửa sai lệch giữa app và Shopify
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={loadStatus} disabled={loading}>
          <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
          Làm mới
        </Button>
      </div>

      {/* Status cards */}
      {status && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <ShoppingCart className="h-4 w-4 text-green-600" />
              <span className="text-xs text-gray-500">Shopify</span>
            </div>
            <div className={`text-sm font-semibold ${status.shopifyConnected ? "text-green-700" : "text-red-600"}`}>
              {status.shopifyConnected ? "✓ Đã kết nối" : "✗ Chưa kết nối"}
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Package className="h-4 w-4 text-blue-600" />
              <span className="text-xs text-gray-500">Sản phẩm</span>
            </div>
            <div className="text-lg font-bold text-gray-900">{status.productCount}</div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="h-4 w-4 text-orange-600" />
              <span className="text-xs text-gray-500">Đơn chờ</span>
            </div>
            <div className="text-lg font-bold text-gray-900">{status.pendingFulfillments}</div>
          </Card>
          <Card className={`p-4 ${status.nhungZero > 0 ? "border-orange-300 bg-orange-50" : ""}`}>
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className={`h-4 w-4 ${status.nhungZero > 0 ? "text-orange-500" : "text-gray-400"}`} />
              <span className="text-xs text-gray-500">Chưa khởi tạo</span>
            </div>
            <div className={`text-lg font-bold ${status.nhungZero > 0 ? "text-orange-700" : "text-gray-400"}`}>
              {status.nhungZero}
            </div>
          </Card>
        </div>
      )}

      {/* Warnings */}
      {status?.warnings && status.warnings.length > 0 && (
        <div className="space-y-2">
          {status.warnings.map((w, i) => (
            <div key={i} className="flex items-start gap-2 rounded-lg border border-orange-200 bg-orange-50 px-4 py-3">
              <AlertTriangle className="h-4 w-4 text-orange-500 mt-0.5 shrink-0" />
              <span className="text-sm text-orange-800">{w}</span>
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="grid gap-4 sm:grid-cols-2">
        {Object.entries(ACTION_META).map(([action, meta]) => (
          <Card key={action} className="p-4 space-y-3">
            <div>
              <div className="font-medium text-gray-900 text-sm">{meta.label}</div>
              <div className="text-xs text-gray-500 mt-0.5">{meta.desc}</div>
            </div>
            <Button
              size="sm"
              className={`text-white ${meta.color} gap-1.5`}
              disabled={!status?.shopifyConnected || running !== null}
              onClick={() => {
                if (action === "init_nhung" && status && status.nhungZero === 0) {
                  if (!confirm("Tất cả sản phẩm đã có nhungQty. Dùng force=true để ghi đè tất cả?")) return;
                  runAction(action, { force: true });
                } else {
                  runAction(action);
                }
              }}
            >
              {running === action
                ? <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                : meta.icon}
              {running === action ? "Đang chạy..." : meta.label}
            </Button>
          </Card>
        ))}
      </div>

      {/* Last result */}
      {lastResult && (
        <Card className={`p-4 space-y-2 border-l-4 ${lastResult.ok ? "border-green-500" : "border-red-500"}`}>
          <div className="flex items-center gap-2">
            {lastResult.ok
              ? <CheckCircle2 className="h-4 w-4 text-green-600" />
              : <AlertTriangle className="h-4 w-4 text-red-600" />}
            <span className="font-medium text-sm">{lastResult.summary}</span>
            <span className="text-xs text-gray-400 ml-auto">
              {new Date(lastResult.timestamp).toLocaleTimeString("vi-VN")}
            </span>
          </div>
          {lastResult.errors && lastResult.errors.length > 0 && (
            <div className="text-xs text-red-600 bg-red-50 rounded p-2 space-y-0.5">
              {lastResult.errors.map((e, i) => <div key={i}>• {e}</div>)}
            </div>
          )}
        </Card>
      )}

      {/* Mismatch table */}
      {mismatches.length > 0 && (
        <Card className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm text-gray-900">
              ⚠ {mismatches.length} sản phẩm sai lệch inventory
            </h3>
            <Button
              size="sm"
              className="bg-green-600 hover:bg-green-700 text-white gap-1"
              disabled={running !== null}
              onClick={() => runAction("fix_inventory")}
            >
              <Zap className="h-3.5 w-3.5" />
              Sửa tất cả
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b text-gray-500">
                  <th className="text-left py-2 pr-3 font-medium">Sản phẩm</th>
                  <th className="text-right py-2 pr-3 font-medium">Kho Nhung</th>
                  <th className="text-right py-2 pr-3 font-medium">Kho Bros</th>
                  <th className="text-right py-2 pr-3 font-medium">App tổng</th>
                  <th className="text-right py-2 pr-3 font-medium">Shopify</th>
                  <th className="text-right py-2 font-medium">Lệch</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {mismatches.map((m) => (
                  <tr key={m.productId} className="hover:bg-gray-50">
                    <td className="py-2 pr-3">
                      <div className="font-medium text-gray-900">{m.nameVi ?? m.name}</div>
                      <div className="text-gray-400 font-mono">{m.skuShopify}</div>
                    </td>
                    <td className="text-right py-2 pr-3 text-orange-700">{m.nhungQty}</td>
                    <td className="text-right py-2 pr-3 text-purple-700">{m.brosQty}</td>
                    <td className="text-right py-2 pr-3 font-medium">{m.expectedShopify}</td>
                    <td className="text-right py-2 pr-3 text-blue-700">{m.actualShopify}</td>
                    <td className={`text-right py-2 font-bold ${m.diff > 0 ? "text-green-700" : "text-red-700"}`}>
                      {m.diff > 0 ? "+" : ""}{m.diff}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Bros Fees summary */}
      <BrosFeesSummary />
    </div>
  );
}

function BrosFeesSummary() {
  const [data, setData] = useState<{
    fees: { id: string; type: string; description: string; amountUsd: number; createdAt: string }[];
    summary: { totalUsd: number; byType: Record<string, number> };
  } | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ type: "inbound", description: "", amountUsd: "", note: "" });
  const [saving, setSaving] = useState(false);

  const FEE_TYPES: Record<string, string> = {
    inbound: "Phí nhận hàng",
    storage: "Phí lưu kho",
    fulfillment: "Phí fulfillment",
    return: "Phí hàng trả về",
    other: "Khác",
  };

  async function load() {
    const res = await fetch("/api/bros-fees");
    if (res.ok) setData(await res.json());
  }

  useEffect(() => { load(); }, []);

  async function handleAdd() {
    setSaving(true);
    const res = await fetch("/api/bros-fees", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, amountUsd: Number(form.amountUsd) }),
    });
    if (res.ok) {
      toast.success("Đã thêm phí");
      setShowForm(false);
      setForm({ type: "inbound", description: "", amountUsd: "", note: "" });
      load();
    } else toast.error("Lỗi khi thêm");
    setSaving(false);
  }

  async function handleDelete(id: string) {
    if (!confirm("Xoá khoản phí này?")) return;
    await fetch(`/api/bros-fees/${id}`, { method: "DELETE" });
    load();
  }

  if (!data) return null;

  return (
    <Card className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <DollarSign className="h-4 w-4 text-purple-600" />
          <h3 className="font-semibold text-sm text-gray-900">Phí kho Bros (US)</h3>
          <Badge className="bg-purple-100 text-purple-700 text-xs">
            ${data.summary.totalUsd.toFixed(2)}
          </Badge>
        </div>
        <Button size="sm" variant="outline" onClick={() => setShowForm(!showForm)}>
          {showForm ? "Đóng" : "+ Thêm phí"}
        </Button>
      </div>

      {/* Summary by type */}
      {Object.keys(data.summary.byType).length > 0 && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(data.summary.byType).map(([type, amt]) => (
            <div key={type} className="rounded-md bg-gray-100 px-2.5 py-1 text-xs">
              <span className="text-gray-500">{FEE_TYPES[type] ?? type}: </span>
              <span className="font-medium text-gray-900">${(amt as number).toFixed(2)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Add form */}
      {showForm && (
        <div className="rounded-lg border border-gray-200 p-3 space-y-3 bg-gray-50">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">Loại phí</label>
              <select
                className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
              >
                {Object.entries(FEE_TYPES).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">Số tiền (USD)</label>
              <input
                type="number" step="0.01"
                className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                placeholder="0.00"
                value={form.amountUsd}
                onChange={(e) => setForm({ ...form, amountUsd: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-600">Mô tả</label>
            <input
              className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
              placeholder="VD: Lô SHP-001 inbound fee"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="outline" onClick={() => setShowForm(false)}>Huỷ</Button>
            <Button size="sm" className="bg-purple-600 hover:bg-purple-700 text-white" onClick={handleAdd} disabled={saving}>
              {saving ? "Đang lưu..." : "Thêm"}
            </Button>
          </div>
        </div>
      )}

      {/* Recent fees */}
      {data.fees.length > 0 && (
        <div className="space-y-1 max-h-48 overflow-y-auto">
          {data.fees.slice(0, 10).map((f) => (
            <div key={f.id} className="flex items-center justify-between rounded-md px-3 py-2 hover:bg-gray-50 text-sm">
              <div>
                <Badge className="text-xs mr-2 bg-purple-100 text-purple-700">{FEE_TYPES[f.type] ?? f.type}</Badge>
                <span className="text-gray-700">{f.description}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-medium text-gray-900">${f.amountUsd.toFixed(2)}</span>
                <button
                  onClick={() => handleDelete(f.id)}
                  className="text-gray-300 hover:text-red-500 text-xs"
                >✕</button>
              </div>
            </div>
          ))}
        </div>
      )}
      {data.fees.length === 0 && (
        <p className="text-sm text-gray-400 text-center py-2">Chưa có phí nào được ghi nhận</p>
      )}
    </Card>
  );
}
