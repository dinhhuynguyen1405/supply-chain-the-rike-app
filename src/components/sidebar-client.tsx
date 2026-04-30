"use client";
import dynamic from "next/dynamic";

// ssr: false phải nằm trong Client Component — không được dùng ở Server Component
const Sidebar = dynamic(
  () => import("@/components/sidebar").then((m) => ({ default: m.Sidebar })),
  {
    ssr: false,
    loading: () => <div className="w-60 shrink-0 border-r border-gray-200 bg-white" />,
  }
);

export function SidebarClient() {
  return <Sidebar />;
}
