"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, ShoppingCart, TrendingUp, Package,
  Users, Link2, Boxes, ShoppingBag, Truck,
  ClipboardList, Wallet, Search, Settings, Factory,
  ChevronRight, BarChart3, GitCompareArrows, Building2,
} from "lucide-react";
import { cn } from "@/lib/utils";

const PIPELINE_STEPS: { href: string; icon: React.ElementType; label: string; step: number | null }[] = [
  { href: "/orders",     icon: ShoppingBag,  label: "Đơn Shopify",         step: null },
  { href: "/research",   icon: Search,       label: "Nghiên cứu giá",      step: 1 },
  { href: "/purchases",  icon: ShoppingCart, label: "Thu mua",             step: 2 },
  { href: "/production", icon: Factory,      label: "Sản xuất & Đóng gói", step: 3 },
  { href: "/shipments",  icon: Truck,        label: "Lô vận chuyển",       step: 4 },
];

const WAREHOUSE_ITEMS: { href: string; icon: React.ElementType; label: string }[] = [
  { href: "/inventory",      icon: Boxes,               label: "Tồn kho" },
  { href: "/reconciliation", icon: GitCompareArrows,    label: "So khớp tồn kho" },
  { href: "/fulfillment",    icon: ClipboardList,       label: "Lệnh đóng hàng" },
  { href: "/products",       icon: Package,             label: "Sản phẩm" },
  { href: "/suppliers",      icon: Users,               label: "Nhà cung cấp" },
];

const FINANCE_ITEMS: { href: string; icon: React.ElementType; label: string }[] = [
  { href: "/sales",     icon: TrendingUp,  label: "Bán hàng" },
  { href: "/fund",      icon: Wallet,      label: "Sổ quỹ" },
  { href: "/bros-fees", icon: Building2,   label: "Phí kho Bros" },
  { href: "/restock",   icon: BarChart3,   label: "Phân tích mua thêm" },
];

const TOOLS_ITEMS: { href: string; icon: React.ElementType; label: string }[] = [
  { href: "/links",   icon: Link2,    label: "Liên kết" },
  { href: "/settings",icon: Settings, label: "Cài đặt" },
];

function NavItem({
  href, icon: Icon, label, active, step,
}: {
  href: string; icon: React.ElementType; label: string; active: boolean; step?: number | null;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-all",
        active
          ? "bg-green-50 text-green-700"
          : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
      )}
    >
      {step != null ? (
        <span className={cn(
          "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
          active ? "bg-green-600 text-white" : "bg-gray-200 text-gray-500"
        )}>
          {step}
        </span>
      ) : (
        <Icon className={cn("h-4 w-4 shrink-0", active ? "text-green-600" : "text-gray-400")} />
      )}
      <span className="truncate flex-1">{label}</span>
      {active && <ChevronRight className="h-3 w-3 text-green-500 shrink-0" />}
    </Link>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-3 pt-5 pb-1.5 text-[10px] font-semibold uppercase tracking-widest text-gray-400">
      {children}
    </p>
  );
}

export function Sidebar() {
  const pathname = usePathname();

  function isActive(href: string) {
    return pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
  }

  return (
    <aside className="flex h-full w-60 flex-col border-r border-gray-200 bg-white">
      {/* Logo */}
      <Link
        href="/dashboard"
        className="flex h-16 items-center gap-3 border-b border-gray-200 px-5 hover:bg-gray-50 transition-colors"
      >
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-green-500 to-emerald-700 shadow-sm shrink-0">
          <span className="text-base font-bold text-white">R</span>
        </div>
        <div>
          <p className="text-sm font-bold text-gray-900">The Rike</p>
          <p className="text-[11px] font-medium text-gray-400">Supply Chain</p>
        </div>
      </Link>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-2">
        {/* Dashboard */}
        <div className="pt-2 pb-1">
          <Link
            href="/dashboard"
            className={cn(
              "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-all",
              isActive("/dashboard")
                ? "bg-green-50 text-green-700"
                : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
            )}
          >
            <LayoutDashboard className={cn("h-4 w-4 shrink-0", isActive("/dashboard") ? "text-green-600" : "text-gray-400")} />
            <span className="flex-1">Dashboard</span>
            {isActive("/dashboard") && <ChevronRight className="h-3 w-3 text-green-500 shrink-0" />}
          </Link>
        </div>

        {/* VN → US Pipeline */}
        <SectionLabel>VN → US · Pipeline</SectionLabel>
        <div className="space-y-0.5">
          {PIPELINE_STEPS.map(({ href, icon, label, step }) => (
            <NavItem key={href} href={href} icon={icon} label={label} active={isActive(href)} step={step} />
          ))}
        </div>

        {/* Kho & Giao hàng */}
        <SectionLabel>Kho &amp; Giao hàng</SectionLabel>
        <div className="space-y-0.5">
          {WAREHOUSE_ITEMS.map(({ href, icon, label }) => (
            <NavItem key={href} href={href} icon={icon} label={label} active={isActive(href)} />
          ))}
        </div>

        {/* Tài chính */}
        <SectionLabel>Tài chính</SectionLabel>
        <div className="space-y-0.5">
          {FINANCE_ITEMS.map(({ href, icon, label }) => (
            <NavItem key={href} href={href} icon={icon} label={label} active={isActive(href)} />
          ))}
        </div>

        {/* Tools & Cài đặt */}
        <SectionLabel>Tools &amp; Cài đặt</SectionLabel>
        <div className="space-y-0.5">
          {TOOLS_ITEMS.map(({ href, icon, label }) => (
            <NavItem key={href} href={href} icon={icon} label={label} active={isActive(href)} />
          ))}
        </div>
      </nav>

      {/* Footer */}
      <div className="border-t border-gray-200 p-3">
        <p className="px-3 text-[10px] text-gray-400">VN → US Supply Chain</p>
      </div>
    </aside>
  );
}
