"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link2, ArrowRight } from "lucide-react";
import { formatVND, formatUSD, formatDate } from "@/lib/utils";

// Matches /api/sales response (derived from ShopifyOrder.lineItemsJson)
interface SalesItem {
  id: string;
  orderId: string;
  orderName: string;
  orderDate: string | null;
  sku: string;
  productName: string;
  quantity: number;
  priceUsd: number;
  subtotalUsd: number;
  sourceName: string; // "web" | "tiktok" | ...
  channel: string;
}

interface PurchaseItem {
  id: string;
  quantity: number;
  priceVnd: number;
  subtotalVnd: number;
  product: { name: string };
  purchaseOrder: { code: string; orderDate: string; supplier: { name: string } };
}

export default function LinksPage() {
  const [salesItems, setSalesItems] = useState<SalesItem[]>([]);
  const [purchaseItems, setPurchaseItems] = useState<PurchaseItem[]>([]);
  const [linking, setLinking] = useState<string | null>(null);
  const [selectedPO, setSelectedPO] = useState<string>("");

  async function load() {
    const [salesRes, poRes] = await Promise.all([
      fetch("/api/sales"),
      fetch("/api/purchases"),
    ]);
    const salesData = await salesRes.json();
    const purchases = await poRes.json();

    // /api/sales returns a flat SalesItem[]
    setSalesItems(Array.isArray(salesData) ? salesData : []);

    const allPurchaseItems: PurchaseItem[] = (purchases as {
      id: string; code: string; orderDate: string;
      supplier: { name: string };
      items: { id: string; quantity: number; priceVnd: number; subtotalVnd: number; product: { name: string } }[];
    }[]).flatMap((p) =>
      p.items.map((i) => ({
        ...i,
        purchaseOrder: { code: p.code, orderDate: p.orderDate, supplier: p.supplier },
      }))
    );
    setPurchaseItems(allPurchaseItems);
  }

  useEffect(() => {
    load();
  }, []);

  async function linkItem(salesItemId: string, purchaseItemId: string) {
    const res = await fetch("/api/links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ salesItemId, purchaseItemId }),
    });
    if (res.ok) {
      toast.success("Đã liên kết");
      setLinking(null);
      setSelectedPO("");
      load();
    } else {
      toast.error("Có lỗi xảy ra");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Liên kết</h1>
        <p className="text-sm text-gray-500">
          Kết nối dữ liệu bán hàng ↔ đơn mua hàng
        </p>
      </div>

      {salesItems.length === 0 ? (
        <Card className="flex h-48 items-center justify-center">
          <div className="text-center">
            <Link2 className="mx-auto h-8 w-8 text-gray-300" />
            <p className="mt-2 text-gray-400">Chưa có dữ liệu để liên kết</p>
            <p className="text-xs text-gray-300">
              Sync đơn hàng Shopify và tạo đơn mua trước
            </p>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {salesItems.map((item) => (
            <Card key={item.id} className="p-4">
              <div className="flex items-center gap-4">
                {/* Sales item */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Badge
                      className={
                        item.sourceName === "tiktok"
                          ? "bg-pink-100 text-pink-700 text-xs"
                          : "bg-green-100 text-green-700 text-xs"
                      }
                    >
                      {item.sourceName === "tiktok" ? "TikTok" : "Shopify"}
                    </Badge>
                    <p className="font-medium text-gray-900 truncate">
                      {item.productName}
                    </p>
                  </div>
                  <div className="mt-1 flex items-center gap-3 text-xs text-gray-500">
                    {item.sku && <span className="font-mono">{item.sku}</span>}
                    <span>{item.quantity} sản phẩm</span>
                    <span className="font-medium text-gray-700">
                      {formatUSD(item.subtotalUsd)}
                    </span>
                    {item.orderDate && <span>{formatDate(item.orderDate)}</span>}
                    <span className="text-gray-400">{item.orderName}</span>
                  </div>
                </div>

                {/* Arrow */}
                <ArrowRight className="h-5 w-5 shrink-0 text-gray-300" />

                {/* Purchase link */}
                <div className="flex-1 min-w-0">
                  {purchaseItems.length === 0 ? (
                    <p className="text-xs text-gray-400">Chưa có đơn mua hàng</p>
                  ) : linking === item.id ? (
                    <div className="flex items-center gap-2">
                      <select
                        className="flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                        value={selectedPO}
                        onChange={(e) => setSelectedPO(e.target.value)}
                      >
                        <option value="">Chọn đơn mua...</option>
                        {purchaseItems.map((pi) => (
                          <option key={pi.id} value={pi.id}>
                            {pi.purchaseOrder.code} · {pi.product.name} ·{" "}
                            {formatVND(pi.subtotalVnd)}
                          </option>
                        ))}
                      </select>
                      <Button
                        size="sm"
                        disabled={!selectedPO}
                        onClick={() => linkItem(item.id, selectedPO)}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        Link
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setLinking(null);
                          setSelectedPO("");
                        }}
                      >
                        Huỷ
                      </Button>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setLinking(item.id)}
                      className="border-dashed"
                    >
                      <Link2 className="mr-1.5 h-3.5 w-3.5" />
                      Liên kết với đơn mua
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
