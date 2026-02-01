"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Search, X, Download, Play, FileSpreadsheet, Loader2 } from "lucide-react"
import ExcelJS from "exceljs"

interface ReportDefinition {
  id: string
  name: string
  description: string
}

interface ReportColumn {
  key: string
  label: string
}

interface ReportResult {
  columns: ReportColumn[]
  data: Record<string, unknown>[]
}

const availableReports: ReportDefinition[] = [
  {
    id: "visitors-by-event",
    name: "Visitors by Event",
    description: "List all visitors assigned to each event with their confirmation status",
  },
  {
    id: "events-by-organization",
    name: "Events by Organization",
    description: "List all events grouped by organization with visitor counts",
  },
  {
    id: "document-confirmations",
    name: "Document Confirmations",
    description: "List all document confirmations by visitor and event",
  },
]

export default function ReportsPage() {
  const [selectedReport, setSelectedReport] = useState<ReportDefinition | null>(null)
  const [reportResult, setReportResult] = useState<ReportResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState("")
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({})

  const handleRunReport = async (report: ReportDefinition) => {
    setSelectedReport(report)
    setLoading(true)
    setSearch("")
    setColumnFilters({})
    setReportResult(null)

    // Placeholder report data - this will be replaced with actual Supabase queries
    await new Promise(resolve => setTimeout(resolve, 500))

    let result: ReportResult

    switch (report.id) {
      case "visitors-by-event":
        result = {
          columns: [
            { key: "event_name", label: "Event Name" },
            { key: "event_date", label: "Event Date" },
            { key: "organization", label: "Organization" },
            { key: "visitor_name", label: "Visitor Name" },
            { key: "email", label: "Email" },
            { key: "status", label: "Status" },
          ],
          data: [],
        }
        break
      case "events-by-organization":
        result = {
          columns: [
            { key: "organization", label: "Organization" },
            { key: "event_name", label: "Event Name" },
            { key: "start_date", label: "Start Date" },
            { key: "end_date", label: "End Date" },
            { key: "assigned_visitors", label: "Assigned Visitors" },
            { key: "confirmed_visitors", label: "Confirmed Visitors" },
          ],
          data: [],
        }
        break
      case "document-confirmations":
        result = {
          columns: [
            { key: "visitor_name", label: "Visitor Name" },
            { key: "event_name", label: "Event Name" },
            { key: "document_name", label: "Document Name" },
            { key: "confirmed_at", label: "Confirmed At" },
            { key: "version", label: "Version" },
          ],
          data: [],
        }
        break
      default:
        result = { columns: [], data: [] }
    }

    setReportResult(result)
    setLoading(false)
  }

  // Get unique values for each column for filtering
  const filterOptions = useMemo(() => {
    if (!reportResult) return {}

    const options: Record<string, string[]> = {}
    reportResult.columns.forEach(col => {
      const values = [...new Set(reportResult.data.map(row => String(row[col.key] ?? "")))]
      options[col.key] = values.filter(v => v !== "").sort()
    })
    return options
  }, [reportResult])

  // Apply search and filters to data
  const filteredData = useMemo(() => {
    if (!reportResult) return []

    return reportResult.data.filter(row => {
      // Apply column filters
      for (const [key, value] of Object.entries(columnFilters)) {
        if (value && String(row[key] ?? "") !== value) {
          return false
        }
      }

      // Apply search
      if (search) {
        const term = search.toLowerCase()
        const matches = Object.values(row).some(val =>
          String(val ?? "").toLowerCase().includes(term)
        )
        if (!matches) return false
      }

      return true
    })
  }, [reportResult, search, columnFilters])

  const handleDownloadExcel = async () => {
    if (!reportResult || !selectedReport) return

    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet(selectedReport.name)

    // Add headers
    const headerRow = worksheet.addRow(reportResult.columns.map(col => col.label))
    headerRow.font = { bold: true }
    headerRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE0E0E0" },
    }

    // Add data
    filteredData.forEach(row => {
      worksheet.addRow(reportResult.columns.map(col => row[col.key] ?? ""))
    })

    // Auto-fit columns
    worksheet.columns.forEach(column => {
      let maxLength = 10
      column.eachCell?.({ includeEmpty: true }, (cell) => {
        const cellLength = cell.value ? String(cell.value).length : 0
        maxLength = Math.max(maxLength, cellLength)
      })
      column.width = Math.min(maxLength + 2, 50)
    })

    // Generate filename with date
    const date = new Date()
    const dateStr = `${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}${date.getFullYear()}`
    const filename = `${selectedReport.name.replace(/\s+/g, "_")}_${dateStr}.xlsx`

    // Download
    const buffer = await workbook.xlsx.writeBuffer()
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  const clearFilters = () => {
    setSearch("")
    setColumnFilters({})
  }

  const hasActiveFilters = search || Object.values(columnFilters).some(v => v)

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Reports</h1>

      {/* Report List */}
      <Card className="mb-6">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Available Reports</CardTitle>
          <p className="text-sm text-muted-foreground">Select a report to run</p>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {availableReports.map((report) => (
              <div
                key={report.id}
                className={`flex items-center justify-between p-4 rounded-lg border ${
                  selectedReport?.id === report.id ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                }`}
              >
                <div className="flex items-center gap-3">
                  <FileSpreadsheet className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">{report.name}</p>
                    <p className="text-sm text-muted-foreground">{report.description}</p>
                  </div>
                </div>
                <Button
                  onClick={() => handleRunReport(report)}
                  disabled={loading}
                  variant={selectedReport?.id === report.id ? "default" : "outline"}
                  size="sm"
                >
                  {loading && selectedReport?.id === report.id ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Running...
                    </>
                  ) : (
                    <>
                      <Play className="mr-2 h-4 w-4" />
                      Run
                    </>
                  )}
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Report Results */}
      {selectedReport && reportResult && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">{selectedReport.name}</CardTitle>
                <p className="text-sm text-muted-foreground">
                  {filteredData.length} {filteredData.length === 1 ? "record" : "records"}
                  {hasActiveFilters && ` (filtered from ${reportResult.data.length})`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {hasActiveFilters && (
                  <Button variant="ghost" size="sm" onClick={clearFilters}>
                    <X className="mr-2 h-4 w-4" />
                    Clear Filters
                  </Button>
                )}
                <Button onClick={handleDownloadExcel} disabled={filteredData.length === 0}>
                  <Download className="mr-2 h-4 w-4" />
                  Download Excel
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Search and Filters */}
            <div className="flex flex-wrap gap-4 mb-4">
              <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search all columns..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 pr-9"
                />
                {search && (
                  <button
                    onClick={() => setSearch("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              {reportResult.columns.slice(0, 3).map((col) => (
                filterOptions[col.key]?.length > 0 && (
                  <select
                    key={col.key}
                    className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    value={columnFilters[col.key] || ""}
                    onChange={(e) => setColumnFilters(prev => ({ ...prev, [col.key]: e.target.value }))}
                  >
                    <option value="">All {col.label}</option>
                    {filterOptions[col.key].map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                )
              ))}
            </div>

            {/* Results Table */}
            {filteredData.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {reportResult.data.length === 0
                  ? "No data available for this report."
                  : "No results match your filters."}
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      {reportResult.columns.map((col) => (
                        <th key={col.key} className="px-4 py-3 text-left font-medium">
                          {col.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredData.map((row, idx) => (
                      <tr key={idx} className="border-b last:border-0 hover:bg-muted/30">
                        {reportResult.columns.map((col) => (
                          <td key={col.key} className="px-4 py-3">
                            {String(row[col.key] ?? "—")}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
