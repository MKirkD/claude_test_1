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
import { Plus, Pencil, Search, X } from "lucide-react"

interface Event {
  id: string
  name: string
  description: string | null
  start_date: string | null
  end_date: string | null
  location: string | null
  sponsor_company_id: string | null
  sponsor_company?: { name: string } | null
}

interface Company {
  id: string
  name: string
}

const emptyForm = {
  name: "",
  description: "",
  start_date: "",
  end_date: "",
  location: "",
  sponsor_company_id: "",
}

export default function ManageEventsPage() {
  const [events, setEvents] = useState<Event[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Event | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  const supabase = createClient()

  const fetchEvents = useCallback(async () => {
    const { data } = await supabase
      .from("events")
      .select("*, sponsor_company:companies(name)")
      .order("start_date", { ascending: false })

    if (data) setEvents(data)
    setLoading(false)
  }, [supabase])

  const fetchCompanies = useCallback(async () => {
    const { data } = await supabase
      .from("companies")
      .select("id, name")
      .order("name")

    if (data) setCompanies(data)
  }, [supabase])

  useEffect(() => {
    fetchEvents()
    fetchCompanies()
  }, [fetchEvents, fetchCompanies])

  const filteredEvents = events.filter((event) => {
    const term = search.toLowerCase()
    return (
      event.name.toLowerCase().includes(term) ||
      (event.location?.toLowerCase().includes(term) ?? false) ||
      (event.description?.toLowerCase().includes(term) ?? false) ||
      (event.sponsor_company?.name?.toLowerCase().includes(term) ?? false)
    )
  })

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm)
    setMessage(null)
    setDialogOpen(true)
  }

  const openEdit = (event: Event) => {
    setEditing(event)
    setForm({
      name: event.name,
      description: event.description || "",
      start_date: event.start_date || "",
      end_date: event.end_date || "",
      location: event.location || "",
      sponsor_company_id: event.sponsor_company_id || "",
    })
    setMessage(null)
    setDialogOpen(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setMessage(null)

    const payload = {
      name: form.name,
      description: form.description || null,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      location: form.location || null,
      sponsor_company_id: form.sponsor_company_id || null,
    }

    if (editing) {
      const { error } = await supabase
        .from("events")
        .update(payload)
        .eq("id", editing.id)

      if (error) {
        setMessage({ type: "error", text: error.message })
      } else {
        setMessage({ type: "success", text: "Event updated" })
        setDialogOpen(false)
        fetchEvents()
      }
    } else {
      const { error } = await supabase.from("events").insert(payload)

      if (error) {
        setMessage({ type: "error", text: error.message })
      } else {
        setMessage({ type: "success", text: "Event created" })
        setDialogOpen(false)
        fetchEvents()
      }
    }

    setSaving(false)
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "—"
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Manage Events</h1>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          New Event
        </Button>
      </div>

      <div className="relative mb-4 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search events..."
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
        <p className="text-muted-foreground">Loading events...</p>
      ) : filteredEvents.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          {search ? "No events match your search." : "No events yet. Create your first event."}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium">Name</th>
                <th className="px-4 py-3 text-left font-medium">Start Date</th>
                <th className="px-4 py-3 text-left font-medium">End Date</th>
                <th className="px-4 py-3 text-left font-medium">Location</th>
                <th className="px-4 py-3 text-left font-medium">Organization</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredEvents.map((event) => (
                <tr key={event.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium">{event.name}</td>
                  <td className="px-4 py-3">{formatDate(event.start_date)}</td>
                  <td className="px-4 py-3">{formatDate(event.end_date)}</td>
                  <td className="px-4 py-3">{event.location || "—"}</td>
                  <td className="px-4 py-3">{event.sponsor_company?.name || "—"}</td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => openEdit(event)}
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Event" : "Create Event"}</DialogTitle>
            <DialogDescription>
              {editing
                ? "Update the event details below."
                : "Fill in the details to create a new event."}
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
              <div className="space-y-2">
                <Label htmlFor="name">
                  Event Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <textarea
                  id="description"
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="start_date">
                    Start Date <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="start_date"
                    type="date"
                    value={form.start_date}
                    onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="end_date">
                    End Date <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="end_date"
                    type="date"
                    value={form.end_date}
                    onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="location">Location</Label>
                <Input
                  id="location"
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sponsor">Organization</Label>
                <select
                  id="sponsor"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  value={form.sponsor_company_id}
                  onChange={(e) => setForm({ ...form, sponsor_company_id: e.target.value })}
                >
                  <option value="">None</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
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
                {saving ? "Saving..." : editing ? "Update Event" : "Create Event"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
