"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CheckCircle2, XCircle, RefreshCw, ExternalLink,
  ShoppingCart, Package, Factory, Ship, BarChart3, Zap,
} from "lucide-react";

const SHEET_ID = process.env.NEXT_PUBLIC_GOOGLE_SPREADSHEET_ID ?? "";
const SHEET_URL = SHEET_ID
  ? `https://docs.google.com/spreadsheets/d/${SHEET_ID}`
  : null;

const AUTO_SYNC_FLOWS = [
  {
    icon: <ShoppingCart className="h-4 w-4 text-blue-500" />,
    label: "Thu mua",
    tab: "Tab: Thu mua",
    triggers: ["Tạo đơn mua", "Cập nhật đơn", "Ghi nhận thanh toán"],
  },
  {
    icon: <Package className="h-4 w-4 text-orange-500" />,
    label: "Sản phẩm",
    tab: "Tab: Sản phẩm",
    triggers: ["Thêm sản phẩm", "Sửa sản phẩm", "Xoá sản phẩm"],
  },
  {
    icon: <Factory className="h-4 w-4 text-purple-500" />,
    label: "Sản xuất",
    tab: "Tab: Sản xuất",
    triggers: ["Hoàn thành lô sản xuất (done)"],
  },
  {
    icon: <Ship className="h-4 w-4 text-cyan-500" />,
    label: "Lô vận chuyển VN→US",
    tab: "Tab: Inbound Information",
    triggers: ["Tạo lô shipment", "Cập nhật trạng thái", "Lô hoàn tất → tự động cộng kho"],
  },
  {
    icon: <BarChart3 className="h-4 w-4 text-green-500" />,
    label: "Bán hàng (FBM)",
    tab: "Tab: FBM Order",
    triggers: ["Tạo đơn FBM", "Cập nhật trạng thái đơn"],
  },
  {
    icon: <Zap className="h-4 w-4 text-orange-500" />,
    label: "Kho Nhung",
    tab: "Tab: Kho Nhung",
    triggers: ["Cập nhật nhungQty", "Nhung xác nhận ship", "Lô hàng đến kho Nhung"],
  },
  {
    icon: <Zap className="h-4 w-4 text-purple-500" />,
    label: "Đơn Kho Nhung",
    tab: "Tab: Đơn Kho Nhung",
    triggers: ["Tạo lệnh đóng hàng", "Thông báo kho", "Kho xác nhận ship"],
  },
];

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
  const [googleConnected, setGoogleConnected] = useState<boolean | null>(null);
  const [syncingSheets, setSyncingSheets] = useState(false);

  useEffect(() => {
    fetch("/api/settings")
      .then((res) => res.json())
      .then((data) => {
        setSettings((prev) => ({ ...prev, ...data }));
        setGoogleConnected(!!data.googleRefreshToken);
      })
      .catch(() => toast.error("Không thể tải cài đặt"));

    const params = new URLSearchParams(window.location.search);
    if (params.get("auth") === "success") {
      toast.success("Kết nối tài khoản Shopify thành công!");
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const syncSheets = async (target: string) => {
    setSyncingSheets(true);
    try {
      const res = await fetch("/api/sync/sheets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Lỗi sync");
      toast.success(`Đã sync: ${data.synced?.join(", ")}`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Lỗi sync Google Sheets");
    } finally {
      setSyncingSheets(false);
    }
  };

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
      if (!res.ok) throw new Error("Save disabled");
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
      toast.success(`Đã đồng bộ ${data.count} ${type === "products" ? "sản phẩm mới" : "đơn hàng"}`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Lỗi đồng bộ");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Cài đặt hệ thống</h1>
      </div>

      {/* ── Google Sheet Quick Access ── */}
      {SHEET_URL && (
        <Card className="border-green-200 bg-gradient-to-r from-green-50 to-emerald-50">
          <CardContent className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              {/* Google Sheets icon */}
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow-sm border border-green-100">
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none">
                  <rect x="3" y="2" width="18" height="20" rx="2" fill="#34A853" />
                  <rect x="6" y="7" width="12" height="1.5" rx="0.75" fill="white" opacity="0.9" />
                  <rect x="6" y="10.5" width="12" height="1.5" rx="0.75" fill="white" opacity="0.9" />
                  <rect x="6" y="14" width="8" height="1.5" rx="0.75" fill="white" opacity="0.9" />
                  <rect x="3" y="6" width="18" height="0.5" fill="white" opacity="0.3" />
                </svg>
              </div>
              <div>
                <p className="font-semibold text-gray-800 text-sm">Google Sheet Database</p>
                <p className="text-xs text-gray-500 font-mono mt-0.5 truncate max-w-[260px]">
                  ID: {SHEET_ID}
                </p>
              </div>
            </div>
            <a
              href={SHEET_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 transition-colors shadow-sm"
            >
              Mở Sheet
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </CardContent>
        </Card>
      )}

      {/* ── Thông số chung ── */}
      <Card>
        <CardHeader>
          <CardTitle>Chung</CardTitle>
          <CardDescription>Cấu hình các thông số chung của hệ thống.</CardDescription>
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
            {saving ? "Đang lưu..." : "Lưu cài đặt"}
          </Button>
        </CardFooter>
      </Card>

      {/* ── Google Sheets Sync ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Kết nối & Đồng bộ Google Sheets
            {googleConnected && (
              <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                <CheckCircle2 className="h-3 w-3" /> Đã kết nối
              </span>
            )}
          </CardTitle>
          <CardDescription>
            Mọi thao tác nhập liệu sẽ tự động cập nhật vào Google Sheet ngay lập tức.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">

          {/* Status row */}
          <div className="flex items-center gap-3 rounded-lg border p-3">
            {googleConnected === null ? (
              <div className="h-4 w-4 rounded-full bg-gray-200 animate-pulse" />
            ) : googleConnected ? (
              <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
            ) : (
              <XCircle className="h-5 w-5 text-red-400 shrink-0" />
            )}
            <div className="flex-1">
              <p className="text-sm font-medium">
                {googleConnected === null
                  ? "Đang kiểm tra..."
                  : googleConnected
                  ? "Google Account đã được uỷ quyền"
                  : "Chưa kết nối — nhấn Kết nối Google để cấp quyền"}
              </p>
              {!googleConnected && googleConnected !== null && (
                <p className="text-xs text-gray-500 mt-0.5">
                  Sau khi kết nối, token sẽ tự lưu vào database.
                </p>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open("/api/auth/google", "_blank")}
            >
              {googleConnected ? "Cấp lại quyền" : "Kết nối Google"}
            </Button>
          </div>

          {/* Auto-sync flow info */}
          <div className="rounded-lg border bg-gray-50 p-3 space-y-2">
            <div className="flex items-center gap-1.5 mb-2">
              <Zap className="h-4 w-4 text-amber-500" />
              <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Auto-sync — Nhập liệu là tự động lên Sheet</span>
            </div>
            <div className="space-y-2">
              {AUTO_SYNC_FLOWS.map((flow) => (
                <div key={flow.label} className="flex items-start gap-2">
                  <div className="mt-0.5 shrink-0">{flow.icon}</div>
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-medium text-gray-700">{flow.label}</span>
                    <span className="mx-1.5 text-gray-300">·</span>
                    <span className="text-xs text-gray-400">{flow.tab}</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {flow.triggers.map((t) => (
                        <span key={t} className="rounded bg-white border px-1.5 py-0.5 text-[11px] text-gray-500">
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Manual sync buttons */}
          {googleConnected && (
            <div className="space-y-2">
              <p className="text-xs text-gray-500">
                Hoặc đẩy thủ công toàn bộ dữ liệu nếu cần đồng bộ lại từ đầu:
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  onClick={() => syncSheets("all")}
                  disabled={syncingSheets}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${syncingSheets ? "animate-spin" : ""}`} />
                  {syncingSheets ? "Đang sync..." : "Sync tất cả lên Sheet"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => syncSheets("bros_inventory")}
                  disabled={syncingSheets}
                  className="border-purple-200 text-purple-700 hover:bg-purple-50"
                >
                  <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${syncingSheets ? "animate-spin" : ""}`} />
                  Copy kho Bros → Sheet
                </Button>
                {SHEET_URL && (
                  <a
                    href={SHEET_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Mở Google Sheet
                  </a>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Shopify ── */}
      <Card>
        <CardHeader>
          <CardTitle>Kết nối Shopify</CardTitle>
          <CardDescription>Cấu hình API kết nối tới cửa hàng Shopify.</CardDescription>
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
            <Label htmlFor="shopifyApiSecret">API Secret Key (shpss_...)</Label>
            <Input
              id="shopifyApiSecret"
              type="password"
              placeholder="shpss_..."
              value={settings.shopifyApiSecret || ""}
              onChange={(e) => handleChange("shopifyApiSecret", e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="shopifyAccessToken">Admin API Access Token (shpat_...)</Label>
            <Input
              id="shopifyAccessToken"
              type="password"
              placeholder="shpat_..."
              value={settings.shopifyAccessToken || ""}
              onChange={(e) => handleChange("shopifyAccessToken", e.target.value)}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Hệ thống sẽ tự động cấp mã này sau khi bạn kết nối thành công.
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
              Đồng bộ Sản phẩm
            </Button>
            <Button variant="outline" onClick={() => syncShopify("orders")} disabled={syncing}>
              Đồng bộ Đơn hàng
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
