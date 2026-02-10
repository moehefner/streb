"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FileText,
  Video,
  Mail,
  Zap,
  BarChart3,
  Settings,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { name: "Overview", href: "/dashboard", icon: LayoutDashboard },
  { name: "Posts", href: "/dashboard/posts", icon: FileText },
  { name: "Videos", href: "/dashboard/videos", icon: Video },
  { name: "Outreach", href: "/dashboard/outreach", icon: Mail },
  { name: "AutoPilot", href: "/dashboard/autopilot", icon: Zap },
  { name: "Analytics", href: "/dashboard/analytics", icon: BarChart3 },
  { name: "Settings", href: "/dashboard/settings", icon: Settings },
];

export function DashboardSidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-60 flex-col border-r border-[#282828] bg-[#0A0A0A]">
      <div className="flex h-16 items-center px-6 border-b border-[#282828]">
        <Link href="/dashboard" className="flex items-center gap-2">
          <svg
            className="h-7 w-7 text-white"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
          </svg>
          <span className="text-xl font-bold tracking-tight text-white">
            Streb
          </span>
        </Link>
      </div>
      <nav className="flex-1 space-y-1 px-3 py-4">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors",
                isActive
                  ? "bg-[#282828] text-white"
                  : "text-white hover:bg-[#1A1A1A]"
              )}
            >
              <item.icon className="h-5 w-5" />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-[#282828] p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#282828]">
            <User className="h-5 w-5 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-white">
              John Doe
            </p>
            <p className="truncate text-xs text-white">john@example.com</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
