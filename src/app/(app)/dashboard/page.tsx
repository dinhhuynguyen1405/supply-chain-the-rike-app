"use client";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ShoppingCart, TrendingUp, Package, Truck,
  AlertTriangle, ArrowRight, DollarSign,
  TrendingDown, Users, Factory, CheckCircle2,
  ClipboardList, ChevronRight, Wallet, Store,
} from "lucide-react";
import { formatVND, formatUSD, formatDate, STATUS_LABELS, STATUS_COLORS } from "@/lib/utils";
import Link from "next/link";

interface CustomerDebt { orderCode: string; owedVnd: number }
interface LowStock { id: string; name: string; nameVi: string | null; stockUnits: number; threshold: number }

interface Pipeline {
  purchaseActive: number;
  productionPending: number;
  productionActive: number;
  shipmentsActive: number;
  shipmentsInTransit: number;
  fulfillmentPending: number;
}

interface RecentShipment {
  id: string;
  code: string;
  status: string;
  carrier: string | null;
  trackingCode: string | null;
}

interface RecentProduction {
  id: string;
  code: string;
  status: string;
  purchaseOrder: { code: string; supplier: { name: string } };
}

interface DashboardData {
  totalOrders: number;
  activeOrders: number;
  totalPurchaseVnd: number;
  totalSalesUsd: number;
  recentOrders: {
    id: string; code: string; status: string; orderDate: string;
    totalVnd: number; supplier: { name: string };
  }[];
  ordersByStatus: { status: string; _count: { id: number } }[];
  usdToVnd: number;
  totalRevenueVnd: number;
  profitVnd: number;
  profitMarginPct: number;
  customerDebts: CustomerDebt[];
  totalCustomerDebtVnd: number;
  supplierDebtVnd: number;
  lowStockProducts: LowStock[];
  pipeline: Pipeline;
  recentShipments: RecentShipment[];
  recentProduction: RecentProduction[];
}

const SHIPMENT_STATUS: Record<string, { label: string; color: string }> = {
  packing:        { label: "Đang đóng hàng",   color: "bg-amber-100 text-amber-700" },
  in_transit:     { label: "Đang vận chuyển",  color: "bg-blue-100 text-blue-700" },
  arrived_us:     { label: "Đã đến Mỹ",        color: "bg-indigo-100 text-indigo-700" },
  received_by_td: { label: "TD đã nhận",        color: "bg-purple-100 text-purple-700" },
  done:           { label: "Hoàn tất",          color: "bg-green-100 text-green-700" },
};

