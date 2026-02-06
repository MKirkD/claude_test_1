"use client"

import { useEffect, useState, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Plus, Pencil, Search, X, CalendarDays, Download, Upload, Loader2, Trash2 } from "lucide-react"
import ExcelJS from "exceljs"

interface UploadError {
  row: number
  firstName: string
  lastName: string
  reason: string
}

interface UploadResult {
  total: number
  success: number
  errors: UploadError[]
}

interface Visitor {
  id: string
  first_name: string
  last_name: string
  email: string | null
  phone: string | null
  company_id: string | null
  profile_id: string | null
  company?: { name: string } | null
  event_count?: number
}

interface Company {
  id: string
  name: string
}

interface Event {
  id: string
  name: string
  start_date: string | null
  end_date: string | null
  location: string | null
}

interface EventVisitor {
  event_id: string
}

const emptyForm = {
  first_name: "",
  last_name: "",
  email: "",
  phone: "",
  company_id: "",
  event_id: "",
}

export default function ManageVisitorsPage() {
  const [visitors, setVisitors] = useState<Visitor[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Visitor | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  // Event assignment state
  const [assignDialogOpen, setAssignDialogOpen] = useState(false)
  const [assigningVisitor, setAssigningVisitor] = useState<Visitor | null>(null)
  const [allEvents, setAllEvents] = useState<Event[]>([])
  const [selectedEventIds, setSelectedEventIds] = useState<Set<string>>(new Set())
  const [eventSearch, setEventSearch] = useState("")
  const [savingAssignments, setSavingAssignments] = useState(false)

  // Upload state
  const [uploading, setUploading] = useState(false)
  const [uploadResultDialogOpen, setUploadResultDialogOpen] = useState(false)
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null)

  // Selection and delete state
  const [selectedVisitorIds, setSelectedVisitorIds] = useState<Set<string>>(new Set())
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const supabase = createClient()

  const fetchVisitors = useCallback(async () => {
    const { data: visitorsData } = await supabase
      .from("visitors")
      .select("*, company:companies(name)")
      .order("last_name")

    if (visitorsData) {
      // Fetch event counts for each visitor
      const { data: countsData } = await supabase
        .from("event_visitors")
        .select("visitor_id")

      const countMap: Record<string, number> = {}
      countsData?.forEach((ev) => {
        countMap[ev.visitor_id] = (countMap[ev.visitor_id] || 0) + 1
      })

      const visitorsWithCounts = visitorsData.map((visitor) => ({
        ...visitor,
        event_count: countMap[visitor.id] || 0,
      }))

      setVisitors(visitorsWithCounts)
    }
    setLoading(false)
  }, [supabase])

  const fetchCompanies = useCallback(async () => {
    const { data } = await supabase
      .from("companies")
      .select("id, name")
      .order("name")

    if (data) setCompanies(data)
  }, [supabase])

  const fetchAllEvents = useCallback(async () => {
    const { data } = await supabase
      .from("events")
      .select("id, name, start_date, end_date, location")
      .order("start_date", { ascending: true })

    if (data) setAllEvents(data)
  }, [supabase])

  useEffect(() => {
    void fetchVisitors() // eslint-disable-line react-hooks/set-state-in-effect
    void fetchCompanies()
    void fetchAllEvents()
  }, [fetchVisitors, fetchCompanies, fetchAllEvents])

  const filteredVisitors = visitors.filter((visitor) => {
    const term = search.toLowerCase()
    const fullName = `${visitor.first_name} ${visitor.last_name}`.toLowerCase()
    return (
      fullName.includes(term) ||
      visitor.first_name.toLowerCase().includes(term) ||
      visitor.last_name.toLowerCase().includes(term) ||
      (visitor.email?.toLowerCase().includes(term) ?? false) ||
      (visitor.phone?.toLowerCase().includes(term) ?? false) ||
      (visitor.company?.name?.toLowerCase().includes(term) ?? false)
    )
  })

  const filteredEvents = allEvents.filter((event) => {
    const term = eventSearch.toLowerCase()
    return (
      event.name.toLowerCase().includes(term) ||
      (event.location?.toLowerCase().includes(term) ?? false)
    )
  })

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm)
    setMessage(null)
    setDialogOpen(true)
  }

  const openEdit = (visitor: Visitor) => {
    setEditing(visitor)
    setForm({
      first_name: visitor.first_name,
      last_name: visitor.last_name,
      email: visitor.email || "",
      phone: visitor.phone || "",
      company_id: visitor.company_id || "",
      event_id: "",
    })
    setMessage(null)
    setDialogOpen(true)
  }

  const openAssignEvents = async (visitor: Visitor) => {
    setAssigningVisitor(visitor)
    setEventSearch("")
    setMessage(null)

    // Fetch current events for this visitor
    const { data: visitorEvents } = await supabase
      .from("event_visitors")
      .select("event_id")
      .eq("visitor_id", visitor.id)

    const currentIds = new Set<string>(
      (visitorEvents as EventVisitor[] | null)?.map((ev) => ev.event_id) || []
    )
    setSelectedEventIds(currentIds)
    setAssignDialogOpen(true)
  }

  const toggleEvent = (eventId: string) => {
    setSelectedEventIds((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(eventId)) {
        newSet.delete(eventId)
      } else {
        newSet.add(eventId)
      }
      return newSet
    })
  }

  const selectAll = () => {
    setSelectedEventIds(new Set(filteredEvents.map((e) => e.id)))
  }

  const deselectAll = () => {
    setSelectedEventIds(new Set())
  }

  const handleSaveAssignments = async () => {
    if (!assigningVisitor) return

    setSavingAssignments(true)
    setMessage(null)

    // Delete all existing assignments for this visitor
    const { error: deleteError } = await supabase
      .from("event_visitors")
      .delete()
      .eq("visitor_id", assigningVisitor.id)

    if (deleteError) {
      setMessage({ type: "error", text: deleteError.message })
      setSavingAssignments(false)
      return
    }

    // Insert new assignments
    if (selectedEventIds.size > 0) {
      const newAssignments = Array.from(selectedEventIds).map((eventId) => ({
        event_id: eventId,
        visitor_id: assigningVisitor.id,
        rsvp_status: "invited",
      }))

      const { error: insertError } = await supabase
        .from("event_visitors")
        .insert(newAssignments)

      if (insertError) {
        setMessage({ type: "error", text: insertError.message })
        setSavingAssignments(false)
        return
      }
    }

    setMessage({ type: "success", text: "Events assigned successfully" })
    setSavingAssignments(false)
    setAssignDialogOpen(false)
    fetchVisitors()
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setMessage(null)

    const payload = {
      first_name: form.first_name,
      last_name: form.last_name,
      email: form.email || null,
      phone: form.phone || null,
      company_id: form.company_id || null,
    }

    if (editing) {
      const { error } = await supabase
        .from("visitors")
        .update(payload)
        .eq("id", editing.id)

      if (error) {
        setMessage({ type: "error", text: error.message })
      } else {
        // If an event was selected, assign the visitor to it
        if (form.event_id) {
          const { error: eventError } = await supabase
            .from("event_visitors")
            .upsert({
              visitor_id: editing.id,
              event_id: form.event_id,
              rsvp_status: "invited",
            }, {
              onConflict: "visitor_id,event_id",
            })

          if (eventError) {
            setMessage({ type: "error", text: `Visitor updated but event assignment failed: ${eventError.message}` })
            setSaving(false)
            return
          }
        }
        setMessage({ type: "success", text: "Visitor updated" })
        setDialogOpen(false)
        fetchVisitors()
      }
    } else {
      const { data: newVisitor, error } = await supabase
        .from("visitors")
        .insert(payload)
        .select("id")
        .single()

      if (error) {
        setMessage({ type: "error", text: error.message })
      } else if (newVisitor && form.event_id) {
        // Create event_visitors entry for the assigned event
        const { error: eventError } = await supabase
          .from("event_visitors")
          .insert({
            visitor_id: newVisitor.id,
            event_id: form.event_id,
            rsvp_status: "invited",
          })

        if (eventError) {
          setMessage({ type: "error", text: `Visitor created but event assignment failed: ${eventError.message}` })
        } else {
          setMessage({ type: "success", text: "Visitor created" })
          setDialogOpen(false)
          fetchVisitors()
        }
      } else {
        setMessage({ type: "success", text: "Visitor created" })
        setDialogOpen(false)
        fetchVisitors()
      }
    }

    setSaving(false)
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return ""
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
  }

  const downloadTemplate = async () => {
    const workbook = new ExcelJS.Workbook()
    workbook.creator = "West Creek Ranch"
    workbook.created = new Date()

    // Main data sheet
    const worksheet = workbook.addWorksheet("Visitors")

    // Define columns
    worksheet.columns = [
      { header: "First Name", key: "first_name", width: 20 },
      { header: "Last Name", key: "last_name", width: 20 },
      { header: "Email", key: "email", width: 30 },
      { header: "Phone", key: "phone", width: 20 },
      { header: "Organization", key: "organization", width: 30 },
      { header: "Event", key: "event", width: 40 },
    ]

    // Style the header row
    const headerRow = worksheet.getRow(1)
    headerRow.font = { bold: true }
    headerRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE0E0E0" },
    }

    // Create a hidden sheet for dropdown values
    const lookupSheet = workbook.addWorksheet("_Lookups")
    lookupSheet.state = "veryHidden"

    // Add organization names to lookup sheet
    const orgNames = companies.map((c) => c.name)
    orgNames.forEach((name, index) => {
      lookupSheet.getCell(`A${index + 1}`).value = name
    })

    // Add event names with dates to lookup sheet
    const eventNames = allEvents.map((e) => `${e.name} (${formatDate(e.start_date)})`)
    eventNames.forEach((name, index) => {
      lookupSheet.getCell(`B${index + 1}`).value = name
    })

    // Add data validation for Organization column (column E)
    // Apply to rows 2 through 1000 (enough for bulk import)
    if (orgNames.length > 0) {
      for (let row = 2; row <= 1000; row++) {
        worksheet.getCell(`E${row}`).dataValidation = {
          type: "list",
          allowBlank: true,
          formulae: [`'_Lookups'!$A$1:$A$${orgNames.length}`],
          showErrorMessage: true,
          errorTitle: "Invalid Organization",
          error: "Please select an organization from the dropdown list.",
        }
      }
    }

    // Add data validation for Event column (column F)
    if (eventNames.length > 0) {
      for (let row = 2; row <= 1000; row++) {
        worksheet.getCell(`F${row}`).dataValidation = {
          type: "list",
          allowBlank: true,
          formulae: [`'_Lookups'!$B$1:$B$${eventNames.length}`],
          showErrorMessage: true,
          errorTitle: "Invalid Event",
          error: "Please select an event from the dropdown list.",
        }
      }
    }

    // Add data validation for Phone column (column D) - format 000-000-0000
    for (let row = 2; row <= 1000; row++) {
      worksheet.getCell(`D${row}`).dataValidation = {
        type: "custom",
        allowBlank: true,
        formulae: [`AND(LEN(D${row})=12,MID(D${row},4,1)="-",MID(D${row},8,1)="-",ISNUMBER(VALUE(SUBSTITUTE(D${row},"-",""))))`],
        showErrorMessage: true,
        errorTitle: "Invalid Phone Format",
        error: "Please enter phone number in format: 000-000-0000",
      }
    }

    // Add a few empty rows to show the structure
    for (let i = 0; i < 10; i++) {
      worksheet.addRow({})
    }

    // Generate filename with current date and incremented counter
    const now = new Date()
    const mm = String(now.getMonth() + 1).padStart(2, "0")
    const dd = String(now.getDate()).padStart(2, "0")
    const yyyy = now.getFullYear()
    const dateKey = `${mm}${dd}${yyyy}`

    // Get or initialize download counter for today
    const storageKey = "wcr_template_download"
    const stored = localStorage.getItem(storageKey)
    let counter = 1

    if (stored) {
      const { date, count } = JSON.parse(stored)
      if (date === dateKey) {
        counter = count + 1
      }
    }

    // Save updated counter
    localStorage.setItem(storageKey, JSON.stringify({ date: dateKey, count: counter }))

    const filename = `WCR_Visitor_Template_${dateKey}_${counter}.xlsx`

    // Generate and download the file
    const buffer = await workbook.xlsx.writeBuffer()
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Reset file input so same file can be selected again
    event.target.value = ""

    setUploading(true)
    setUploadResult(null)

    try {
      const buffer = await file.arrayBuffer()
      const workbook = new ExcelJS.Workbook()
      await workbook.xlsx.load(buffer)

      const worksheet = workbook.getWorksheet("Visitors")
      if (!worksheet) {
        setUploadResult({
          total: 0,
          success: 0,
          errors: [{ row: 0, firstName: "", lastName: "", reason: "Invalid file format. The file must have a 'Visitors' worksheet. Please download the template and use the correct format." }],
        })
        setUploadResultDialogOpen(true)
        setUploading(false)
        return
      }

      // Validate header row
      const headerRow = worksheet.getRow(1)
      const expectedHeaders = ["First Name", "Last Name", "Email", "Phone", "Organization", "Event"]
      const headers: string[] = []
      headerRow.eachCell((cell, colNumber) => {
        headers[colNumber - 1] = String(cell.value || "").trim()
      })

      const headersMatch = expectedHeaders.every((h, i) => headers[i] === h)
      if (!headersMatch) {
        setUploadResult({
          total: 0,
          success: 0,
          errors: [{ row: 0, firstName: "", lastName: "", reason: "Invalid file format. Column headers do not match the expected template. Please download the template and use the correct format." }],
        })
        setUploadResultDialogOpen(true)
        setUploading(false)
        return
      }

      // Build lookup maps for organizations and events
      const orgMap = new Map(companies.map((c) => [c.name.toLowerCase(), c.id]))
      const eventMap = new Map(
        allEvents.map((e) => {
          const eventLabel = `${e.name} (${formatDate(e.start_date)})`.toLowerCase()
          return [eventLabel, e.id]
        })
      )

      const errors: UploadError[] = []
      let successCount = 0
      let totalRows = 0

      // Helper to extract text from cell (handles hyperlinks, rich text, etc.)
      const getCellText = (cell: ExcelJS.Cell): string => {
        const value = cell.value
        if (value === null || value === undefined) return ""
        if (typeof value === "string") return value.trim()
        if (typeof value === "number") return String(value)
        // Handle hyperlink objects (e.g., email addresses)
        if (typeof value === "object" && "text" in value) {
          return String(value.text || "").trim()
        }
        // Handle rich text
        if (typeof value === "object" && "richText" in value) {
          const richText = value.richText as Array<{ text: string }>
          return richText.map((r) => r.text).join("").trim()
        }
        return String(value).trim()
      }

      // Process each data row (starting from row 2)
      for (let rowNum = 2; rowNum <= worksheet.rowCount; rowNum++) {
        const row = worksheet.getRow(rowNum)
        const firstName = getCellText(row.getCell(1))
        const lastName = getCellText(row.getCell(2))
        const email = getCellText(row.getCell(3))
        const phone = getCellText(row.getCell(4))
        const orgName = getCellText(row.getCell(5))
        const eventName = getCellText(row.getCell(6))

        // Skip completely empty rows
        if (!firstName && !lastName && !email && !phone && !orgName && !eventName) {
          continue
        }

        totalRows++

        // Validate required fields
        const missingFields: string[] = []
        if (!firstName) missingFields.push("First Name")
        if (!lastName) missingFields.push("Last Name")
        if (!email) missingFields.push("Email")
        if (!orgName) missingFields.push("Organization")
        if (!eventName) missingFields.push("Event")

        if (missingFields.length > 0) {
          errors.push({
            row: rowNum,
            firstName: firstName || "(empty)",
            lastName: lastName || "(empty)",
            reason: `Missing required fields: ${missingFields.join(", ")}`,
          })
          continue
        }

        // Lookup organization
        const companyId = orgMap.get(orgName.toLowerCase())
        if (!companyId) {
          errors.push({
            row: rowNum,
            firstName,
            lastName,
            reason: `Organization "${orgName}" not found`,
          })
          continue
        }

        // Lookup event
        const eventId = eventMap.get(eventName.toLowerCase())
        if (!eventId) {
          errors.push({
            row: rowNum,
            firstName,
            lastName,
            reason: `Event "${eventName}" not found`,
          })
          continue
        }

        // Validate phone format if provided
        if (phone && !/^\d{3}-\d{3}-\d{4}$/.test(phone)) {
          errors.push({
            row: rowNum,
            firstName,
            lastName,
            reason: `Invalid phone format "${phone}". Expected: 000-000-0000`,
          })
          continue
        }

        // Create visitor record
        const { data: newVisitor, error: visitorError } = await supabase
          .from("visitors")
          .insert({
            first_name: firstName,
            last_name: lastName,
            email: email || null,
            phone: phone || null,
            company_id: companyId,
          })
          .select("id")
          .single()

        if (visitorError) {
          errors.push({
            row: rowNum,
            firstName,
            lastName,
            reason: `Database error: ${visitorError.message}`,
          })
          continue
        }

        // Create event_visitors record
        if (newVisitor) {
          const { error: eventError } = await supabase
            .from("event_visitors")
            .insert({
              visitor_id: newVisitor.id,
              event_id: eventId,
              rsvp_status: "invited",
            })

          if (eventError) {
            errors.push({
              row: rowNum,
              firstName,
              lastName,
              reason: `Visitor created but event assignment failed: ${eventError.message}`,
            })
            continue
          }
        }

        successCount++
      }

      setUploadResult({
        total: totalRows,
        success: successCount,
        errors,
      })
      setUploadResultDialogOpen(true)

      // Refresh visitors list if any were added
      if (successCount > 0) {
        fetchVisitors()
      }
    } catch (err) {
      console.error("Error processing file:", err)
      setUploadResult({
        total: 0,
        success: 0,
        errors: [{ row: 0, firstName: "", lastName: "", reason: "Failed to read the file. Please ensure it is a valid Excel (.xlsx) file." }],
      })
      setUploadResultDialogOpen(true)
    }

    setUploading(false)
  }

  // Selection helpers
  const toggleVisitorSelection = (visitorId: string) => {
    setSelectedVisitorIds((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(visitorId)) {
        newSet.delete(visitorId)
      } else {
        newSet.add(visitorId)
      }
      return newSet
    })
  }

  const toggleSelectAll = () => {
    if (selectedVisitorIds.size === filteredVisitors.length) {
      setSelectedVisitorIds(new Set())
    } else {
      setSelectedVisitorIds(new Set(filteredVisitors.map((v) => v.id)))
    }
  }

  const handleDeleteSelected = async () => {
    if (selectedVisitorIds.size === 0) return

    setDeleting(true)

    const { error } = await supabase
      .from("visitors")
      .delete()
      .in("id", Array.from(selectedVisitorIds))

    if (error) {
      setMessage({ type: "error", text: `Failed to delete visitors: ${error.message}` })
    } else {
      setMessage({ type: "success", text: `Successfully deleted ${selectedVisitorIds.size} visitor(s)` })
      setSelectedVisitorIds(new Set())
      fetchVisitors()
    }

    setDeleting(false)
    setDeleteDialogOpen(false)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Manage Visitors</h1>
        <div className="flex flex-col items-end gap-2">
          <div className="flex gap-2">
            <Button variant="outline" onClick={downloadTemplate}>
              <Download className="mr-2 h-4 w-4" />
              Download Template
            </Button>
            <input
              type="file"
              id="visitor-upload"
              accept=".xlsx"
              onChange={handleFileUpload}
              className="hidden"
            />
            <Button
              variant="outline"
              onClick={() => document.getElementById("visitor-upload")?.click()}
              disabled={uploading}
            >
              {uploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload Visitors
                </>
              )}
            </Button>
            <Button onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" />
              New Visitor
            </Button>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between mb-4">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search visitors..."
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
        {selectedVisitorIds.size > 0 && (
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setDeleteDialogOpen(true)}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete Selected ({selectedVisitorIds.size})
          </Button>
        )}
      </div>

      {loading ? (
        <p className="text-muted-foreground">Loading visitors...</p>
      ) : filteredVisitors.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          {search ? "No visitors match your search." : "No visitors yet. Create your first visitor."}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-center font-medium w-12">
                  <input
                    type="checkbox"
                    checked={selectedVisitorIds.size === filteredVisitors.length && filteredVisitors.length > 0}
                    onChange={toggleSelectAll}
                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                  />
                </th>
                <th className="px-4 py-3 text-left font-medium">Name</th>
                <th className="px-4 py-3 text-left font-medium">Email</th>
                <th className="px-4 py-3 text-left font-medium">Phone</th>
                <th className="px-4 py-3 text-left font-medium">Organization</th>
                <th className="px-4 py-3 text-center font-medium">Events</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredVisitors.map((visitor) => (
                <tr key={visitor.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3 text-center">
                    <input
                      type="checkbox"
                      checked={selectedVisitorIds.has(visitor.id)}
                      onChange={() => toggleVisitorSelection(visitor.id)}
                      className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                    />
                  </td>
                  <td className="px-4 py-3 font-medium">
                    {visitor.first_name} {visitor.last_name}
                  </td>
                  <td className="px-4 py-3">{visitor.email || "—"}</td>
                  <td className="px-4 py-3">{visitor.phone || "—"}</td>
                  <td className="px-4 py-3">{visitor.company?.name || "—"}</td>
                  <td className="px-4 py-3 text-center">
                    <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                      {visitor.event_count || 0}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right space-x-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => openAssignEvents(visitor)}
                      title="Assign to Events"
                    >
                      <CalendarDays className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => openEdit(visitor)}
                      title="Edit Visitor"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create/Edit Visitor Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Visitor" : "Create Visitor"}</DialogTitle>
            <DialogDescription>
              {editing
                ? "Update the visitor details below."
                : "Fill in the details to create a new visitor."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSave}>
            <div className="space-y-4 py-4">
              {message && (
                <div
                  className={`rounded-md p-3 text-sm ${
                    message.type === "success"
                      ? "bg-green-100 text-green-800"
                      : "bg-destructive/10 text-destructive"
                  }`}
                >
                  {message.text}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="first_name">
                    First Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="first_name"
                    value={form.first_name}
                    onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="last_name">
                    Last Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="last_name"
                    value={form.last_name}
                    onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">
                  Email <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="company">
                  Organization <span className="text-destructive">*</span>
                </Label>
                <select
                  id="company"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  value={form.company_id}
                  onChange={(e) => setForm({ ...form, company_id: e.target.value })}
                  required
                >
                  <option value="">Select an organization</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="event">
                  {editing ? "Assign to Event" : "Assigned Event"}{" "}
                  {!editing && <span className="text-destructive">*</span>}
                </Label>
                <select
                  id="event"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  value={form.event_id}
                  onChange={(e) => setForm({ ...form, event_id: e.target.value })}
                  required={!editing}
                >
                  <option value="">{editing ? "Select an event (optional)" : "Select an event"}</option>
                  {allEvents.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name} ({formatDate(e.start_date)})
                    </option>
                  ))}
                </select>
              </div>

              <p className="text-xs text-muted-foreground">
                <span className="text-destructive">*</span> Required field
              </p>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving..." : editing ? "Update Visitor" : "Create Visitor"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Assign to Events Dialog */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>
              Assign Events to {assigningVisitor?.first_name} {assigningVisitor?.last_name}
            </DialogTitle>
            <DialogDescription>
              Select the events this visitor will attend. {selectedEventIds.size} event(s) selected.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-hidden flex flex-col py-4">
            {message && (
              <div
                className={`rounded-md p-3 text-sm mb-4 ${
                  message.type === "success"
                    ? "bg-green-100 text-green-800"
                    : "bg-destructive/10 text-destructive"
                }`}
              >
                {message.text}
              </div>
            )}

            <div className="flex items-center gap-2 mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search events..."
                  value={eventSearch}
                  onChange={(e) => setEventSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Button type="button" variant="outline" size="sm" onClick={selectAll}>
                Select All
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={deselectAll}>
                Deselect All
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto border rounded-lg">
              {filteredEvents.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {eventSearch ? "No events match your search." : "No events available."}
                </div>
              ) : (
                <div className="divide-y">
                  {filteredEvents.map((event) => (
                    <label
                      key={event.id}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedEventIds.has(event.id)}
                        onChange={() => toggleEvent(event.id)}
                        className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{event.name}</p>
                        <p className="text-sm text-muted-foreground truncate">
                          {formatDate(event.start_date)} - {formatDate(event.end_date)}
                          {event.location ? ` • ${event.location}` : ""}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAssignDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveAssignments} disabled={savingAssignments}>
              {savingAssignments ? "Saving..." : "Save Assignments"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Upload Result Dialog */}
      <Dialog open={uploadResultDialogOpen} onOpenChange={setUploadResultDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Upload Results</DialogTitle>
            <p className="text-sm text-white/90">
              Summary of the visitor import process.
            </p>
          </DialogHeader>

          {uploadResult && (
            <div className="flex-1 overflow-hidden flex flex-col py-4">
              {/* Summary */}
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="text-center p-3 rounded-lg bg-white/10">
                  <p className="text-2xl font-bold">{uploadResult.total}</p>
                  <p className="text-sm text-white/90">Total Records</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-white/10">
                  <p className="text-2xl font-bold">{uploadResult.success}</p>
                  <p className="text-sm text-white/90">Successful</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-white/10">
                  <p className="text-2xl font-bold">{uploadResult.errors.length}</p>
                  <p className="text-sm text-white/90">Errors</p>
                </div>
              </div>

              {/* Errors List */}
              {uploadResult.errors.length > 0 && (
                <div className="flex-1 overflow-hidden flex flex-col">
                  <p className="text-sm font-medium mb-2">Errors:</p>
                  <div className="flex-1 overflow-y-auto border rounded-lg bg-white text-black">
                    <div className="divide-y divide-gray-200">
                      {uploadResult.errors.map((error, index) => (
                        <div key={index} className="p-3 text-sm">
                          {error.row > 0 ? (
                            <>
                              <p className="font-medium">
                                Row {error.row}: {error.firstName} {error.lastName}
                              </p>
                              <p className="text-red-600">{error.reason}</p>
                            </>
                          ) : (
                            <p className="text-red-600">{error.reason}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="justify-center sm:justify-center">
            <Button onClick={() => setUploadResultDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm Deletion</DialogTitle>
            <p className="text-sm text-white/90">
              Are you sure you want to delete {selectedVisitorIds.size} visitor{selectedVisitorIds.size !== 1 ? "s" : ""}?
              This will also remove their event assignments and document confirmations. This action cannot be undone.
            </p>
          </DialogHeader>
          <DialogFooter className="justify-center sm:justify-center gap-4">
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteSelected}
              disabled={deleting}
            >
              {deleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
