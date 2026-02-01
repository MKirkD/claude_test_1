"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { CalendarDays, Building2, Users, BarChart3, FileText, FileCog, PanelLeftClose, PanelLeft, ChevronDown, ChevronRight, ClipboardList } from "lucide-react"

type NavItem = {
  label: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  sectionEnd?: boolean
  children?: NavItem[]
}

const navItems: NavItem[] = [
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
    href: "/admin/dashboard",
    icon: BarChart3,
    sectionEnd: true,
    children: [
      {
        label: "Reports",
        href: "/admin/dashboard/reports",
        icon: ClipboardList,
      },
    ],
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
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set(["/admin/dashboard"]))

  const toggleExpanded = (href: string) => {
    setExpandedItems((prev) => {
      const next = new Set(prev)
      if (next.has(href)) {
        next.delete(href)
      } else {
        next.add(href)
      }
      return next
    })
  }

  const renderNavItem = (item: NavItem, isChild = false) => {
    const isExactActive = pathname === item.href
    const isActive = isExactActive || (item.children && pathname.startsWith(item.href))
    const isExpanded = expandedItems.has(item.href)
    const hasChildren = item.children && item.children.length > 0

    return (
      <div key={item.href}>
        {hasChildren ? (
          <>
            <div
              className={cn(
                "flex items-center rounded-md text-sm font-medium transition-colors",
                isExactActive
                  ? "bg-primary text-primary-foreground"
                  : "text-white/90 hover:bg-muted hover:text-muted-foreground",
                isChild && "pl-5"
              )}
            >
              <Link
                href={item.href}
                className="flex items-center gap-3 flex-1 px-3 py-2"
                title={collapsed ? item.label : undefined}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </Link>
              {!collapsed && (
                <button
                  onClick={() => toggleExpanded(item.href)}
                  className="px-2 py-2 hover:bg-white/10 rounded-r-md"
                >
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </button>
              )}
            </div>
            {!collapsed && isExpanded && item.children && (
              <div className="mt-1">
                {item.children.map((child) => renderNavItem(child, true))}
              </div>
            )}
          </>
        ) : (
          <Link
            href={item.href}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              isActive
                ? "bg-primary text-primary-foreground"
                : "text-white/90 hover:bg-muted hover:text-muted-foreground",
              isChild && "pl-8"
            )}
            title={collapsed ? item.label : undefined}
          >
            <item.icon className="h-4 w-4 shrink-0" />
            {!collapsed && <span>{item.label}</span>}
          </Link>
        )}
        {item.sectionEnd && !isChild && (
          <div className="my-4 flex justify-center">
            <div className="w-[60%] border-t border-muted-foreground/50" />
          </div>
        )}
      </div>
    )
  }

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
        {navItems.map((item) => renderNavItem(item))}
      </nav>
    </aside>
  )
}
