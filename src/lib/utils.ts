import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatVND(amount: number): string {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatUSD(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(date));
}

export const STATUS_LABELS: Record<string, string> = {
  draft: "Nháp",
  confirmed: "Đã xác nhận",
  shipping: "Đang vận chuyển",
  arrived: "Đã đến nơi",
  completed: "Hoàn thành",
  cancelled: "Đã hủy",
};

export const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  confirmed: "bg-blue-100 text-blue-700",
  shipping: "bg-amber-100 text-amber-700",
  arrived: "bg-purple-100 text-purple-700",
  completed: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
};

export function generateOrderCode(): string {
  const now = new Date();
  const y = now.getFullYear().toString().slice(-2);
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const rand = Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, "0");
  return `PO${y}${m}${d}-${rand}`;
}

export function generateShipmentCode(): string {
  const d = new Date();
  const date = d.toISOString().slice(0, 10).replace(/-/g, "");
  const rand = Math.floor(Math.random() * 900) + 100;
  return `SHP-${date}-${rand}`;
}

export function generateFulfillmentCode(): string {
  const d = new Date();
  const date = d.toISOString().slice(0, 10).replace(/-/g, "");
  const rand = Math.floor(Math.random() * 900) + 100;
  return `PACK-${date}-${rand}`;
}

export function generateProductionCode(): string {
  const d = new Date();
  const date = d.toISOString().slice(0, 10).replace(/-/g, "");
  const rand = Math.floor(Math.random() * 900) + 100;
  return `PROD-${date}-${rand}`;
}

/**
 * Tính số gói dự kiến từ số lượng mua.
 *
 * Có 2 cơ chế:
 * 1. Theo trọng lượng (weight-based):
 *    - gramsPerUnit = số gram/gói bán (VD: 200g/gói)
 *    - unit = "kg": plannedQty = quantity × 1000 ÷ gramsPerUnit
 *    - unit = "g":  plannedQty = quantity ÷ gramsPerUnit
 *
 * 2. Theo số lượng (count-based):
 *    - piecesPerUnit = số hạt/cái trong 1 đơn vị MUA (VD: 1 lạng = 1000 hạt)
 *    - piecesPerPack = số hạt/cái trong 1 gói BÁN (VD: 150 hạt/gói)
 *    - plannedQty = quantity × piecesPerUnit ÷ piecesPerPack
 *    VD: 5 lạng × 1000 hạt/lạng ÷ 150 hạt/gói = 33 gói
 */
export function calcPlannedQty(
  quantity: number,
  unit: string,
  gramsPerUnit: number | null,
  piecesPerUnit?: number | null,
  piecesPerPack?: number | null,
): number {
  // Count-based (ưu tiên nếu cả hai đều có)
  if (piecesPerUnit && piecesPerPack) {
    return Math.floor((quantity * piecesPerUnit) / piecesPerPack);
  }
  // Weight-based
  if (gramsPerUnit && unit === "kg") return Math.floor((quantity * 1000) / gramsPerUnit);
  if (gramsPerUnit && unit === "g")  return Math.floor(quantity / gramsPerUnit);
  return quantity;
}
