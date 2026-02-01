"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { CalendarDays, Building2, Users, BarChart3, FileText, FileCog, PanelLeftClose, PanelLeft } from "lucide-react"

const navItems = [
  // Section 1: Organizations, Events & Visitors
  {
    label: "Manage Organizations",
    href: "/admin/organizations",
    icon: Building2,
  },
  {
    label: "Manage Events",
    href: "/admin/events",
    icon: CalendarDays,
  },
  {
    label: "Manage Visitors",
    href: "/admin/visitors",
    icon: Users,
    sectionEnd: true,
  },
  // Section 2: Dashboard
  {
    label: "Dashboard",
    href: "/admin/reports",
    icon: BarChart3,
    sectionEnd: true,
  },
  // Section 3: Documents
  {
    label: "Documents",
    href: "/admin/documents",
    icon: FileText,
  },
  {
    label: "Document Types",
    href: "/admin/document-types",
    icon: FileCog,
  },
]

export function AdminSidebar() {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)

  return (
    <aside
      className={cn(
        "flex flex-col border-r bg-background transition-all duration-200",
        collapsed ? "w-16" : "w-64"
      )}
    >
      <div className="flex items-center justify-between p-4 border-b">
        {!collapsed && (
          <h2 className="font-semibold text-sm text-white/90 uppercase tracking-wider">
            Administration
          </h2>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? (
            <PanelLeft className="h-4 w-4" />
          ) : (
            <PanelLeftClose className="h-4 w-4" />
          )}
        </Button>
      </div>
      <nav className="flex-1 p-2">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href)
          return (
            <div key={item.href}>
              <Link
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-white/90 hover:bg-muted hover:text-muted-foreground"
                )}
                title={collapsed ? item.label : undefined}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </Link>
              {item.sectionEnd && (
                <div className="my-4 flex justify-center">
                  <div className="w-[60%] border-t border-muted-foreground/50" />
                </div>
              )}
            </div>
          )
        })}
      </nav>
    </aside>
  )
}
