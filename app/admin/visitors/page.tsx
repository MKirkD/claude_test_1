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

interface Visitor {
  id: string
  first_name: string
  last_name: string
  email: string | null
  phone: string | null
  company_id: string | null
  profile_id: string | null
  company?: { name: string } | null
}

interface Company {
  id: string
  name: string
}

const emptyForm = {
  first_name: "",
  last_name: "",
  email: "",
  phone: "",
  company_id: "",
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

  const supabase = createClient()

  const fetchVisitors = useCallback(async () => {
    const { data } = await supabase
      .from("visitors")
      .select("*, company:companies(name)")
      .order("last_name")

    if (data) setVisitors(data)
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
    fetchVisitors()
    fetchCompanies()
  }, [fetchVisitors, fetchCompanies])

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
      const { error } = await supabase.from("visitors").insert(payload)

      if (error) {
        setMessage({ type: "error", text: error.message })
      } else {
        setMessage({ type: "success", text: "Visitor created" })
        setDialogOpen(false)
        fetchVisitors()
      }
    }

    setSaving(false)
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
                  <td className="px-4 py-3 text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => openEdit(visitor)}
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
    </div>
  )
}
