"use client"

import { useEffect, useState, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Plus, Pencil, Search, X } from "lucide-react"

interface DocumentType {
  id: string
  name: string
  description: string | null
  requires_confirmation: boolean
}

const emptyForm = {
  name: "",
  description: "",
  requires_confirmation: true,
}

export default function ManageDocumentTypesPage() {
  const [documentTypes, setDocumentTypes] = useState<DocumentType[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<DocumentType | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  const supabase = createClient()

  const fetchDocumentTypes = useCallback(async () => {
    const { data } = await supabase
      .from("document_types")
      .select("*")
      .order("name")

    if (data) setDocumentTypes(data)
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    void fetchDocumentTypes() // eslint-disable-line react-hooks/set-state-in-effect
  }, [fetchDocumentTypes])

  const filteredDocumentTypes = documentTypes.filter((docType) => {
    const term = search.toLowerCase()
    return (
      docType.name.toLowerCase().includes(term) ||
      (docType.description?.toLowerCase().includes(term) ?? false)
    )
  })

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm)
    setMessage(null)
    setDialogOpen(true)
  }

  const openEdit = (docType: DocumentType) => {
    setEditing(docType)
    setForm({
      name: docType.name,
      description: docType.description || "",
      requires_confirmation: docType.requires_confirmation ?? true,
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
      requires_confirmation: form.requires_confirmation,
    }

    if (editing) {
      const { error } = await supabase
        .from("document_types")
        .update(payload)
        .eq("id", editing.id)

      if (error) {
        setMessage({ type: "error", text: error.message })
      } else {
        setMessage({ type: "success", text: "Document type updated" })
        setDialogOpen(false)
        fetchDocumentTypes()
      }
    } else {
      const { error } = await supabase.from("document_types").insert(payload)

      if (error) {
        setMessage({ type: "error", text: error.message })
      } else {
        setMessage({ type: "success", text: "Document type created" })
        setDialogOpen(false)
        fetchDocumentTypes()
      }
    }

    setSaving(false)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Manage Document Types</h1>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          New Document Type
        </Button>
      </div>

      <div className="relative mb-4 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search document types..."
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
        <p className="text-muted-foreground">Loading document types...</p>
      ) : filteredDocumentTypes.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          {search ? "No document types match your search." : "No document types yet. Create your first document type."}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium">Name</th>
                <th className="px-4 py-3 text-left font-medium">Description</th>
                <th className="px-4 py-3 text-center font-medium">Confirmation Required</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredDocumentTypes.map((docType) => (
                <tr key={docType.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium">{docType.name}</td>
                  <td className="px-4 py-3">{docType.description || "—"}</td>
                  <td className="px-4 py-3 text-center">{docType.requires_confirmation ? "Yes" : "No"}</td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => openEdit(docType)}
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
            <DialogTitle>{editing ? "Edit Document Type" : "Create Document Type"}</DialogTitle>
            <DialogDescription>
              {editing
                ? "Update the document type details below."
                : "Fill in the details to create a new document type."}
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
                  Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g., Liability Waiver, Medical Form"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Describe the purpose of this document type..."
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="requires_confirmation">
                  Confirmation Required <span className="text-destructive">*</span>
                </Label>
                <select
                  id="requires_confirmation"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  value={form.requires_confirmation ? "yes" : "no"}
                  onChange={(e) => setForm({ ...form, requires_confirmation: e.target.value === "yes" })}
                  required
                >
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
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
                {saving ? "Saving..." : editing ? "Update Document Type" : "Create Document Type"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
