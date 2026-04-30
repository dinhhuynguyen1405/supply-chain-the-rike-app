"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, TrendingUp, RefreshCw } from "lucide-react";

type SalesItem = {
  id: string;
  orderId: string;
  orderName: string;
  orderDate: string;
  sku: string;
  productName: string;
  quantity: number;
  priceUsd: number;
  subtotalUsd: number;
  sourceName: string;
  channel: string;
};

export default function SalesPage() {
  const [salesItems, setSalesItems] = useState<SalesItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const fetchSales = () => {
    setLoading(true);
    fetch("/api/sales")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setSalesItems(data);
        } else {
          toast.error(data.error || "Lỗi tải dữ liệu bán hàng");
        }
      })
      .catch(() => toast.error("Có lỗi xảy ra kết nối Server"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchSales();
  }, []);

  const handleSyncOrders = async () => {
    setSyncing(true);
    try {
      const res = await fetch("/api/sync/shopify?type=orders", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Lỗi đồng bộ");
      toast.success(`Đã đồng bộ đơn hàng mới`);
      fetchSales();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSyncing(false);
    }
  };

  const totalQuantity = salesItems.reduce((acc, item) => acc + item.quantity, 0);
  const totalRevenue = salesItems.reduce((acc, item) => acc + item.subtotalUsd, 0);

  const revenueShopify = salesItems.filter(i => i.channel === "Website Shopify" || i.channel === "Mặc định (Shopify)").reduce((a, i) => a + i.subtotalUsd, 0);
  const revenueTikTok = salesItems.filter(i => i.channel === "TikTok").reduce((a, i) => a + i.subtotalUsd, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
            <TrendingUp className="h-6 w-6 text-green-600" />
            Báo cáo Bán hàng
          </h1>
          <p className="text-sm text-gray-500 mt-1">Tổng hợp các sản phẩm đã bán từ Shopify (các đơn đã thanh toán)</p>
        </div>
        <button
          onClick={handleSyncOrders}
          disabled={syncing}
          className="flex items-center gap-2 rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
          {syncing ? "Đang đồng bộ..." : "Đồng bộ Đơn hàng Shopify"}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-md border bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-gray-500">Doanh thu chung (USD)</p>
          <p className="mt-2 text-3xl font-bold text-green-600">${totalRevenue.toFixed(2)}</p>
        </div>
        <div className="rounded-md border bg-white p-5 shadow-sm border-l-4 border-l-blue-500">
          <p className="text-sm font-medium text-gray-500">Web Shopify</p>
          <p className="mt-2 text-3xl font-bold text-gray-900">${revenueShopify.toFixed(2)}</p>
        </div>
        <div className="rounded-md border bg-white p-5 shadow-sm border-l-4 border-l-black">
          <p className="text-sm font-medium text-gray-500">TikTok Shop</p>
          <p className="mt-2 text-3xl font-bold text-gray-900">${revenueTikTok.toFixed(2)}</p>
        </div>
      </div>

      <div className="rounded-md border bg-white shadow-sm overflow-hidden auto-mx-auto">
        <Table>
          <TableHeader className="bg-gray-50/50">
            <TableRow>
              <TableHead>Ngày Đặt</TableHead>
              <TableHead>Kênh</TableHead>
              <TableHead>Mã Đơn</TableHead>
              <TableHead>Sản Phẩm</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead className="text-right">Số Lượng</TableHead>
              <TableHead className="text-right">Đơn Giá</TableHead>
              <TableHead className="text-right">Thành Tiền</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="h-40 text-center">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto text-gray-400" />
                </TableCell>
              </TableRow>
            ) : salesItems.length > 0 ? (
              salesItems.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="text-gray-600 whitespace-nowrap">
                    {format(new Date(item.orderDate), "dd/MM/yyyy")}
                  </TableCell>
                  <TableCell>
                    <Badge variant={item.channel === "TikTok" ? "default" : "outline"} className={item.channel === "TikTok" ? "bg-black" : ""}>
                      {item.channel}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-semibold text-gray-900">
                    <Badge variant="outline">{item.orderName}</Badge>
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate" title={item.productName}>
                    {item.productName}
                  </TableCell>
                  <TableCell className="text-gray-500">{item.sku || "-"}</TableCell>
                  <TableCell className="text-right font-medium">{item.quantity}</TableCell>
                  <TableCell className="text-right text-gray-600">${item.priceUsd.toFixed(2)}</TableCell>
                  <TableCell className="text-right font-bold text-green-700">
                    ${item.subtotalUsd.toFixed(2)}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="h-40 text-center text-gray-500"
                >
                  Chưa có sản phẩm nào được bán.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
