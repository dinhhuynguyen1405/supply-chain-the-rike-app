"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { formatDate } from "@/lib/utils";
import { Factory, ChevronRight, AlertCircle } from "lucide-react";

interface Product {
  id: string;
  name: string;
  nameVi: string | null;
  unit: string;
  gramsPerUnit: number | null;
}

interface ProductionItem {
  id: string;
  product: Product;
  plannedQty: number;
  actualQty: number | null;
  piecesPerUnit: number | null;
  piecesPerPack: number | null;
  gramsPerPack: number | null;
}

interface Supplier { name: string }

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
    supplier: Supplier;
  };
  items: ProductionItem[];
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

export default function ProductionPage() {
  const [orders, setOrders] = useState<ProductionOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalOrders, setTotalOrders] = useState(0);

  async function load(p = page) {
    setLoading(true);
    const res = await fetch(`/api/production?page=${p}&limit=20`);
    if (res.ok) {
      const data = await res.json();
      setOrders(data.orders ?? []);
      setTotalPages(data.totalPages ?? 1);
      setTotalOrders(data.total ?? 0);
      setPage(data.page ?? p);
    }
    setLoading(false);
  }

  useEffect(() => { load(page); }, [page]); // eslint-disable-line react-hooks/exhaustive-deps

  const pending       = orders.filter((o) => o.status === "pending");
  const inProduction  = orders.filter((o) => o.status === "in_production");
  const done          = orders.filter((o) => o.status === "done");

  async function startProduction(id: string) {
    const res = await fetch(`/api/production/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "in_production" }),
    });
    if (res.ok) { toast.success("Đã bắt đầu sản xuất"); load(); }
    else toast.error("Lỗi cập nhật");
  }

  if (loading) return <div className="text-sm text-gray-400">Đang tải...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Factory className="h-6 w-6 text-orange-600" />
            Sản xuất & Đóng gói
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Lệnh sản xuất được tự động tạo khi đơn mua chuyển sang trạng thái "Đã đến".
            {totalOrders > 0 && <span className="ml-1 text-gray-400">· {totalOrders} lệnh</span>}
          </p>
        </div>
        <div className="flex gap-3 text-sm text-gray-500">
          <span className="bg-amber-100 text-amber-700 px-2 py-1 rounded font-medium">{pending.length} chờ</span>
          <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded font-medium">{inProduction.length} đang làm</span>
          <span className="bg-green-100 text-green-700 px-2 py-1 rounded font-medium">{done.length} xong</span>
        </div>
      </div>

      {/* Alert: pending orders */}
      {pending.length > 0 && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
          <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
          <div className="text-sm text-amber-800">
            <span className="font-semibold">{pending.length} lệnh đang chờ sản xuất.</span>{" "}
            Mở lệnh để bắt đầu đóng gói và nhập số lượng thực tế.
          </div>
        </div>
      )}

      {/* Active: in_production */}
      {inProduction.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Đang sản xuất</h2>
          {inProduction.map((o) => <OrderCard key={o.id} order={o} onRefresh={load} />)}
        </section>
      )}

      {/* Pending */}
      {pending.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Chờ sản xuất</h2>
          {pending.map((o) => (
            <OrderCard key={o.id} order={o} onRefresh={load} onStart={() => startProduction(o.id)} />
          ))}
        </section>
      )}

      {/* Done */}
      {done.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Đã hoàn tất</h2>
          {done.map((o) => <OrderCard key={o.id} order={o} onRefresh={load} />)}
        </section>
      )}

      {orders.length === 0 && !loading && (
        <div className="text-center py-16 text-gray-400 text-sm">
          Chưa có lệnh sản xuất nào. Đổi trạng thái đơn mua sang "Đã đến" để tạo lệnh tự động.
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 text-sm text-gray-600">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="px-3 py-1.5 rounded-md border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            ← Trang trước
          </button>
          <span className="font-medium">
            Trang {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="px-3 py-1.5 rounded-md border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Trang sau →
          </button>
        </div>
      )}
    </div>
  );
}

function OrderCard({
  order,
  onRefresh,
  onStart,
}: {
  order: ProductionOrder;
  onRefresh: () => void;
  onStart?: () => void;
}) {
  const totalPlanned = order.items.reduce((s, i) => s + i.plannedQty, 0);
  const totalActual  = order.items.reduce((s, i) => s + (i.actualQty ?? 0), 0);
  const confirmed    = order.items.filter((i) => i.actualQty != null).length;

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          {/* Header */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-sm font-semibold text-gray-800">{order.code}</span>
            <Badge className={STATUS_COLORS[order.status]}>{STATUS_LABELS[order.status]}</Badge>
            <span className="text-xs text-gray-400">← {order.purchaseOrder.code}</span>
            <span className="text-xs text-gray-400">| {order.purchaseOrder.supplier.name}</span>
          </div>

          {/* Items summary */}
          <div className="mt-2 space-y-1">
            {order.items.map((item) => (
              <div key={item.id} className="flex items-center gap-2 text-sm">
                <span className="text-gray-700 truncate">{item.product.nameVi ?? item.product.name}</span>
                <span className="text-gray-400 shrink-0">
                  {item.piecesPerPack
                    ? `(${item.piecesPerPack} hạt/gói)`
                    : item.gramsPerPack
                    ? `(${item.gramsPerPack}g/gói)`
                    : `(${item.product.unit})`}
                </span>
                <span className="text-gray-500 shrink-0">→</span>
                <span className="font-medium text-gray-800 shrink-0">
                  {item.plannedQty} gói dự kiến
                </span>
                {item.actualQty != null && (
                  <span className={`shrink-0 font-semibold ${item.actualQty < item.plannedQty ? "text-red-600" : "text-green-600"}`}>
                    / {item.actualQty} thực tế
                    {item.actualQty < item.plannedQty && ` (hao ${item.plannedQty - item.actualQty})`}
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="mt-2 flex items-center gap-4 text-xs text-gray-400">
            <span>Tổng dự kiến: <strong className="text-gray-600">{totalPlanned} gói</strong></span>
            {totalActual > 0 && (
              <span>Thực tế: <strong className="text-gray-600">{totalActual} gói</strong></span>
            )}
            {order.completedAt && (
              <span>Xong: {formatDate(order.completedAt)}</span>
            )}
            <span>Tạo: {formatDate(order.createdAt)}</span>
            <span className="text-blue-500">{confirmed}/{order.items.length} mục đã xác nhận</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {onStart && order.status === "pending" && (
            <Button size="sm" variant="outline" onClick={onStart} className="text-blue-600 border-blue-300 hover:bg-blue-50">
              Bắt đầu
            </Button>
          )}
          <Link href={`/production/${order.id}`}>
            <Button size="sm" variant="outline" className="gap-1">
              Chi tiết <ChevronRight className="h-3 w-3" />
            </Button>
          </Link>
        </div>
      </div>
    </Card>
  );
}
