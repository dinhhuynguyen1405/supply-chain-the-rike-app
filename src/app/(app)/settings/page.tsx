"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
      toast.success(`Đã đồng bộ ${data.count} ${type === "products" ? "sản phẩm" : "đơn hàng"}`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Lỗi đồng bộ");
    } finally {
      setSyncing(false);
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
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Đang lưu..." : "Lưu"}
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
        <CardFooter className="flex justify-between border-t p-4 bg-gray-50/50">
          <div className="flex flex-wrap gap-2">
            <Button
              variant="default"
              className="bg-green-600 hover:bg-green-700"
              onClick={() => {
                window.location.href = `/api/auth/shopify?shop=${settings.shopifyStoreDomain || ""}`;
              }}
            >
              Kết nối Shopify (OAuth)
            </Button>
            <Button variant="outline" onClick={() => syncShopify("products")} disabled={syncing}>
              {syncing ? "Đang đồng bộ..." : "Đồng bộ Sản phẩm"}
            </Button>
            <Button variant="outline" onClick={() => syncShopify("orders")} disabled={syncing}>
              {syncing ? "Đang đồng bộ..." : "Đồng bộ Đơn hàng"}
            </Button>
          </div>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Đang lưu..." : "Lưu"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
