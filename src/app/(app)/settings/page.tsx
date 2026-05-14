"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RefreshCw, CheckCircle2, Building2 } from "lucide-react";

export default function SettingsPage() {
  const [settings, setSettings] = useState<Record<string, string>>({
    usdToVnd: "",
    shopifyStoreDomain: "",
    shopifyClientId: "",
    shopifyApiSecret: "",
    shopifyAccessToken: "",
  });
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [brosSyncing, setBrosSyncing] = useState(false);
  const [brosSyncResult, setBrosSyncResult] = useState<{ syncedRows?: number; totalInDB?: number } | null>(null);

  useEffect(() => {
    fetch("/api/settings")
      .then((res) => res.json())
      .then((data) => setSettings((prev) => ({ ...prev, ...data })))
      .catch(() => toast.error("Không thể tải cài đặt"));

    const params = new URLSearchParams(window.location.search);
    if (params.get("auth") === "success") {
      toast.success("Kết nối Shopify thành công!");
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const handleChange = (key: string, value: string) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (!res.ok) throw new Error("Save failed");
      toast.success("Đã lưu cài đặt");
    } catch {
      toast.error("Lỗi khi lưu cài đặt");
    } finally {
      setSaving(false);
    }
  };

  const syncShopify = async (type: "products" | "orders") => {
    setSyncing(true);
    try {
      const res = await fetch(`/api/sync/shopify?type=${type}`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Lỗi đồng bộ");
      toast.success(`Đã đồng bộ ${data.count ?? ((data.created ?? 0) + (data.updated ?? 0))} ${type === "products" ? "sản phẩm" : "đơn hàng"}`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Lỗi đồng bộ");
    } finally {
      setSyncing(false);
    }
  };

  const syncBros = async () => {
    setBrosSyncing(true);
    setBrosSyncResult(null);
    try {
      const res = await fetch("/api/sync/bros", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Lỗi sync Bros");
      setBrosSyncResult({ syncedRows: data.syncedRows, totalInDB: data.totalInDB });
      toast.success(`Đã sync kho Bros: ${data.syncedRows ?? 0} SKU → DB ✓`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Lỗi sync Bros");
    } finally {
      setBrosSyncing(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold tracking-tight text-gray-900">Cài đặt</h1>

      {/* Tỷ giá */}
      <Card>
        <CardHeader>
          <CardTitle>Chung</CardTitle>
          <CardDescription>Cấu hình các thông số chung.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="usdToVnd">Tỷ giá USD → VND</Label>
            <Input
              id="usdToVnd"
              type="number"
              value={settings.usdToVnd || ""}
              onChange={(e) => handleChange("usdToVnd", e.target.value)}
              placeholder="25500"
            />
          </div>
        </CardContent>
        <CardFooter className="border-t px-4 py-3 bg-gray-50/50 justify-end">
          <Button onClick={handleSave} disabled={saving} className="bg-gray-900 hover:bg-gray-800">
            {saving ? "Đang lưu..." : "Lưu"}
          </Button>
        </CardFooter>
      </Card>

      {/* Kho Bros */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-gray-500" />
            <CardTitle>Kho Bros</CardTitle>
          </div>
          <CardDescription>
            Đọc tồn kho từ Google Sheet kho Bros (public) → lưu vào database.
            Không cần đăng nhập Google.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-3 text-sm text-gray-600 space-y-1">
            <p>• Sheet Bros được đọc qua URL công khai — không cần OAuth</p>
            <p>• Dữ liệu lưu vào bảng <code className="font-mono text-xs bg-white border rounded px-1">WarehouseStock</code> trong database</p>
            <p>• Tồn kho hiển thị tự động trên trang Tồn kho & So khớp</p>
          </div>
          {brosSyncResult && (
            <div className="mt-3 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              Đã sync {brosSyncResult.syncedRows} SKU · tổng trong DB: {brosSyncResult.totalInDB} SKU
            </div>
          )}
        </CardContent>
        <CardFooter className="border-t px-4 py-3 bg-gray-50/50">
          <Button
            onClick={syncBros}
            disabled={brosSyncing}
            className="w-full gap-2"
            variant="outline"
          >
            <RefreshCw className={`h-4 w-4 ${brosSyncing ? "animate-spin" : ""}`} />
            {brosSyncing ? "Đang sync kho Bros..." : "Sync kho Bros ngay"}
          </Button>
        </CardFooter>
      </Card>

      {/* Shopify */}
      <Card>
        <CardHeader>
          <CardTitle>Kết nối Shopify</CardTitle>
          <CardDescription>API kết nối tới cửa hàng Shopify để đồng bộ sản phẩm và đơn hàng.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="shopifyStoreDomain">Store Domain</Label>
            <Input
              id="shopifyStoreDomain"
              placeholder="your-store.myshopify.com"
              value={settings.shopifyStoreDomain || ""}
              onChange={(e) => handleChange("shopifyStoreDomain", e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="shopifyClientId">Client ID</Label>
            <Input
              id="shopifyClientId"
              type="password"
              placeholder="68244ff0..."
              value={settings.shopifyClientId || ""}
              onChange={(e) => handleChange("shopifyClientId", e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="shopifyApiSecret">API Secret Key</Label>
            <Input
              id="shopifyApiSecret"
              type="password"
              placeholder="shpss_..."
              value={settings.shopifyApiSecret || ""}
              onChange={(e) => handleChange("shopifyApiSecret", e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="shopifyAccessToken">Admin API Access Token</Label>
            <Input
              id="shopifyAccessToken"
              type="password"
              placeholder="shpat_..."
              value={settings.shopifyAccessToken || ""}
              onChange={(e) => handleChange("shopifyAccessToken", e.target.value)}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Token được cấp tự động sau khi kết nối OAuth.
            </p>
          </div>
        </CardContent>
        <CardFooter className="flex flex-wrap justify-between gap-2 border-t p-4 bg-gray-50/50">
          <div className="flex flex-wrap gap-2">
            <Button
              variant="default"
              className="bg-gray-900 hover:bg-gray-800"
              onClick={() => {
                window.location.href = `/api/auth/shopify?shop=${settings.shopifyStoreDomain || ""}`;
              }}
            >
              Kết nối Shopify (OAuth)
            </Button>
            <Button variant="outline" onClick={() => syncShopify("products")} disabled={syncing}>
              <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
              Sync Sản phẩm
            </Button>
            <Button variant="outline" onClick={() => syncShopify("orders")} disabled={syncing}>
              <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
              Sync Đơn hàng
            </Button>
          </div>
          <Button onClick={handleSave} disabled={saving} className="bg-gray-900 hover:bg-gray-800">
            {saving ? "Đang lưu..." : "Lưu"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
