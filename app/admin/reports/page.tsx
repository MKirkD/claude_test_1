"use client"

import { BarChart3 } from "lucide-react"

export default function ReportsPage() {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Reports</h1>
      </div>
      <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
        <BarChart3 className="h-12 w-12 mb-4" />
        <p className="text-lg font-medium">Coming Soon</p>
        <p className="text-sm mt-1">Reports and analytics will be available here.</p>
      </div>
    </div>
  )
}
