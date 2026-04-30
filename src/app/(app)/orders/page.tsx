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
import { Loader2 } from "lucide-react";

type ShopifyOrder = {
  id: string;
  shopifyId: string;
  orderName: string;
  email: string;
  financialStatus: string;
  fulfillmentStatus: string;
  totalPriceUsd: number;
  createdAtShopify: string;
};

export default function ShopifyOrdersPage() {
  const [orders, setOrders] = useState<ShopifyOrder[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/orders")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setOrders(data);
        } else {
          toast.error("Lỗi khi tải danh sách đơn hàng");
        }
      })
      .catch(() => toast.error("Có lỗi xảy ra kết nối Server"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">
          Đơn hàng Shopify
        </h1>
        <span className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
          Tổng cộng: {orders.length} đơn
        </span>
      </div>

      <div className="rounded-md border bg-white shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-gray-50/50">
            <TableRow>
              <TableHead className="w-[150px]">Mã Đơn</TableHead>
              <TableHead>Ngày Đặt</TableHead>
              <TableHead>Khách Hàng</TableHead>
              <TableHead>Thanh Toán</TableHead>
              <TableHead>Giao Hàng</TableHead>
              <TableHead className="text-right">Tổng Tiền (USD)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="h-40 text-center">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto text-gray-400" />
                </TableCell>
              </TableRow>
            ) : orders.length > 0 ? (
              orders.map((o) => (
                <TableRow key={o.id}>
                  <TableCell className="font-semibold text-gray-900">
                    {o.orderName}
                  </TableCell>
                  <TableCell className="text-gray-600">
                    {format(new Date(o.createdAtShopify), "dd/MM/yyyy HH:mm")}
                  </TableCell>
                  <TableCell className="text-gray-600">
                    {o.email || "Không rõ email"}
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={
                        o.financialStatus === "paid"
                          ? "bg-green-100 text-green-700 hover:bg-green-100/80"
                          : "bg-yellow-100 text-yellow-700 hover:bg-yellow-100/80"
                      }
                      variant="secondary"
                    >
                      {o.financialStatus || "pending"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={
                        o.fulfillmentStatus === "fulfilled"
                          ? "bg-blue-100 text-blue-700 hover:bg-blue-100/80"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-100/80"
                      }
                      variant="secondary"
                    >
                      {o.fulfillmentStatus || "unfulfilled"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    ${o.totalPriceUsd.toFixed(2)}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="h-40 text-center text-gray-500"
                >
                  Chưa có đơn hàng nào. Hãy ấn nút "Đồng bộ Đơn hàng Shopify" từ
                  trang Cài đặt API.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}