const PROD_STATUS: Record<string, { label: string; color: string }> = {
  pending:       { label: "Chờ sản xuất", color: "bg-amber-100 text-amber-700" },
  in_production: { label: "Đang sản xuất", color: "bg-blue-100 text-blue-700" },
  done:          { label: "Hoàn tất",      color: "bg-green-100 text-green-700" },
};

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    fetch("/api/dashboard").then((r) => r.json()).then(setData);
  }, []);

  if (!data) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-green-600 border-t-transparent" />
      </div>
    );
  }

  const isProfit = data.profitVnd >= 0;
  const p = data.pipeline;

  const pipelineSteps = [
    {
      href: "/research",
      icon: <Store className="h-5 w-5" />,
      label: "Nghiên cứu",
      value: null as number | null,
      sub: "Giá thị trường",
      active: false,
      activeCls: "border-gray-200 bg-gray-50",
      iconCls: "bg-gray-100 text-gray-400",
    },
    {
      href: "/purchases",
      icon: <ShoppingCart className="h-5 w-5" />,
      label: "Thu mua",
      value: p.purchaseActive,
      sub: "đơn active",
      active: p.purchaseActive > 0,
      activeCls: p.purchaseActive > 0 ? "border-blue-300 bg-blue-50" : "border-gray-200 bg-gray-50",
      iconCls: p.purchaseActive > 0 ? "bg-blue-100 text-blue-600" : "bg-gray-100 text-gray-400",
    },
    {
      href: "/production",
      icon: <Factory className="h-5 w-5" />,
      label: "Sản xuất",
      value: p.productionPending + p.productionActive,
      sub: p.productionActive > 0 ? `${p.productionActive} đang đóng` : "lô chờ xử lý",
      active: p.productionPending + p.productionActive > 0,
      activeCls: p.productionActive > 0 ? "border-orange-300 bg-orange-50"
               : p.productionPending > 0 ? "border-amber-300 bg-amber-50"
               : "border-gray-200 bg-gray-50",
      iconCls: p.productionActive > 0 ? "bg-orange-100 text-orange-600"
             : p.productionPending > 0 ? "bg-amber-100 text-amber-600"
             : "bg-gray-100 text-gray-400",
    },
    {
      href: "/shipments",
      icon: <Truck className="h-5 w-5" />,
      label: "Vận chuyển",
      value: p.shipmentsActive,
      sub: p.shipmentsInTransit > 0 ? `${p.shipmentsInTransit} đang bay` : "lô đang xử lý",
      active: p.shipmentsActive > 0,
      activeCls: p.shipmentsInTransit > 0 ? "border-indigo-300 bg-indigo-50"
               : p.shipmentsActive > 0 ? "border-blue-300 bg-blue-50"
               : "border-gray-200 bg-gray-50",
      iconCls: p.shipmentsInTransit > 0 ? "bg-indigo-100 text-indigo-600"
             : p.shipmentsActive > 0 ? "bg-blue-100 text-blue-600"
             : "bg-gray-100 text-gray-400",
    },
    {
      href: "/fulfillment",
      icon: <ClipboardList className="h-5 w-5" />,
      label: "Giao hàng",
      value: p.fulfillmentPending,
      sub: "lệnh chờ xử lý",
      active: p.fulfillmentPending > 0,
      activeCls: p.fulfillmentPending > 0 ? "border-purple-300 bg-purple-50" : "border-gray-200 bg-gray-50",
      iconCls: p.fulfillmentPending > 0 ? "bg-purple-100 text-purple-600" : "bg-gray-100 text-gray-400",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Tổng quan · 1 USD = <span className="font-semibold text-gray-700">{Number(data.usdToVnd).toLocaleString("vi-VN")} VND</span>
            <Link href="/settings" className="ml-2 text-xs text-green-600 hover:underline">Chỉnh →</Link>
          </p>
        </div>
        <p className="text-xs text-gray-400">
          {new Date().toLocaleDateString("vi-VN", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
        </p>
      </div>

      {/* Alerts */}
      {(data.lowStockProducts.length > 0 || data.totalCustomerDebtVnd > 0) && (
        <div className="grid gap-3 sm:grid-cols-2">
          {data.lowStockProducts.length > 0 && (
            <Link href="/inventory">
              <Card className="border-amber-200 bg-amber-50 p-4 hover:border-amber-300 transition-colors cursor-pointer">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                  <span className="text-sm font-semibold text-amber-800">{data.lowStockProducts.length} sản phẩm sắp hết</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {data.lowStockProducts.slice(0, 4).map((lp) => (
                    <Badge key={lp.id} className="bg-amber-100 text-amber-800 text-xs border border-amber-200">
                      {lp.nameVi ?? lp.name} ({lp.stockUnits <= 0 ? "HẾT" : `còn ${lp.stockUnits}`})
                    </Badge>
                  ))}
                  {data.lowStockProducts.length > 4 && (
                    <Badge className="bg-amber-100 text-amber-700 text-xs">+{data.lowStockProducts.length - 4} nữa</Badge>
                  )}
                </div>
              </Card>
            </Link>
          )}
          {data.totalCustomerDebtVnd > 0 && (
            <Card className="border-blue-200 bg-blue-50 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Users className="h-4 w-4 text-blue-600 shrink-0" />
                <span className="text-sm font-semibold text-blue-800">Khách còn nợ {formatVND(data.totalCustomerDebtVnd)}</span>
              </div>
              {data.customerDebts.map((d, i) => (
                <p key={i} className="text-xs text-blue-700">
                  <span className="font-mono font-medium">{d.orderCode}</span> · <span className="font-semibold">{formatVND(d.owedVnd)}</span>
                </p>
              ))}
            </Card>
          )}
        </div>
      )}

      {/* ── VN→US Pipeline ─────────────────────────────────────────── */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <Truck className="h-4 w-4 text-green-600" />
            Pipeline VN → US
          </h2>
          <span className="text-xs text-gray-400">Nhấn vào từng bước để xem chi tiết</span>
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {pipelineSteps.map((step, i) => (
            <div key={step.href} className="flex items-center gap-1.5 shrink-0">
              <Link href={step.href}
                className={`flex flex-col items-center rounded-xl border-2 px-4 py-3 w-[110px] text-center transition-all hover:shadow-md hover:-translate-y-0.5 ${step.activeCls}`}
              >
                <div className={`rounded-lg p-2 mb-1.5 ${step.iconCls}`}>{step.icon}</div>
                <p className="text-xs font-semibold text-gray-700 leading-tight">{step.label}</p>
                {step.value !== null && (
                  <p className={`text-2xl font-bold mt-0.5 ${step.active ? "text-gray-900" : "text-gray-300"}`}>
                    {step.value}
                  </p>
                )}
                <p className="text-[10px] text-gray-400 leading-tight mt-0.5">{step.sub}</p>
              </Link>
              {i < pipelineSteps.length - 1 && (
                <ChevronRight className="h-4 w-4 text-gray-300 shrink-0" />
              )}
            </div>
          ))}
        </div>
      </Card>

      {/* ── KPI Cards ────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: "Chi mua hàng", value: formatVND(data.totalPurchaseVnd), sub: `Nợ NCC: ${formatVND(data.supplierDebtVnd)}`, icon: Package, ic: "text-amber-600", ib: "bg-amber-50", href: "/purchases" },
          { label: "Doanh thu", value: formatUSD(data.totalSalesUsd), sub: `≈ ${formatVND(data.totalRevenueVnd)}`, icon: TrendingUp, ic: "text-green-600", ib: "bg-green-50", href: "/sales" },
          { label: "Lợi nhuận", value: (isProfit ? "+" : "") + formatVND(data.profitVnd), sub: `Margin: ${data.profitMarginPct.toFixed(1)}%`, icon: isProfit ? DollarSign : TrendingDown, ic: isProfit ? "text-green-600" : "text-red-500", ib: isProfit ? "bg-green-50" : "bg-red-50", href: "/sales" },
          { label: "Tổng đơn mua", value: `${data.totalOrders}`, sub: `${data.activeOrders} đang active`, icon: Wallet, ic: "text-purple-600", ib: "bg-purple-50", href: "/purchases" },
        ].map((s) => (
          <Link key={s.label} href={s.href}>
            <Card className="p-5 hover:shadow-sm transition-shadow cursor-pointer group h-full">
              <div className="flex items-start justify-between">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-gray-500">{s.label}</p>
                  <p className={`mt-1 text-xl font-bold truncate ${s.ic}`}>{s.value}</p>
                  <p className="mt-0.5 text-xs text-gray-400">{s.sub}</p>
                </div>
                <div className={`rounded-lg p-2 shrink-0 ${s.ib} group-hover:scale-110 transition-transform`}>
                  <s.icon className={`h-5 w-5 ${s.ic}`} />
                </div>
              </div>
            </Card>
          </Link>
        ))}
      </div>

      {/* ── P&L Banner ───────────────────────────────────────────── */}
      <Card className={`p-5 border-2 ${isProfit ? "border-green-200 bg-gradient-to-r from-green-50 to-emerald-50" : "border-red-200 bg-gradient-to-r from-red-50 to-rose-50"}`}>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className={`rounded-xl p-2.5 ${isProfit ? "bg-green-100" : "bg-red-100"}`}>
              {isProfit ? <DollarSign className="h-6 w-6 text-green-600" /> : <TrendingDown className="h-6 w-6 text-red-500" />}
            </div>
            <div>
              <p className="text-sm font-bold text-gray-800">Lợi nhuận ước tính</p>
              <p className="text-xs text-gray-500">Doanh thu (VND quy đổi) − Giá vốn</p>
            </div>
          </div>
          <div className="text-right">
            <p className={`text-3xl font-bold ${isProfit ? "text-green-700" : "text-red-600"}`}>
              {isProfit ? "+" : ""}{formatVND(data.profitVnd)}
            </p>
            <p className={`text-sm font-semibold ${isProfit ? "text-green-600" : "text-red-500"}`}>
              Margin: {data.profitMarginPct.toFixed(1)}%
            </p>
          </div>
          <div className="flex gap-8 text-sm">
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Doanh thu</p>
              <p className="font-bold text-gray-800">{formatVND(data.totalRevenueVnd)}</p>
              <p className="text-xs text-gray-400">{formatUSD(data.totalSalesUsd)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Giá vốn</p>
              <p className="font-bold text-gray-800">{formatVND(data.totalPurchaseVnd)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Nợ NCC</p>
              <p className="font-bold text-amber-700">{formatVND(data.supplierDebtVnd)}</p>
            </div>
          </div>
        </div>
      </Card>

      {/* ── Bottom Grid ──────────────────────────────────────────── */}
      <div className="grid gap-5 lg:grid-cols-2">
        {/* Purchase status */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <ShoppingCart className="h-4 w-4 text-blue-500" />
              Trạng thái đơn mua
            </h2>
            <Link href="/purchases" className="flex items-center gap-1 text-xs text-green-600 hover:underline">
              Xem tất cả <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {data.ordersByStatus.length === 0 ? (
            <p className="text-sm text-gray-400">Chưa có đơn nào</p>
          ) : (
            <div className="space-y-2.5">
              {data.ordersByStatus.map((s) => (
                <div key={s.status} className="flex items-center justify-between">
                  <Badge className={`${STATUS_COLORS[s.status] ?? "bg-gray-100 text-gray-600"} text-xs`}>
                    {STATUS_LABELS[s.status] ?? s.status}
                  </Badge>
                  <div className="flex items-center gap-3">
                    <div className="h-1.5 w-24 overflow-hidden rounded-full bg-gray-100">
                      <div
                        className={`h-full rounded-full ${
                          STATUS_COLORS[s.status]?.includes("green") ? "bg-green-500" :
                          STATUS_COLORS[s.status]?.includes("blue") ? "bg-blue-400" :
                          STATUS_COLORS[s.status]?.includes("amber") ? "bg-amber-400" : "bg-gray-300"
                        }`}
                        style={{ width: `${Math.min(100, (s._count.id / Math.max(1, data.totalOrders)) * 100)}%` }}
                      />
                    </div>
                    <span className="text-sm font-semibold text-gray-700 w-14 text-right">{s._count.id} đơn</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Recent orders */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <Package className="h-4 w-4 text-amber-500" />
              Đơn mua gần đây
            </h2>
            <Link href="/purchases" className="flex items-center gap-1 text-xs text-green-600 hover:underline">
              Tất cả <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {data.recentOrders.length === 0 ? (
            <p className="text-sm text-gray-400">Chưa có đơn nào</p>
          ) : (
            <div className="space-y-2">
              {data.recentOrders.map((order) => (
                <Link key={order.id} href={`/purchases/${order.id}`}
                  className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2.5 hover:bg-gray-50 hover:border-gray-200 transition-colors">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{order.code}</p>
                    <p className="text-xs text-gray-400">{order.supplier.name} · {formatDate(order.orderDate)}</p>
                  </div>
                  <div className="text-right">
                    <Badge className={`${STATUS_COLORS[order.status] ?? ""} text-xs`}>{STATUS_LABELS[order.status] ?? order.status}</Badge>
                    <p className="mt-1 text-xs font-semibold text-gray-600">{formatVND(order.totalVnd)}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Card>

        {/* Active shipments */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <Truck className="h-4 w-4 text-indigo-500" />
              Lô vận chuyển đang xử lý
            </h2>
            <Link href="/shipments" className="flex items-center gap-1 text-xs text-green-600 hover:underline">
              Tất cả <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {data.recentShipments.length === 0 ? (
            <div className="rounded-lg bg-gray-50 border border-gray-100 p-4 text-center">
              <Truck className="h-6 w-6 text-gray-300 mx-auto mb-1.5" />
              <p className="text-sm text-gray-400">Không có lô đang vận chuyển</p>
            </div>
          ) : (
            <div className="space-y-2">
              {data.recentShipments.map((s) => {
                const st = SHIPMENT_STATUS[s.status];
                return (
                  <Link key={s.id} href="/shipments"
                    className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2.5 hover:bg-gray-50 transition-colors">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{s.code}</p>
                      <p className="text-xs text-gray-400">{s.carrier ?? "Chưa chọn hãng"}{s.trackingCode ? ` · ${s.trackingCode}` : ""}</p>
                    </div>
                    <Badge className={`${st?.color ?? "bg-gray-100 text-gray-600"} text-xs shrink-0`}>
                      {st?.label ?? s.status}
                    </Badge>
                  </Link>
                );
              })}
            </div>
          )}
        </Card>

        {/* Recent production */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <Factory className="h-4 w-4 text-orange-500" />
              Lệnh sản xuất gần đây
            </h2>
            <Link href="/production" className="flex items-center gap-1 text-xs text-green-600 hover:underline">
              Tất cả <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {data.recentProduction.length === 0 ? (
            <div className="rounded-lg bg-gray-50 border border-gray-100 p-4 text-center">
              <Factory className="h-6 w-6 text-gray-300 mx-auto mb-1.5" />
              <p className="text-sm text-gray-400">Chưa có lệnh sản xuất nào</p>
            </div>
          ) : (
            <div className="space-y-2">
              {data.recentProduction.map((prod) => {
                const st = PROD_STATUS[prod.status];
                return (
                  <Link key={prod.id} href={`/production/${prod.id}`}
                    className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2.5 hover:bg-gray-50 transition-colors">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{prod.code}</p>
                      <p className="text-xs text-gray-400">{prod.purchaseOrder.supplier.name} · {prod.purchaseOrder.code}</p>
                    </div>
                    <Badge className={`${st?.color ?? "bg-gray-100 text-gray-600"} text-xs shrink-0`}>
                      {st?.label ?? prod.status}
                    </Badge>
                  </Link>
                );
              })}
            </div>
          )}
          {p.productionPending > 0 && (
            <div className="mt-3 flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-100 px-3 py-2">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
              <p className="text-xs text-amber-700 flex-1">
                <span className="font-semibold">{p.productionPending} lệnh</span> chờ bắt đầu sản xuất
              </p>
              <Link href="/production" className="text-xs text-amber-700 font-semibold hover:underline shrink-0">
                Xử lý →
              </Link>
            </div>
          )}
        </Card>
      </div>

      {/* Customer debts */}
      {data.customerDebts.length > 0 && (
        <Card className="p-5">
          <div className="mb-4 flex items-center gap-2">
            <Users className="h-4 w-4 text-blue-500" />
            <h2 className="text-sm font-semibold text-gray-700">Chi tiết công nợ khách hàng</h2>
          </div>
          <div className="overflow-hidden rounded-lg border border-gray-100">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2.5 text-left font-medium text-gray-500">Đơn hàng</th>
                  <th className="px-4 py-2.5 text-right font-medium text-gray-500">Còn nợ</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data.customerDebts.map((d, i) => (
                  <tr key={i} className="hover:bg-blue-50">
                    <td className="px-4 py-2.5 font-mono text-xs text-gray-700">{d.orderCode}</td>
                    <td className="px-4 py-2.5 text-right font-bold text-blue-700">{formatVND(d.owedVnd)}</td>
                    <td className="px-4 py-2.5 text-right">
                      <Link href="/purchases" className="text-xs text-green-600 hover:underline">Chi tiết →</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-gray-200 bg-gray-50">
                <tr>
                  <td className="px-4 py-2.5 text-sm font-semibold text-gray-700">Tổng công nợ</td>
                  <td className="px-4 py-2.5 text-right text-base font-bold text-blue-800">{formatVND(data.totalCustomerDebtVnd)}</td>
                  <td className="px-4 py-2.5 text-right">
                    <CheckCircle2 className="h-4 w-4 text-gray-300 ml-auto" />
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
