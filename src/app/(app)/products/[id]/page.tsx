"use client";
import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Package, Truck, CheckCircle2, Clock, BarChart3, ImageIcon, ExternalLink, Trash2, Save, Link2, ImageOff } from "lucide-react";
import type { InventoryProduct } from "@/app/api/inventory/route";
import { formatVND, formatDate, STATUS_LABELS, STATUS_COLORS } from "@/lib/utils";
import Link from "next/link";
import { toast } from "sonner";
import { ProductImageGallery } from "@/components/product-image-gallery";
import { BarcodeGenerator } from "@/components/barcode-generator";

interface PurchaseHistoryItem {
  id: string;
  quantity: number;
  priceVnd: number;
  subtotalVnd: number;
  purchaseOrder: {
    id: string;
    code: string;
    orderDate: string;
    expectedDate: string | null;
    arrivedDate: string | null;
    status: string;
    shippingCode: string | null;
    shippingUnit: string | null;
    totalVnd: number;
    supplier: { name: string };
    isBuyOnBehalf: boolean;
    payments: { id: string; direction: string; amount: number; paidAt: string }[];
  };
}

interface Product {
  id: string;
  name: string;
  nameVi: string | null;
  skuShopify: string | null;
  skuTiktok: string | null;
  unit: string;
  gramsPerUnit: number | null;
  category: string | null;
  labelImageUrl: string | null;
  labelDriveUrl: string | null;
}

