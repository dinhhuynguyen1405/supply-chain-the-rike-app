"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  LayoutDashboard, ShoppingCart, TrendingUp, Package,
  Users, Boxes, ShoppingBag, Truck, ClipboardList,
  Wallet, Search, Settings, Factory, BarChart3,
  Building2, Link2,
} from "lucide-react";

interface SearchResult {
  id: string;
  type: "product" | "purchase" | "supplier";
  title: string;
  subtitle?: string;
  href: string;
}

const PAGES = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/orders", label: "Đơn Shopify", icon: ShoppingBag },
  { href: "/research", label: "Nghiên cứu giá", icon: Search },
  { href: "/purchases", label: "Thu mua", icon: ShoppingCart },
  { href: "/production", label: "Sản xuất & Đóng gói", icon: Factory },
  { href: "/shipments", label: "Lô vận chuyển", icon: Truck },
  { href: "/inventory", label: "Tồn kho", icon: Boxes },
  { href: "/fulfillment", label: "Lệnh đóng hàng", icon: ClipboardList },
  { href: "/products", label: "Sản phẩm", icon: Package },
  { href: "/suppliers", label: "Nhà cung cấp", icon: Users },
  { href: "/sales", label: "Bán hàng", icon: TrendingUp },
  { href: "/fund", label: "Sổ quỹ", icon: Wallet },
  { href: "/bros-fees", label: "Phí kho Bros", icon: Building2 },
  { href: "/restock", label: "Phân tích mua thêm", icon: BarChart3 },
  { href: "/analytics", label: "Lợi nhuận & COGS", icon: TrendingUp },
  { href: "/links", label: "Liên kết", icon: Link2 },
  { href: "/settings", label: "Cài đặt", icon: Settings },
];

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // Cmd+K / Ctrl+K shortcut
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  // Search API
  const search = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setResults(Array.isArray(data) ? data : []);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => search(query), 250);
    return () => clearTimeout(t);
  }, [query, search]);

  function navigate(href: string) {
    setOpen(false);
    setQuery("");
    setResults([]);
    router.push(href);
  }

  const filteredPages = query.trim()
    ? PAGES.filter((p) => p.label.toLowerCase().includes(query.toLowerCase()))
    : PAGES;

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-400 shadow-sm hover:border-gray-300 hover:text-gray-600 transition-colors"
      >
        <Search className="h-3.5 w-3.5" />
        <span className="hidden sm:block">Tìm kiếm...</span>
        <kbd className="hidden sm:flex items-center gap-0.5 rounded border border-gray-200 bg-gray-50 px-1.5 py-0.5 text-[10px] text-gray-400">
          <span className="text-[11px]">⌘</span>K
        </kbd>
      </button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput
          placeholder="Tìm sản phẩm, đơn hàng, nhà cung cấp..."
          value={query}
          onValueChange={setQuery}
        />
        <CommandList>
          {loading && (
            <div className="flex items-center justify-center py-4">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-gray-700" />
            </div>
          )}

          {!loading && results.length === 0 && query.trim() && (
            <CommandEmpty>Không tìm thấy kết quả cho &quot;{query}&quot;</CommandEmpty>
          )}

          {/* DB search results */}
          {results.length > 0 && (
            <>
              {results.filter((r) => r.type === "product").length > 0 && (
                <CommandGroup heading="Sản phẩm">
                  {results.filter((r) => r.type === "product").map((r) => (
                    <CommandItem key={r.id} onSelect={() => navigate(r.href)}>
                      <Package className="mr-2 h-4 w-4 text-gray-400" />
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">{r.title}</span>
                        {r.subtitle && <span className="text-xs text-gray-400">{r.subtitle}</span>}
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}

              {results.filter((r) => r.type === "purchase").length > 0 && (
                <CommandGroup heading="Đơn thu mua">
                  {results.filter((r) => r.type === "purchase").map((r) => (
                    <CommandItem key={r.id} onSelect={() => navigate(r.href)}>
                      <ShoppingCart className="mr-2 h-4 w-4 text-gray-400" />
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">{r.title}</span>
                        {r.subtitle && <span className="text-xs text-gray-400">{r.subtitle}</span>}
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}

              {results.filter((r) => r.type === "supplier").length > 0 && (
                <CommandGroup heading="Nhà cung cấp">
                  {results.filter((r) => r.type === "supplier").map((r) => (
                    <CommandItem key={r.id} onSelect={() => navigate(r.href)}>
                      <Users className="mr-2 h-4 w-4 text-gray-400" />
                      <span className="text-sm font-medium">{r.title}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}

              <CommandSeparator />
            </>
          )}

          {/* Page navigation */}
          <CommandGroup heading="Điều hướng">
            {filteredPages.map(({ href, label, icon: Icon }) => (
              <CommandItem key={href} onSelect={() => navigate(href)}>
                <Icon className="mr-2 h-4 w-4 text-gray-400" />
                <span>{label}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}
