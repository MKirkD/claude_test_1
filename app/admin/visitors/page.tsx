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
import { Plus, Pencil, Search, X, CalendarDays } from "lucide-react"

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
      .order("start_date", { ascending: false })

    if (data) setAllEvents(data)
  }, [supabase])

  useEffect(() => {
    fetchVisitors()
    fetchCompanies()
    fetchAllEvents()
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

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Manage Visitors</h1>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          New Visitor
        </Button>
      </div>

      <div className="relative mb-4 max-w-sm">
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

              {!editing && (
                <div className="space-y-2">
                  <Label htmlFor="event">
                    Assigned Event <span className="text-destructive">*</span>
                  </Label>
                  <select
                    id="event"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    value={form.event_id}
                    onChange={(e) => setForm({ ...form, event_id: e.target.value })}
                    required
                  >
                    <option value="">Select an event</option>
                    {allEvents.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.name} ({formatDate(e.start_date)})
                      </option>
                    ))}
                  </select>
                </div>
              )}

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
    </div>
  )
}
