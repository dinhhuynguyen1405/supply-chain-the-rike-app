"use client";
/**
 * BarcodeGenerator
 * Tạo barcode (Code128) + QR code từ SKU, hỗ trợ download PNG.
 */
import { useEffect, useRef, useState } from "react";
import JsBarcode from "jsbarcode";
import QRCode from "qrcode";
import { Download, Copy, Check } from "lucide-react";

interface Props {
  sku: string;
  label?: string; // tên sản phẩm hiển thị dưới barcode
}

type Mode = "barcode" | "qr";

export function BarcodeGenerator({ sku, label }: Props) {
  const [mode, setMode] = useState<Mode>("barcode");
  const [copied, setCopied] = useState(false);
  const barcodeRef = useRef<SVGSVGElement>(null);
  const qrRef = useRef<HTMLCanvasElement>(null);

  // Render barcode
  useEffect(() => {
    if (mode !== "barcode" || !barcodeRef.current || !sku) return;
    try {
      JsBarcode(barcodeRef.current, sku, {
        format: "CODE128",
        lineColor: "#111827",
        background: "#ffffff",
        width: 2,
        height: 64,
        displayValue: true,
        text: sku,
        fontOptions: "bold",
        fontSize: 13,
        textMargin: 6,
        margin: 12,
      });
    } catch {
      // Invalid SKU format for barcode
    }
  }, [sku, mode]);

  // Render QR
  useEffect(() => {
    if (mode !== "qr" || !qrRef.current || !sku) return;
    QRCode.toCanvas(qrRef.current, sku, {
      width: 200,
      margin: 2,
      color: { dark: "#111827", light: "#ffffff" },
    }).catch(() => {});
  }, [sku, mode]);

  function downloadBarcode() {
    if (mode === "barcode") {
      // SVG → PNG via canvas
      const svg = barcodeRef.current;
      if (!svg) return;
      const xml = new XMLSerializer().serializeToString(svg);
      const img = new Image();
      const svgBlob = new Blob([xml], { type: "image/svg+xml" });
      const url = URL.createObjectURL(svgBlob);
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.width * 2;
        canvas.height = img.height * 2;
        const ctx = canvas.getContext("2d")!;
        ctx.scale(2, 2);
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        URL.revokeObjectURL(url);
        canvas.toBlob((blob) => {
          if (!blob) return;
          const a = document.createElement("a");
          a.href = URL.createObjectURL(blob);
          a.download = `barcode-${sku}.png`;
          a.click();
        }, "image/png");
      };
      img.src = url;
    } else {
      // QR canvas → PNG
      const canvas = qrRef.current;
      if (!canvas) return;
      // Tạo canvas mới với label
      const out = document.createElement("canvas");
      out.width = canvas.width + 40;
      out.height = canvas.height + (label ? 50 : 40);
      const ctx = out.getContext("2d")!;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, out.width, out.height);
      ctx.drawImage(canvas, 20, 20);
      if (label) {
        ctx.fillStyle = "#111827";
        ctx.font = "bold 13px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(
          label.length > 28 ? label.slice(0, 28) + "…" : label,
          out.width / 2,
          canvas.height + 38
        );
      }
      out.toBlob((blob) => {
        if (!blob) return;
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `qr-${sku}.png`;
        a.click();
      }, "image/png");
    }
  }

  async function copySku() {
    await navigator.clipboard.writeText(sku);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  if (!sku) return null;

  return (
    <div className="space-y-3">
      {/* Tab switcher */}
      <div className="flex items-center gap-1 rounded-lg border border-gray-200 bg-gray-50 p-0.5 w-fit">
        {(["barcode", "qr"] as Mode[]).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`rounded-md px-3 py-1 text-xs font-medium transition-all ${
              mode === m
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {m === "barcode" ? "Barcode" : "QR Code"}
          </button>
        ))}
      </div>

      {/* Preview */}
      <div className="flex items-center justify-center rounded-xl border border-gray-200 bg-white p-4 min-h-[120px]">
        {mode === "barcode" ? (
          <svg ref={barcodeRef} className="max-w-full" />
        ) : (
          <canvas ref={qrRef} className="rounded" />
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={downloadBarcode}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-all"
        >
          <Download className="h-3.5 w-3.5" />
          Tải PNG
        </button>
        <button
          onClick={copySku}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-all"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "Đã copy!" : "Copy SKU"}
        </button>
      </div>
    </div>
  );
}
