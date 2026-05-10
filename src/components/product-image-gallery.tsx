"use client";
/**
 * ProductImageGallery — Quản lý ảnh listing/thumbnail qua Google Drive URL.
 *
 * Workflow:
 * 1. Upload ảnh lên Google Drive → share "Anyone with the link"
 * 2. Copy link → paste vào ô input → bấm Thêm
 * 3. App tự chuyển link → embed URL và lưu vào DB
 */
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  Plus, Trash2, ExternalLink, GripVertical,
  ImageOff, Link2,
} from "lucide-react";

interface ProductImage {
  id: string;
  url: string;
  driveUrl: string | null;
  altText: string | null;
  sortOrder: number;
  type: string;
}

interface Props {
  productId: string;
  type?: "listing" | "thumbnail";
  label?: string;
  maxImages?: number;
}

export function ProductImageGallery({
  productId,
  type = "listing",
  label = "Ảnh Listing",
  maxImages = 12,
}: Props) {
  const [images, setImages] = useState<ProductImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [driveInput, setDriveInput] = useState("");
  const [altInput, setAltInput] = useState("");
  const [adding, setAdding] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const dragIdx = useRef<number | null>(null);

  async function load() {
    try {
      const res = await fetch(`/api/products/${productId}/images`);
      const data: ProductImage[] = await res.json();
      setImages(data.filter((img) => img.type === type));
    } catch {
      toast.error("Không tải được ảnh");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [productId, type]);

  async function handleAdd() {
    if (!driveInput.trim()) { toast.error("Vui lòng paste link Google Drive"); return; }
    setAdding(true);
    try {
      const res = await fetch(`/api/products/${productId}/images`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ driveUrl: driveInput.trim(), type, altText: altInput.trim() || null }),
      });
      if (!res.ok) { const err = await res.json(); toast.error(err.error ?? "Lỗi khi thêm ảnh"); return; }
      toast.success("Đã thêm ảnh");
      setDriveInput(""); setAltInput(""); setShowAdd(false);
      await load();
    } catch { toast.error("Lỗi kết nối"); }
    finally { setAdding(false); }
  }

  async function handleDelete(imageId: string) {
    if (!confirm("Xoá ảnh này?")) return;
    try {
      await fetch(`/api/products/${productId}/images?imageId=${imageId}`, { method: "DELETE" });
      toast.success("Đã xoá");
      setImages((p) => p.filter((img) => img.id !== imageId));
    } catch { toast.error("Lỗi khi xoá"); }
  }

  function onDragStart(idx: number) { dragIdx.current = idx; }

  async function onDrop(targetIdx: number) {
    if (dragIdx.current === null || dragIdx.current === targetIdx) return;
    const reordered = [...images];
    const [moved] = reordered.splice(dragIdx.current, 1);
    reordered.splice(targetIdx, 0, moved);
    setImages(reordered);
    dragIdx.current = null;
    try {
      await fetch(`/api/products/${productId}/images`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order: reordered.map((img) => img.id) }),
      });
    } catch { toast.error("Lỗi khi lưu thứ tự"); await load(); }
  }

  if (loading) {
    return (
      <div className="flex h-20 items-center justify-center">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-green-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-gray-700">{label}</p>
          <p className="text-xs text-gray-400">{images.length}/{maxImages} ảnh · kéo để sắp xếp thứ tự</p>
        </div>
        {images.length < maxImages && (
          <Button size="sm" variant="outline" onClick={() => setShowAdd((v) => !v)} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" /> Thêm ảnh
          </Button>
        )}
      </div>

      {showAdd && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-3 space-y-2">
          <p className="text-xs font-medium text-green-800 flex items-center gap-1.5">
            <Link2 className="h-3.5 w-3.5" />
            Paste link Google Drive (file phải share &quot;Anyone with the link&quot;)
          </p>
          <Input
            placeholder="https://drive.google.com/file/d/..."
            value={driveInput}
            onChange={(e) => setDriveInput(e.target.value)}
            className="bg-white text-sm font-mono"
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            autoFocus
          />
          <Input
            placeholder="Mô tả ảnh (tuỳ chọn)"
            value={altInput}
            onChange={(e) => setAltInput(e.target.value)}
            className="bg-white text-sm"
          />
          <div className="flex gap-2 justify-end">
            <Button size="sm" variant="ghost"
              onClick={() => { setShowAdd(false); setDriveInput(""); setAltInput(""); }}>
              Huỷ
            </Button>
            <Button size="sm" className="bg-green-600 hover:bg-green-700"
              onClick={handleAdd} disabled={adding || !driveInput.trim()}>
              {adding ? "Đang thêm..." : "Thêm"}
            </Button>
          </div>
        </div>
      )}

      {images.length === 0 ? (
        <div className="flex h-24 flex-col items-center justify-center rounded-lg border border-dashed border-gray-200 text-gray-300 gap-1">
          <ImageOff className="h-6 w-6" />
          <p className="text-xs">Chưa có ảnh — thêm bằng link Google Drive</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
          {images.map((img, idx) => (
            <div
              key={img.id}
              draggable
              onDragStart={() => onDragStart(idx)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => onDrop(idx)}
              className="group relative aspect-square rounded-lg border border-gray-200 bg-gray-50 overflow-hidden cursor-grab active:cursor-grabbing hover:border-gray-300 transition-colors"
            >
              <div className="absolute top-1 left-1 z-10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                <GripVertical className="h-3.5 w-3.5 text-white drop-shadow" />
              </div>
              <div className="absolute top-1 right-1 z-10 bg-black/50 text-white text-[9px] font-bold rounded px-1 leading-4">
                {idx + 1}
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.url}
                alt={img.altText ?? `Ảnh ${idx + 1}`}
                className="h-full w-full object-cover"
                onError={(e) => {
                  const el = e.currentTarget;
                  el.style.display = "none";
                  const fallback = el.parentElement?.querySelector(".img-fallback");
                  if (fallback) fallback.classList.remove("hidden");
                }}
              />
              <div className="img-fallback hidden absolute inset-0 flex flex-col items-center justify-center bg-gray-100 p-1 gap-0.5">
                <ImageOff className="h-4 w-4 text-gray-300" />
                <p className="text-[9px] text-gray-400 text-center leading-tight">Chưa share public</p>
              </div>
              <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-black/60 px-1.5 py-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {img.driveUrl && (
                  <a href={img.driveUrl} target="_blank" rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="text-white/80 hover:text-white transition-colors" title="Mở Drive">
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
                <button onClick={() => handleDelete(img.id)}
                  className="ml-auto text-white/80 hover:text-red-300 transition-colors" title="Xoá">
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
