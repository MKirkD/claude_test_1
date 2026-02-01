"use client"

import { useEffect, useState, useCallback, useMemo } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { CalendarDays, Building2, Users, Search, X, Mail, Loader2 } from "lucide-react"

type TimeFilter = "6months" | "month" | "quarter" | "year"

interface EventMetrics {
  totalEvents: number
  totalOrganizations: number
  totalConfirmedVisitors: number
}

interface UpcomingEvent {
  id: string
  name: string
  start_date: string
  organization_name: string
  assigned_count: number
  confirmed_count: number
}

interface ConfirmationRow {
  event_id: string
  event_start_date: string
  event_name: string
  organization_name: string
  visitor_id: string
  first_name: string
  last_name: string
  required_docs: number
  confirmed_docs: number
  has_outdated: boolean
}

export default function DashboardPage() {
  const [metrics, setMetrics] = useState<EventMetrics>({ totalEvents: 0, totalOrganizations: 0, totalConfirmedVisitors: 0 })
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("6months")
  const [upcomingEvents, setUpcomingEvents] = useState<UpcomingEvent[]>([])
  const [confirmations, setConfirmations] = useState<ConfirmationRow[]>([])
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set())
  const [sendingEmails, setSendingEmails] = useState(false)
  const [emailMessage, setEmailMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  const supabase = createClient()

  const getDateRange = useCallback((filter: TimeFilter) => {
    const now = new Date()
    const end = now.toISOString().split("T")[0]
    let start: Date

    switch (filter) {
      case "month":
        start = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate())
        break
      case "quarter":
        start = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate())
        break
      case "year":
        start = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate())
        break
      case "6months":
      default:
        start = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate())
        break
    }

    return { start: start.toISOString().split("T")[0], end }
  }, [])

  const fetchMetrics = useCallback(async (filter: TimeFilter) => {
    const { start, end } = getDateRange(filter)

    // Get past events (end_date < current date and within time range)
    const { data: pastEvents } = await supabase
      .from("events")
      .select("id, company_id")
      .lt("end_date", end)
      .gte("end_date", start)

    if (!pastEvents || pastEvents.length === 0) {
      setMetrics({ totalEvents: 0, totalOrganizations: 0, totalConfirmedVisitors: 0 })
      return
    }

    const eventIds = pastEvents.map(e => e.id)
    const uniqueOrgIds = new Set(pastEvents.map(e => e.company_id).filter(Boolean))

    // Get confirmed visitors for these events
    const { data: confirmedVisitors } = await supabase
      .from("event_visitors")
      .select("id")
      .in("event_id", eventIds)
      .eq("rsvp_status", "confirmed")

    setMetrics({
      totalEvents: pastEvents.length,
      totalOrganizations: uniqueOrgIds.size,
      totalConfirmedVisitors: confirmedVisitors?.length || 0,
    })
  }, [supabase, getDateRange])

  const fetchUpcomingEvents = useCallback(async () => {
    const today = new Date().toISOString().split("T")[0]
    const sixMonthsLater = new Date()
    sixMonthsLater.setMonth(sixMonthsLater.getMonth() + 6)
    const futureDate = sixMonthsLater.toISOString().split("T")[0]

    // Get upcoming events
    const { data: events } = await supabase
      .from("events")
      .select("id, name, start_date, company:companies(name)")
      .gte("start_date", today)
      .lte("start_date", futureDate)
      .order("start_date", { ascending: true })
      .limit(5)

    if (!events || events.length === 0) {
      setUpcomingEvents([])
      return
    }

    // Get visitor counts for each event
    const eventIds = events.map(e => e.id)
    const { data: eventVisitors } = await supabase
      .from("event_visitors")
      .select("event_id, rsvp_status")
      .in("event_id", eventIds)

    const countMap: Record<string, { assigned: number; confirmed: number }> = {}
    eventVisitors?.forEach(ev => {
      if (!countMap[ev.event_id]) {
        countMap[ev.event_id] = { assigned: 0, confirmed: 0 }
      }
      countMap[ev.event_id].assigned++
      if (ev.rsvp_status === "confirmed") {
        countMap[ev.event_id].confirmed++
      }
    })

    const upcomingList: UpcomingEvent[] = events.map(e => ({
      id: e.id,
      name: e.name,
      start_date: e.start_date,
      organization_name: (e.company as unknown as { name: string } | null)?.name || "—",
      assigned_count: countMap[e.id]?.assigned || 0,
      confirmed_count: countMap[e.id]?.confirmed || 0,
    }))

    setUpcomingEvents(upcomingList)
  }, [supabase])

  const fetchConfirmations = useCallback(async () => {
    const today = new Date().toISOString().split("T")[0]

    // Get next 3 upcoming events
    const { data: events } = await supabase
      .from("events")
      .select("id, name, start_date, company:companies(name)")
      .gte("start_date", today)
      .order("start_date", { ascending: true })
      .limit(3)

    if (!events || events.length === 0) {
      setConfirmations([])
      return
    }

    const eventIds = events.map(e => e.id)

    // Get all visitors assigned to these events
    const { data: eventVisitors } = await supabase
      .from("event_visitors")
      .select("event_id, visitor_id, visitors(id, first_name, last_name, company:companies(name))")
      .in("event_id", eventIds)

    if (!eventVisitors || eventVisitors.length === 0) {
      setConfirmations([])
      return
    }

    // Get document types that require confirmation
    const { data: requiredTypes } = await supabase
      .from("document_types")
      .select("id")
      .eq("requires_confirmation", true)

    const requiredTypeIds = requiredTypes?.map(t => t.id) || []

    // Get documents assigned to these events that require confirmation
    const { data: eventDocs } = await supabase
      .from("document_events")
      .select("event_id, document_id, documents(id, document_type_id)")
      .in("event_id", eventIds)

    // Build map of required docs per event
    const requiredDocsPerEvent: Record<string, string[]> = {}
    eventDocs?.forEach(ed => {
      const doc = ed.documents as unknown as { id: string; document_type_id: string } | null
      if (doc && requiredTypeIds.includes(doc.document_type_id)) {
        if (!requiredDocsPerEvent[ed.event_id]) {
          requiredDocsPerEvent[ed.event_id] = []
        }
        requiredDocsPerEvent[ed.event_id].push(doc.id)
      }
    })

    // Get current versions of all required documents
    const allDocIds = Object.values(requiredDocsPerEvent).flat()
    const { data: currentVersions } = await supabase
      .from("document_versions")
      .select("id, document_id")
      .in("document_id", allDocIds)
      .eq("is_current", true)

    const currentVersionMap: Record<string, string> = {}
    currentVersions?.forEach(v => {
      currentVersionMap[v.document_id] = v.id
    })

    // Get all visitor confirmations for these events
    const visitorIds = eventVisitors.map(ev => (ev.visitors as unknown as { id: string })?.id).filter(Boolean)
    const { data: confirmationsData } = await supabase
      .from("visitor_confirmations")
      .select("visitor_id, event_id, document_id, document_version_id")
      .in("event_id", eventIds)
      .in("visitor_id", visitorIds)

    // Build confirmation map
    const confirmationMap: Record<string, Record<string, { confirmed: boolean; versionId: string }>> = {}
    confirmationsData?.forEach(c => {
      const key = `${c.visitor_id}-${c.event_id}`
      if (!confirmationMap[key]) {
        confirmationMap[key] = {}
      }
      confirmationMap[key][c.document_id] = {
        confirmed: true,
        versionId: c.document_version_id,
      }
    })

    // Build the rows
    const rows: ConfirmationRow[] = []
    const eventMap = new Map(events.map(e => [e.id, e]))

    eventVisitors.forEach(ev => {
      const event = eventMap.get(ev.event_id)
      if (!event) return

      const visitor = ev.visitors as unknown as { id: string; first_name: string; last_name: string; company: { name: string } | null } | null
      if (!visitor) return

      const requiredDocs = requiredDocsPerEvent[ev.event_id] || []
      if (requiredDocs.length === 0) return // No required docs for this event

      const key = `${visitor.id}-${ev.event_id}`
      const visitorConfirmations = confirmationMap[key] || {}

      let confirmedCount = 0
      let hasOutdated = false

      requiredDocs.forEach(docId => {
        const conf = visitorConfirmations[docId]
        if (conf?.confirmed) {
          confirmedCount++
          // Check if it's the current version
          if (conf.versionId !== currentVersionMap[docId]) {
            hasOutdated = true
          }
        }
      })

      // Only show visitors who haven't confirmed all documents
      if (confirmedCount < requiredDocs.length || hasOutdated) {
        rows.push({
          event_id: ev.event_id,
          event_start_date: event.start_date,
          event_name: event.name,
          organization_name: (event.company as unknown as { name: string } | null)?.name || (visitor.company as unknown as { name: string } | null)?.name || "—",
          visitor_id: visitor.id,
          first_name: visitor.first_name,
          last_name: visitor.last_name,
          required_docs: requiredDocs.length,
          confirmed_docs: confirmedCount,
          has_outdated: hasOutdated,
        })
      }
    })

    // Sort by event start date, organization, first name, last name
    rows.sort((a, b) => {
      if (a.event_start_date !== b.event_start_date) {
        return a.event_start_date.localeCompare(b.event_start_date)
      }
      if (a.organization_name !== b.organization_name) {
        return a.organization_name.localeCompare(b.organization_name)
      }
      if (a.first_name !== b.first_name) {
        return a.first_name.localeCompare(b.first_name)
      }
      return a.last_name.localeCompare(b.last_name)
    })

    setConfirmations(rows)
  }, [supabase])

  useEffect(() => {
    const loadData = async () => {
      setLoading(true)
      await Promise.all([fetchMetrics(timeFilter), fetchUpcomingEvents(), fetchConfirmations()])
      setLoading(false)
    }
    loadData()
    // Only run on initial mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    // Only fetch metrics when filter changes (skip initial render)
    fetchMetrics(timeFilter)
  }, [timeFilter, fetchMetrics])

  const filteredConfirmations = useMemo(() => {
    if (!search) return confirmations
    const term = search.toLowerCase()
    return confirmations.filter(row =>
      row.event_name.toLowerCase().includes(term) ||
      row.organization_name.toLowerCase().includes(term) ||
      row.first_name.toLowerCase().includes(term) ||
      row.last_name.toLowerCase().includes(term)
    )
  }, [confirmations, search])

  // Clear selection when filtered results change
  useEffect(() => {
    setSelectedRows(new Set())
  }, [filteredConfirmations.length])

  const getRowKey = (row: ConfirmationRow) => `${row.visitor_id}-${row.event_id}`

  const toggleRowSelection = (row: ConfirmationRow) => {
    const key = getRowKey(row)
    setSelectedRows(prev => {
      const newSet = new Set(prev)
      if (newSet.has(key)) {
        newSet.delete(key)
      } else {
        newSet.add(key)
      }
      return newSet
    })
  }

  const toggleSelectAll = () => {
    if (selectedRows.size === filteredConfirmations.length) {
      setSelectedRows(new Set())
    } else {
      setSelectedRows(new Set(filteredConfirmations.map(getRowKey)))
    }
  }

  const getSelectedVisitors = () => {
    return filteredConfirmations.filter(row => selectedRows.has(getRowKey(row)))
  }

  const handleSendEmails = async () => {
    const selectedVisitors = getSelectedVisitors()
    if (selectedVisitors.length === 0) return

    setSendingEmails(true)
    setEmailMessage(null)

    try {
      // Get visitor emails
      const visitorIds = [...new Set(selectedVisitors.map(v => v.visitor_id))]
      const { data: visitors } = await supabase
        .from("visitors")
        .select("id, first_name, last_name, email")
        .in("id", visitorIds)

      if (!visitors || visitors.length === 0) {
        setEmailMessage({ type: "error", text: "No visitor email addresses found." })
        setSendingEmails(false)
        return
      }

      // Call edge function to send emails
      const { error } = await supabase.functions.invoke("send-reminder-emails", {
        body: {
          visitors: visitors.map(v => ({
            email: v.email,
            first_name: v.first_name,
            last_name: v.last_name,
          })),
        },
      })

      if (error) {
        setEmailMessage({ type: "error", text: `Failed to send emails: ${error.message}` })
      } else {
        setEmailMessage({ type: "success", text: `Reminder emails sent to ${visitors.length} visitor(s).` })
        setSelectedRows(new Set())
      }
    } catch (err) {
      console.error("Error sending emails:", err)
      setEmailMessage({ type: "error", text: "An error occurred while sending emails." })
    }

    setSendingEmails(false)
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
  }

  const getFilterLabel = (filter: TimeFilter) => {
    switch (filter) {
      case "month": return "Last Month"
      case "quarter": return "Last Quarter"
      case "year": return "Last Year"
      case "6months": return "Last 6 Months"
    }
  }

  if (loading) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-6">Dashboard</h1>
        <p className="text-muted-foreground">Loading dashboard...</p>
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>

      {/* Top row: Event Metrics and Upcoming Events */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Event Metrics Card */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Event Metrics</CardTitle>
              <select
                className="text-sm border rounded-md px-2 py-1 bg-background"
                value={timeFilter}
                onChange={(e) => setTimeFilter(e.target.value as TimeFilter)}
              >
                <option value="month">Last Month</option>
                <option value="quarter">Last Quarter</option>
                <option value="6months">Last 6 Months</option>
                <option value="year">Last Year</option>
              </select>
            </div>
            <p className="text-sm text-muted-foreground">{getFilterLabel(timeFilter)}</p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 pt-4">
              <div className="text-center">
                <div className="flex justify-center mb-2">
                  <CalendarDays className="h-6 w-6 text-primary" />
                </div>
                <p className="text-3xl font-bold">{metrics.totalEvents}</p>
                <p className="text-sm text-muted-foreground">Events</p>
              </div>
              <div className="text-center">
                <div className="flex justify-center mb-2">
                  <Building2 className="h-6 w-6 text-primary" />
                </div>
                <p className="text-3xl font-bold">{metrics.totalOrganizations}</p>
                <p className="text-sm text-muted-foreground">Organizations</p>
              </div>
              <div className="text-center">
                <div className="flex justify-center mb-2">
                  <Users className="h-6 w-6 text-primary" />
                </div>
                <p className="text-3xl font-bold">{metrics.totalConfirmedVisitors}</p>
                <p className="text-sm text-muted-foreground">Confirmed Visitors</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Upcoming Events Card */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Upcoming Events</CardTitle>
            <p className="text-sm text-muted-foreground">Next 6 months</p>
          </CardHeader>
          <CardContent>
            {upcomingEvents.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">No upcoming events</p>
            ) : (
              <div className="space-y-3 pt-2">
                {upcomingEvents.map((event) => (
                  <div key={event.id} className="flex items-center justify-between py-2 border-b last:border-0">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{event.name}</p>
                      <p className="text-sm text-muted-foreground truncate">
                        {formatDate(event.start_date)} • {event.organization_name}
                      </p>
                    </div>
                    <div className="text-right ml-4">
                      <p className="font-medium">{event.confirmed_count} <span className="text-muted-foreground font-normal">(of {event.assigned_count})</span></p>
                      <p className="text-xs text-muted-foreground">confirmed</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Confirmations Section */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Pending Confirmations</CardTitle>
              <p className="text-sm text-muted-foreground">Visitors who haven&apos;t confirmed all required documents (next 3 events)</p>
            </div>
            {selectedRows.size > 0 && (
              <Button onClick={handleSendEmails} disabled={sendingEmails}>
                {sendingEmails ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Mail className="mr-2 h-4 w-4" />
                    Email Selected ({selectedRows.size})
                  </>
                )}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {emailMessage && (
            <div
              className={`rounded-md p-3 text-sm mb-4 ${
                emailMessage.type === "success"
                  ? "bg-green-100 text-green-800"
                  : "bg-destructive/10 text-destructive"
              }`}
            >
              {emailMessage.text}
            </div>
          )}

          <div className="relative mb-4 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search..."
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

          {filteredConfirmations.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {search ? "No results match your search." : "All visitors have confirmed their required documents."}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-3 text-center font-medium w-12">
                      <input
                        type="checkbox"
                        checked={selectedRows.size === filteredConfirmations.length && filteredConfirmations.length > 0}
                        onChange={toggleSelectAll}
                        className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                      />
                    </th>
                    <th className="px-4 py-3 text-left font-medium">Event Start Date</th>
                    <th className="px-4 py-3 text-left font-medium">Organization</th>
                    <th className="px-4 py-3 text-left font-medium">First Name</th>
                    <th className="px-4 py-3 text-left font-medium">Last Name</th>
                    <th className="px-4 py-3 text-center font-medium">Documents To Confirm</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredConfirmations.map((row, idx) => (
                    <tr key={`${row.visitor_id}-${row.event_id}-${idx}`} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-4 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={selectedRows.has(getRowKey(row))}
                          onChange={() => toggleRowSelection(row)}
                          className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                        />
                      </td>
                      <td className="px-4 py-3">{formatDate(row.event_start_date)}</td>
                      <td className="px-4 py-3">{row.organization_name}</td>
                      <td className="px-4 py-3">{row.first_name}</td>
                      <td className="px-4 py-3">{row.last_name}</td>
                      <td className="px-4 py-3 text-center">
                        {row.required_docs - row.confirmed_docs} <span className="text-muted-foreground">(of {row.required_docs})</span>
                        {row.has_outdated && row.confirmed_docs === row.required_docs && " *"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {filteredConfirmations.some(r => r.has_outdated) && (
            <p className="text-xs text-muted-foreground mt-2">
              * Visitor has confirmed an outdated document version
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
