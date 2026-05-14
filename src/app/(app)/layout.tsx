import { SidebarClient } from "@/components/sidebar-client";
import { GlobalSearch } from "@/components/global-search";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-[oklch(0.99_0.003_75)]">
      <SidebarClient />
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar with search */}
        <header className="flex h-11 shrink-0 items-center justify-end border-b border-gray-200/80 bg-[oklch(0.99_0.003_75)] px-6">
          <GlobalSearch />
        </header>
        <main className="flex-1 overflow-y-auto">
          {/* Notion-like: generous top padding, max-width centered */}
          <div className="mx-auto max-w-5xl px-8 py-10">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
