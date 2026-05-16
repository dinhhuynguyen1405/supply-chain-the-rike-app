"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, ShoppingCart, TrendingUp, Package,
  Users, Link2, Boxes, ShoppingBag, Truck,
  ClipboardList, Wallet, Search, Settings, Factory,
  BarChart3, Building2, DatabaseZap,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Nav structure ────────────────────────────────────────────────────────────

const PIPELINE: { href: string; icon: React.ElementType; label: string; step?: number }[] = [
  { href: "/orders",     icon: ShoppingBag,  label: "Đơn Shopify" },
  { href: "/research",   icon: Search,       label: "Nghiên cứu giá",      step: 1 },
  { href: "/purchases",  icon: ShoppingCart, label: "Thu mua",             step: 2 },
  { href: "/production", icon: Factory,      label: "Sản xuất & Đóng gói", step: 3 },
  { href: "/shipments",  icon: Truck,        label: "Lô vận chuyển",       step: 4 },
];

const WAREHOUSE: { href: string; icon: React.ElementType; label: string }[] = [
  { href: "/inventory",           icon: Boxes,            label: "Tồn kho" },
  { href: "/fulfillment",         icon: ClipboardList,    label: "Lệnh đóng hàng" },
  { href: "/products",            icon: Package,          label: "Sản phẩm" },
  { href: "/suppliers",           icon: Users,            label: "Nhà cung cấp" },
];

const FINANCE: { href: string; icon: React.ElementType; label: string }[] = [
  { href: "/sales",     icon: TrendingUp, label: "Bán hàng" },
  { href: "/fund",      icon: Wallet,     label: "Sổ quỹ" },
  { href: "/bros-fees", icon: Building2,  label: "Phí kho Bros" },
  { href: "/restock",   icon: BarChart3,  label: "Phân tích mua thêm" },
  { href: "/analytics", icon: TrendingUp, label: "Lợi nhuận & COGS" },
];

const TOOLS: { href: string; icon: React.ElementType; label: string }[] = [
  { href: "/sync",     icon: DatabaseZap, label: "Đồng bộ" },
  { href: "/links",    icon: Link2,    label: "Liên kết" },
  { href: "/settings", icon: Settings, label: "Cài đặt" },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-5 mb-0.5 px-2.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-gray-400/80 select-none">
      {children}
    </p>
  );
}

function NavItem({
  href, icon: Icon, label, active, step,
}: {
  href: string; icon: React.ElementType; label: string; active: boolean; step?: number;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group flex items-center gap-2 rounded-md px-2.5 py-[5px] text-sm transition-colors",
        active
          ? "bg-black/[0.06] text-gray-900 font-medium"
          : "text-gray-500 hover:bg-black/[0.04] hover:text-gray-800"
      )}
    >
      {step != null ? (
        <span className={cn(
          "flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full text-[9px] font-bold",
          active ? "bg-gray-900 text-white" : "bg-gray-200 text-gray-500"
        )}>
          {step}
        </span>
      ) : (
        <Icon className={cn(
          "h-[15px] w-[15px] shrink-0 transition-colors",
          active ? "text-gray-800" : "text-gray-400 group-hover:text-gray-600"
        )} />
      )}
      <span className="truncate flex-1 leading-none">{label}</span>
    </Link>
  );
}

// ─── Main Sidebar ─────────────────────────────────────────────────────────────

export function Sidebar() {
  const pathname = usePathname();

  function isActive(href: string) {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname === href || pathname.startsWith(href + "/");
  }

  return (
    <aside className="flex h-full w-56 shrink-0 flex-col border-r border-gray-200/80 bg-[oklch(0.975_0.003_75)]">

      {/* Logo */}
      <Link
        href="/dashboard"
        className="flex h-14 items-center gap-2.5 px-4 hover:bg-black/[0.03] transition-colors"
      >
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gray-900 shrink-0">
          <span className="text-[13px] font-bold text-white">R</span>
        </div>
        <div className="leading-tight">
          <p className="text-[13px] font-semibold text-gray-900">The Rike</p>
          <p className="text-[10px] text-gray-400">Supply Chain</p>
        </div>
      </Link>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 pb-4">

        {/* Dashboard */}
        <div className="mt-2">
          <Link
            href="/dashboard"
            className={cn(
              "group flex items-center gap-2 rounded-md px-2.5 py-[5px] text-sm transition-colors",
              isActive("/dashboard")
                ? "bg-black/[0.06] text-gray-900 font-medium"
                : "text-gray-500 hover:bg-black/[0.04] hover:text-gray-800"
            )}
          >
            <LayoutDashboard className={cn(
              "h-[15px] w-[15px] shrink-0",
              isActive("/dashboard") ? "text-gray-800" : "text-gray-400 group-hover:text-gray-600"
            )} />
            <span className="leading-none">Dashboard</span>
          </Link>
        </div>

        {/* Pipeline */}
        <SectionLabel>VN → US</SectionLabel>
        <div className="space-y-px">
          {PIPELINE.map(({ href, icon, label, step }) => (
            <NavItem key={href} href={href} icon={icon} label={label} active={isActive(href)} step={step} />
          ))}
        </div>

        {/* Warehouse */}
        <SectionLabel>Kho &amp; Giao hàng</SectionLabel>
        <div className="space-y-px">
          {WAREHOUSE.map(({ href, icon, label }) => (
            <NavItem key={href} href={href} icon={icon} label={label} active={isActive(href)} />
          ))}
        </div>

        {/* Finance */}
        <SectionLabel>Tài chính</SectionLabel>
        <div className="space-y-px">
          {FINANCE.map(({ href, icon, label }) => (
            <NavItem key={href} href={href} icon={icon} label={label} active={isActive(href)} />
          ))}
        </div>

        {/* Tools */}
        <SectionLabel>Công cụ</SectionLabel>
        <div className="space-y-px">
          {TOOLS.map(({ href, icon, label }) => (
            <NavItem key={href} href={href} icon={icon} label={label} active={isActive(href)} />
          ))}
        </div>
      </nav>

      {/* Footer */}
      <div className="border-t border-gray-200/80 px-4 py-3">
        <p className="text-[10px] text-gray-400">VN → US · v1.0</p>
      </div>
    </aside>
  );
}
