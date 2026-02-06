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

interface Company {
  id: string
  name: string
  address_line_1: string | null
  address_line_2: string | null
  city: string | null
  state_province: string | null
  postal_code: string | null
  country: string | null
  main_contact_name: string | null
  main_contact_email: string | null
  main_contact_phone: string | null
}

const emptyForm = {
  name: "",
  address_line_1: "",
  address_line_2: "",
  city: "",
  state_province: "",
  postal_code: "",
  country: "US",
  main_contact_name: "",
  main_contact_email: "",
  main_contact_phone: "",
}

export default function ManageOrganizationsPage() {
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Company | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  const supabase = createClient()

  const fetchCompanies = useCallback(async () => {
    const { data } = await supabase
      .from("companies")
      .select("*")
      .order("name")

    if (data) setCompanies(data)
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    void fetchCompanies() // eslint-disable-line react-hooks/set-state-in-effect
  }, [fetchCompanies])

  const filteredCompanies = companies.filter((company) => {
    const term = search.toLowerCase()
    return (
      company.name.toLowerCase().includes(term) ||
      (company.city?.toLowerCase().includes(term) ?? false) ||
      (company.state_province?.toLowerCase().includes(term) ?? false) ||
      (company.main_contact_name?.toLowerCase().includes(term) ?? false) ||
      (company.main_contact_email?.toLowerCase().includes(term) ?? false)
    )
  })

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm)
    setMessage(null)
    setDialogOpen(true)
  }

  const openEdit = (company: Company) => {
    setEditing(company)
    setForm({
      name: company.name,
      address_line_1: company.address_line_1 || "",
      address_line_2: company.address_line_2 || "",
      city: company.city || "",
      state_province: company.state_province || "",
      postal_code: company.postal_code || "",
      country: company.country || "US",
      main_contact_name: company.main_contact_name || "",
      main_contact_email: company.main_contact_email || "",
      main_contact_phone: company.main_contact_phone || "",
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
      address_line_1: form.address_line_1 || null,
      address_line_2: form.address_line_2 || null,
      city: form.city || null,
      state_province: form.state_province || null,
      postal_code: form.postal_code || null,
      country: form.country || null,
      main_contact_name: form.main_contact_name || null,
      main_contact_email: form.main_contact_email || null,
      main_contact_phone: form.main_contact_phone || null,
    }

    if (editing) {
      const { error } = await supabase
        .from("companies")
        .update(payload)
        .eq("id", editing.id)

      if (error) {
        setMessage({ type: "error", text: error.message })
      } else {
        setMessage({ type: "success", text: "Organization updated" })
        setDialogOpen(false)
        fetchCompanies()
      }
    } else {
      const { error } = await supabase.from("companies").insert(payload)

      if (error) {
        setMessage({ type: "error", text: error.message })
      } else {
        setMessage({ type: "success", text: "Organization created" })
        setDialogOpen(false)
        fetchCompanies()
      }
    }

    setSaving(false)
  }

  const formatAddress = (company: Company) => {
    const parts = [company.city, company.state_province].filter(Boolean)
    return parts.length > 0 ? parts.join(", ") : "—"
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Manage Organizations</h1>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          New Organization
        </Button>
      </div>

      <div className="relative mb-4 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search organizations..."
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
        <p className="text-muted-foreground">Loading organizations...</p>
      ) : filteredCompanies.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          {search ? "No organizations match your search." : "No organizations yet. Create your first organization."}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium">Name</th>
                <th className="px-4 py-3 text-left font-medium">Location</th>
                <th className="px-4 py-3 text-left font-medium">Main Contact</th>
                <th className="px-4 py-3 text-left font-medium">Email</th>
                <th className="px-4 py-3 text-left font-medium">Phone</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredCompanies.map((company) => (
                <tr key={company.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium">{company.name}</td>
                  <td className="px-4 py-3">{formatAddress(company)}</td>
                  <td className="px-4 py-3">{company.main_contact_name || "—"}</td>
                  <td className="px-4 py-3">{company.main_contact_email || "—"}</td>
                  <td className="px-4 py-3">{company.main_contact_phone || "—"}</td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => openEdit(company)}
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
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Organization" : "Create Organization"}</DialogTitle>
            <DialogDescription>
              {editing
                ? "Update the organization details below."
                : "Fill in the details to create a new organization."}
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

              {/* Company Name */}
              <div className="space-y-2">
                <Label htmlFor="name">
                  Company Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
              </div>

              {/* Address Section */}
              <div className="space-y-2">
                <Label htmlFor="address_line_1">Address Line 1</Label>
                <Input
                  id="address_line_1"
                  value={form.address_line_1}
                  onChange={(e) => setForm({ ...form, address_line_1: e.target.value })}
                  placeholder="Street address"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="address_line_2">Address Line 2</Label>
                <Input
                  id="address_line_2"
                  value={form.address_line_2}
                  onChange={(e) => setForm({ ...form, address_line_2: e.target.value })}
                  placeholder="Suite, unit, building, etc."
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    value={form.city}
                    onChange={(e) => setForm({ ...form, city: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="state_province">State / Province</Label>
                  <Input
                    id="state_province"
                    value={form.state_province}
                    onChange={(e) => setForm({ ...form, state_province: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="postal_code">Postal Code</Label>
                  <Input
                    id="postal_code"
                    value={form.postal_code}
                    onChange={(e) => setForm({ ...form, postal_code: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="country">Country</Label>
                  <Input
                    id="country"
                    value={form.country}
                    onChange={(e) => setForm({ ...form, country: e.target.value })}
                  />
                </div>
              </div>

              {/* Main Contact Section */}
              <div className="border-t pt-4 mt-4">
                <h3 className="text-sm font-medium mb-3">Main Contact</h3>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="main_contact_name">Contact Name</Label>
                    <Input
                      id="main_contact_name"
                      value={form.main_contact_name}
                      onChange={(e) => setForm({ ...form, main_contact_name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="main_contact_email">Contact Email</Label>
                    <Input
                      id="main_contact_email"
                      type="email"
                      value={form.main_contact_email}
                      onChange={(e) => setForm({ ...form, main_contact_email: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="main_contact_phone">Contact Phone</Label>
                    <Input
                      id="main_contact_phone"
                      type="tel"
                      value={form.main_contact_phone}
                      onChange={(e) => setForm({ ...form, main_contact_phone: e.target.value })}
                    />
                  </div>
                </div>
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
                {saving ? "Saving..." : editing ? "Update Organization" : "Create Organization"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
