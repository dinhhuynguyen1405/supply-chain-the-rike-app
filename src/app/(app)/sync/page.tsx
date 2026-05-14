"use client";

import { useRef, useState } from "react";
import { Upload, RefreshCw, Clock, DatabaseZap } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ImportResult {
  ok: boolean;
  total: number;
  created: number;
  updated: number;
  skipped: number;
  oldestOrder: string | null;
  newestOrder: string | null;
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function formatDate(iso: string | null): string {
  if (!iso) return "–";
  return new Date(iso).toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SyncPage() {
  // CSV import state
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // API sync state
  const [syncingRecent, setSyncingRecent] = useState(false);
  const [syncingFull, setSyncingFull] = useState(false);

  // ── CSV import ─────────────────────────────────────────────────────────────

  async function handleImport() {
    if (!csvFile) {
      toast.error("Vui lòng chọn file CSV trước");
      return;
    }

    setImporting(true);
    setImportResult(null);

    try {
      const form = new FormData();
      form.append("file", csvFile);

      const res = await fetch("/api/sync/shopify/import-csv", {
        method: "POST",
        body: form,
      });

      const data = (await res.json()) as ImportResult & { error?: string };

      if (!res.ok || data.error) {
        toast.error(data.error ?? "Import thất bại");
        return;
      }

      setImportResult(data);
      toast.success(`Đã nhập ${data.total} đơn hàng từ CSV`);
    } catch (err) {
      toast.error("Lỗi kết nối: " + String(err));
    } finally {
      setImporting(false);
    }
  }

  // ── API sync ───────────────────────────────────────────────────────────────

  async function handleSyncRecent() {
    setSyncingRecent(true);
    try {
      const res = await fetch("/api/sync/shopify?type=orders", { method: "POST" });
      const data = (await res.json()) as { success?: boolean; count?: number; error?: string };
      if (!res.ok || data.error) {
        toast.error(data.error ?? "Sync thất bại");
      } else {
        toast.success(`Đã sync ${data.count ?? 0} đơn hàng gần đây`);
      }
    } catch (err) {
      toast.error("Lỗi kết nối: " + String(err));
    } finally {
      setSyncingRecent(false);
    }
  }

  async function handleSyncFull() {
    setSyncingFull(true);
    try {
      const res = await fetch("/api/sync/shopify/full-history", { method: "POST" });
      const data = (await res.json()) as { success?: boolean; count?: number; error?: string };
      if (!res.ok || data.error) {
        toast.error(data.error ?? "Sync thất bại");
      } else {
        toast.success(`Đã sync toàn bộ ${data.count ?? 0} đơn hàng`);
      }
    } catch (err) {
      toast.error("Lỗi kết nối: " + String(err));
    } finally {
      setSyncingFull(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-2xl space-y-8 p-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">
          Đồng bộ &amp; Nhập dữ liệu
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Nhập lịch sử đơn hàng từ file CSV hoặc đồng bộ trực tiếp qua Shopify API.
        </p>
      </div>

      {/* ── Section 1: CSV import ───────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Upload className="h-4 w-4 text-gray-500" />
            Nhập lịch sử đơn hàng Shopify (CSV)
          </CardTitle>
          <CardDescription>
            Tải toàn bộ đơn hàng cũ vào hệ thống để phân tích restock.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-5">
          {/* Instructions */}
          <ol className="list-decimal space-y-1.5 pl-5 text-sm text-gray-600">
            <li>
              Vào{" "}
              <span className="font-medium text-gray-800">Shopify Admin → Orders</span>
            </li>
            <li>
              Bấm{" "}
              <span className="font-medium text-gray-800">Export</span> → chọn{" "}
              <span className="font-medium text-gray-800">"All orders"</span> và{" "}
              <span className="font-medium text-gray-800">
                "CSV for Excel, Numbers, or other spreadsheet programs"
              </span>
            </li>
            <li>Tải file CSV về máy</li>
            <li>Upload vào đây</li>
          </ol>

          {/* File picker */}
          <div className="flex items-center gap-3">
            <Input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              className="flex-1"
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                setCsvFile(f);
                setImportResult(null);
              }}
            />
            <Button
              onClick={handleImport}
              disabled={!csvFile || importing}
            >
              {importing ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Đang nhập…
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Import
                </>
              )}
            </Button>
          </div>

          {/* Result card */}
          {importResult && (
            <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm">
              <p className="font-semibold text-green-800">
                Import thành công — {importResult.total} đơn hàng
              </p>
              <ul className="mt-2 space-y-0.5 text-green-700">
                <li>Tạo mới: {importResult.created}</li>
                <li>Cập nhật: {importResult.updated}</li>
                <li>Bỏ qua (đã có từ API): {importResult.skipped}</li>
              </ul>
              {(importResult.oldestOrder || importResult.newestOrder) && (
                <p className="mt-2 flex items-center gap-1.5 text-green-700">
                  <Clock className="h-3.5 w-3.5" />
                  Khoảng thời gian:{" "}
                  <span className="font-medium">
                    {formatDate(importResult.oldestOrder)} →{" "}
                    {formatDate(importResult.newestOrder)}
                  </span>
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Section 2: API sync ─────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <DatabaseZap className="h-4 w-4 text-gray-500" />
            Đồng bộ Shopify API
          </CardTitle>
          <CardDescription>
            Kéo đơn hàng mới nhất hoặc toàn bộ lịch sử trực tiếp từ Shopify.
          </CardDescription>
        </CardHeader>

        <CardContent className="flex flex-wrap gap-3">
          <Button
            variant="outline"
            onClick={handleSyncRecent}
            disabled={syncingRecent}
          >
            {syncingRecent ? (
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Sync đơn hàng gần đây
          </Button>

          <Button
            variant="outline"
            onClick={handleSyncFull}
            disabled={syncingFull}
          >
            {syncingFull ? (
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <DatabaseZap className="mr-2 h-4 w-4" />
            )}
            Sync toàn bộ lịch sử API
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