export default function ProductHistoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [product, setProduct] = useState<Product | null>(null);
  const [history, setHistory] = useState<PurchaseHistoryItem[]>([]);
  const [stock, setStock] = useState<InventoryProduct | null>(null);
  const [driveUrl, setDriveUrl] = useState("");
  const [savingLabel, setSavingLabel] = useState(false);

  const loadProduct = () =>
    fetch(`/api/products/${id}`).then((r) => r.json()).then((p: Product) => {
      if (p?.id) { setProduct(p); setDriveUrl(p.labelDriveUrl ?? ""); }
    });

  useEffect(() => {
    loadProduct();
    fetch(`/api/products/${id}/history`).then((r) => r.json()).then(setHistory);
    fetch("/api/inventory").then((r) => r.json()).then((inv: InventoryProduct[]) => {
      const found = inv.find((p) => p.id === id);
      if (found) setStock(found);
    });
  }, [id]);

  async function saveLabel() {
    setSavingLabel(true);
    const res = await fetch(`/api/products/${id}/label`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ driveUrl: driveUrl.trim() || null }),
    });
    setSavingLabel(false);
    if (res.ok) { toast.success("Đã lưu label ✓"); loadProduct(); }
    else toast.error("Lỗi lưu label");
  }

  async function clearLabel() {
    if (!confirm("Xoá ảnh label này?")) return;
    const res = await fetch(`/api/products/${id}/label`, { method: "DELETE" });
    if (res.ok) { toast.success("Đã xoá label"); setDriveUrl(""); loadProduct(); }
    else toast.error("Lỗi xoá");
  }

  const totalQty = history.reduce((s, h) => s + h.quantity, 0);
  const totalCost = history.reduce((s, h) => s + h.subtotalVnd, 0);
  const avgPrice = history.length > 0 ? totalCost / totalQty : 0;

  if (!product) return (
    <div className="flex h-64 items-center justify-center">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-green-600 border-t-transparent" />
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <Package className="h-5 w-5 text-green-600" />
            <h1 className="text-2xl font-bold text-gray-900">
              {product.nameVi || product.name}
            </h1>
            {product.category && (
              <Badge variant="outline" className="text-xs">{product.category}</Badge>
            )}
          </div>
          <p className="mt-0.5 text-sm text-gray-500">{product.name}</p>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card className="p-4 text-center">
          <p className="text-xs text-gray-500">Số đợt mua</p>
          <p className="text-2xl font-bold text-gray-900">{history.length}</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-xs text-gray-500">Tổng đã mua</p>
          <p className="text-2xl font-bold text-gray-900">{totalQty} <span className="text-sm font-normal text-gray-400">{product.unit}</span></p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-xs text-gray-500">Giá trung bình</p>
          <p className="text-xl font-bold text-gray-900">{formatVND(avgPrice)}<span className="text-sm font-normal text-gray-400">/{product.unit}</span></p>
        </Card>
        {/* Stock card */}
        {stock && (
          <Card className={`p-4 text-center border-2 ${
            stock.stockUnits <= 0 ? "border-red-200 bg-red-50" :
            stock.lowStock ? "border-amber-200 bg-amber-50" :
            "border-green-200 bg-green-50"
          }`}>
            <div className="flex items-center justify-center gap-1 mb-1">
              <BarChart3 className="h-3.5 w-3.5 text-gray-400" />
              <p className="text-xs text-gray-500">Tồn kho</p>
            </div>
            <p className={`text-2xl font-bold ${
              stock.stockUnits <= 0 ? "text-red-600" :
              stock.lowStock ? "text-amber-600" : "text-green-700"
            }`}>
              {stock.stockUnits <= 0 ? "Hết" : `${stock.stockUnits}`}
            </p>
            {stock.stockUnits > 0 && <p className="text-xs text-gray-400">gói còn lại</p>}
            {product.gramsPerUnit && (
              <p className="text-xs text-gray-400 mt-0.5">{product.gramsPerUnit}g/gói</p>
            )}
          </Card>
        )}
      </div>

      {/* SKU + Barcode */}
      {(product.skuShopify || product.skuTiktok) && (
        <Card className="p-5">
          <div className="grid gap-6 sm:grid-cols-2">
            {/* SKU list */}
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">SKU</p>
              {product.skuShopify && (
                <div className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-3 py-2.5">
                  <div>
                    <p className="text-[10px] text-gray-400 mb-0.5">Shopify</p>
                    <p className="font-mono text-sm font-semibold text-gray-800">{product.skuShopify}</p>
                  </div>
                </div>
              )}
              {product.skuTiktok && (
                <div className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-3 py-2.5">
                  <div>
                    <p className="text-[10px] text-gray-400 mb-0.5">TikTok</p>
                    <p className="font-mono text-sm font-semibold text-gray-800">{product.skuTiktok}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Barcode / QR generator */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">Barcode / QR</p>
              <BarcodeGenerator
                sku={product.skuShopify ?? product.skuTiktok ?? ""}
                label={product.nameVi ?? product.name}
              />
            </div>
          </div>
        </Card>
      )}

      {/* Label Card */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <ImageIcon className="h-4 w-4 text-indigo-600" />
            <h2 className="text-sm font-semibold text-gray-700">Ảnh Label / Nhãn đóng gói</h2>
          </div>
          {product.labelDriveUrl && (
            <button onClick={clearLabel} className="text-xs text-red-400 hover:text-red-600 flex items-center gap-1">
              <Trash2 className="h-3 w-3" /> Xoá
            </button>
          )}
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          {/* Preview */}
          <div className="relative group rounded-xl overflow-hidden border border-gray-200 bg-gray-50 h-52 flex items-center justify-center">
            {product.labelImageUrl ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={product.labelImageUrl}
                  alt={`Label ${product.nameVi ?? product.name}`}
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    (e.currentTarget).style.display = "none";
                    (e.currentTarget).nextElementSibling?.classList.remove("hidden");
                  }}
                />
                <div className="hidden absolute inset-0 flex flex-col items-center justify-center gap-1 text-gray-300">
                  <ImageOff className="h-8 w-8" />
                  <p className="text-xs">Chưa share public trên Drive</p>
                </div>
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <a href={product.labelDriveUrl ?? product.labelImageUrl} target="_blank" rel="noopener noreferrer"
                    className="rounded-full bg-white/90 p-2.5 hover:bg-white">
                    <ExternalLink className="h-4 w-4 text-gray-700" />
                  </a>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center gap-2 text-gray-300">
                <ImageOff className="h-10 w-10" />
                <p className="text-xs text-gray-400">Chưa có ảnh label</p>
              </div>
            )}
          </div>

          {/* Input Drive URL */}
          <div className="space-y-3 flex flex-col justify-center">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1">
                <Link2 className="h-3 w-3" /> Link Google Drive
              </Label>
              <Input
                placeholder="https://drive.google.com/file/d/..."
                value={driveUrl}
                onChange={(e) => setDriveUrl(e.target.value)}
                className="text-xs font-mono"
              />
              <p className="text-[11px] text-gray-400">
                File phải được share <strong>&ldquo;Anyone with the link&rdquo;</strong> mới hiển thị được
              </p>
            </div>
            <Button
              size="sm"
              onClick={saveLabel}
              disabled={savingLabel}
              className="w-full bg-indigo-600 hover:bg-indigo-700"
            >
              <Save className="mr-1.5 h-3.5 w-3.5" />
              {savingLabel ? "Đang lưu..." : "Lưu label"}
            </Button>
            {product.labelDriveUrl && (
              <a href={product.labelDriveUrl} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-lg border border-indigo-100 bg-indigo-50 px-3 py-2 text-xs text-indigo-700 hover:bg-indigo-100 transition-colors">
                <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">Mở file gốc trên Google Drive</span>
              </a>
            )}
          </div>
        </div>
      </Card>

      {/* Listing images gallery */}
      <ProductImageGallery
        productId={id}
        type="listing"
        label="Ảnh Listing (Shopify / Amazon)"
        maxImages={12}
      />

      {/* Purchase history timeline */}
      <div>
        <h2 className="mb-4 text-sm font-semibold text-gray-700">Lịch sử thu mua</h2>
        {history.length === 0 ? (
          <Card className="flex h-32 items-center justify-center">
            <p className="text-gray-400">Chưa có đợt mua nào</p>
          </Card>
        ) : (
          <div className="relative space-y-0">
            {/* Timeline line */}
            <div className="absolute left-[19px] top-5 bottom-5 w-0.5 bg-gray-200" />

            {history.map((item, idx) => {
              const po = item.purchaseOrder;
              const paidToSupplier = po.payments
                .filter((p) => p.direction === "to_supplier")
                .reduce((s, p) => s + p.amount, 0);
              const receivedFromCustomer = po.payments
                .filter((p) => p.direction === "from_customer")
                .reduce((s, p) => s + p.amount, 0);

              return (
                <div key={item.id} className="relative flex gap-4 pb-6">
                  {/* Dot */}
                  <div className={`relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 ${
                    po.status === "completed" ? "border-green-500 bg-green-50" :
                    po.status === "shipping" ? "border-amber-400 bg-amber-50" :
                    "border-gray-300 bg-white"
                  }`}>
                    {po.status === "completed" ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    ) : po.status === "shipping" ? (
                      <Truck className="h-4 w-4 text-amber-600" />
                    ) : (
                      <Clock className="h-4 w-4 text-gray-400" />
                    )}
                  </div>

                  {/* Content */}
                  <Card className="flex-1 p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <Link href={`/purchases/${po.id}`}
                            className="font-mono text-sm font-semibold text-green-600 hover:underline">
                            {po.code}
                          </Link>
                          <Badge className={`${STATUS_COLORS[po.status]} text-xs`}>
                            {STATUS_LABELS[po.status]}
                          </Badge>
                        </div>
                        <p className="mt-0.5 text-xs text-gray-500">
                          {po.supplier.name}
                          {po.isBuyOnBehalf && <span className="ml-1 text-purple-500">· Mua hộ</span>}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-gray-900">{formatVND(item.subtotalVnd)}</p>
                        <p className="text-xs text-gray-400">{item.quantity} {product.unit} × {formatVND(item.priceVnd)}</p>
                      </div>
                    </div>

                    {/* Dates */}
                    <div className="mt-3 flex flex-wrap gap-4 text-xs text-gray-500">
                      <span>📅 Đặt: <span className="font-medium">{formatDate(po.orderDate)}</span></span>
                      {po.expectedDate && <span>⏳ Dự kiến: <span className="font-medium">{formatDate(po.expectedDate)}</span></span>}
                      {po.arrivedDate && <span className="text-green-600">✓ Đến: <span className="font-medium">{formatDate(po.arrivedDate)}</span></span>}
                    </div>

                    {/* Shipping */}
                    {po.shippingCode && (
                      <div className="mt-2 text-xs text-gray-500">
                        🚚 {po.shippingUnit} · <span className="font-mono">{po.shippingCode}</span>
                      </div>
                    )}

                    {/* Payment summary */}
                    <div className="mt-3 flex gap-4 rounded-lg bg-gray-50 px-3 py-2 text-xs">
                      <div>
                        <span className="text-gray-400">Đã trả NCC: </span>
                        <span className={`font-semibold ${paidToSupplier >= item.subtotalVnd ? "text-green-600" : "text-amber-600"}`}>
                          {formatVND(paidToSupplier)}
                        </span>
                        {paidToSupplier < item.subtotalVnd && (
                          <span className="text-red-400"> (còn {formatVND(item.subtotalVnd - paidToSupplier)})</span>
                        )}
                      </div>
                      {po.isBuyOnBehalf && (
                        <div>
                          <span className="text-gray-400">Khách trả lại: </span>
                          <span className={`font-semibold ${receivedFromCustomer > 0 ? "text-blue-600" : "text-red-400"}`}>
                            {formatVND(receivedFromCustomer)}
                          </span>
                          {receivedFromCustomer === 0 && (
                            <span className="text-red-400"> (chưa thanh toán)</span>
                          )}
                        </div>
                      )}
                    </div>
                  </Card>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
