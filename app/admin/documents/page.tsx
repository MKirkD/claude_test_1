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
import { Plus, Pencil, Search, X, Upload, FileText, Trash2 } from "lucide-react"

interface Document {
  id: string
  name: string
  description: string | null
  version: string
  file_path: string
  file_name: string
  file_size: number | null
  mime_type: string | null
  is_active: boolean
  created_at: string
  document_type_id: string | null
  document_type?: { name: string } | null
  assigned_events?: { event_id: string; event: { name: string } }[]
}

interface Event {
  id: string
  name: string
}

interface DocumentType {
  id: string
  name: string
}

const emptyForm = {
  name: "",
  description: "",
  version: "",
  document_type_id: "",
}

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<Document[]>([])
  const [events, setEvents] = useState<Event[]>([])
  const [documentTypes, setDocumentTypes] = useState<DocumentType[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [assignDialogOpen, setAssignDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Document | null>(null)
  const [assigningDocument, setAssigningDocument] = useState<Document | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [selectedEvents, setSelectedEvents] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  const supabase = createClient()

  const fetchDocuments = useCallback(async () => {
    const { data } = await supabase
      .from("documents")
      .select(`
        *,
        document_type:document_types(name),
        assigned_events:document_events(
          event_id,
          event:events(name)
        )
      `)
      .order("name")

    if (data) setDocuments(data)
    setLoading(false)
  }, [supabase])

  const fetchEvents = useCallback(async () => {
    const { data } = await supabase
      .from("events")
      .select("id, name")
      .order("name")

    if (data) setEvents(data)
  }, [supabase])

  const fetchDocumentTypes = useCallback(async () => {
    const { data } = await supabase
      .from("document_types")
      .select("id, name")
      .order("name")

    if (data) setDocumentTypes(data)
  }, [supabase])

  useEffect(() => {
    fetchDocuments()
    fetchEvents()
    fetchDocumentTypes()
  }, [fetchDocuments, fetchEvents, fetchDocumentTypes])

  const filteredDocuments = documents.filter((doc) => {
    const term = search.toLowerCase()
    return (
      doc.name.toLowerCase().includes(term) ||
      doc.version.toLowerCase().includes(term) ||
      (doc.description?.toLowerCase().includes(term) ?? false)
    )
  })

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm)
    setSelectedFile(null)
    setMessage(null)
    setDialogOpen(true)
  }

  const openEdit = (doc: Document) => {
    setEditing(doc)
    setForm({
      name: doc.name,
      description: doc.description || "",
      version: doc.version,
      document_type_id: doc.document_type_id || "",
    })
    setSelectedFile(null)
    setMessage(null)
    setDialogOpen(true)
  }

  const openAssign = async (doc: Document) => {
    setAssigningDocument(doc)
    // Get currently assigned events
    const { data } = await supabase
      .from("document_events")
      .select("event_id")
      .eq("document_id", doc.id)

    if (data) {
      setSelectedEvents(data.map(d => d.event_id))
    } else {
      setSelectedEvents([])
    }
    setAssignDialogOpen(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setMessage(null)

    try {
      let filePath = editing?.file_path || ""
      let fileName = editing?.file_name || ""
      let fileSize = editing?.file_size || null
      let mimeType = editing?.mime_type || null

      // Upload file if selected
      if (selectedFile) {
        const fileExt = selectedFile.name.split(".").pop()
        const uniqueName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
        filePath = `documents/${uniqueName}`
        fileName = selectedFile.name
        fileSize = selectedFile.size
        mimeType = selectedFile.type

        const { error: uploadError } = await supabase.storage
          .from("documents")
          .upload(filePath, selectedFile)

        if (uploadError) {
          // If bucket doesn't exist, show helpful message
          if (uploadError.message.includes("not found") || uploadError.message.includes("Bucket")) {
            setMessage({
              type: "error",
              text: "Storage bucket 'documents' not found. Please create it in Supabase Storage settings."
            })
            setSaving(false)
            return
          }
          throw uploadError
        }
      }

      if (!filePath && !editing) {
        setMessage({ type: "error", text: "Please select a file to upload" })
        setSaving(false)
        return
      }

      const payload = {
        name: form.name,
        description: form.description || null,
        version: form.version,
        document_type_id: form.document_type_id || null,
        file_path: filePath,
        file_name: fileName,
        file_size: fileSize,
        mime_type: mimeType,
        updated_at: new Date().toISOString(),
      }

      if (editing) {
        const { error } = await supabase
          .from("documents")
          .update(payload)
          .eq("id", editing.id)

        if (error) throw error
        setMessage({ type: "success", text: "Document updated" })
      } else {
        const { data: userData } = await supabase.auth.getUser()
        const { error } = await supabase
          .from("documents")
          .insert({ ...payload, created_by: userData.user?.id })

        if (error) throw error
        setMessage({ type: "success", text: "Document created" })
      }

      setDialogOpen(false)
      fetchDocuments()
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "An error occurred"
      setMessage({ type: "error", text: errorMessage })
    }

    setSaving(false)
  }

  const handleAssignEvents = async () => {
    if (!assigningDocument) return
    setSaving(true)

    try {
      // Delete existing assignments
      await supabase
        .from("document_events")
        .delete()
        .eq("document_id", assigningDocument.id)

      // Insert new assignments
      if (selectedEvents.length > 0) {
        const assignments = selectedEvents.map(eventId => ({
          document_id: assigningDocument.id,
          event_id: eventId,
        }))

        const { error } = await supabase
          .from("document_events")
          .insert(assignments)

        if (error) throw error
      }

      setAssignDialogOpen(false)
      fetchDocuments()
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "An error occurred"
      setMessage({ type: "error", text: errorMessage })
    }

    setSaving(false)
  }

  const toggleEventSelection = (eventId: string) => {
    setSelectedEvents(prev =>
      prev.includes(eventId)
        ? prev.filter(id => id !== eventId)
        : [...prev, eventId]
    )
  }

  const toggleActive = async (doc: Document) => {
    await supabase
      .from("documents")
      .update({ is_active: !doc.is_active })
      .eq("id", doc.id)

    fetchDocuments()
  }

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return "—"
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Documents</h1>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Upload Document
        </Button>
      </div>

      <div className="relative mb-4 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search documents..."
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
        <p className="text-muted-foreground">Loading documents...</p>
      ) : filteredDocuments.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          {search ? "No documents match your search." : "No documents yet. Upload your first document."}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium">Name</th>
                <th className="px-4 py-3 text-left font-medium">Type</th>
                <th className="px-4 py-3 text-left font-medium">Version</th>
                <th className="px-4 py-3 text-left font-medium">File</th>
                <th className="px-4 py-3 text-left font-medium">Size</th>
                <th className="px-4 py-3 text-left font-medium">Assigned Events</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-left font-medium">Uploaded</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredDocuments.map((doc) => (
                <tr key={doc.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium">{doc.name}</td>
                  <td className="px-4 py-3">{doc.document_type?.name || "—"}</td>
                  <td className="px-4 py-3">{doc.version}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span className="truncate max-w-[150px]" title={doc.file_name}>
                        {doc.file_name}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">{formatFileSize(doc.file_size)}</td>
                  <td className="px-4 py-3">
                    {doc.assigned_events && doc.assigned_events.length > 0 ? (
                      <span className="text-xs bg-muted px-2 py-1 rounded">
                        {doc.assigned_events.length} event{doc.assigned_events.length !== 1 ? 's' : ''}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">None</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggleActive(doc)}
                      className={`text-xs px-2 py-1 rounded ${
                        doc.is_active
                          ? "bg-green-100 text-green-800"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {doc.is_active ? "Active" : "Inactive"}
                    </button>
                  </td>
                  <td className="px-4 py-3">{formatDate(doc.created_at)}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => openAssign(doc)}
                        title="Assign to events"
                      >
                        <Upload className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => openEdit(doc)}
                        title="Edit"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Upload/Edit Document Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Document" : "Upload Document"}</DialogTitle>
            <DialogDescription>
              {editing
                ? "Update the document details below."
                : "Upload a new versioned document."}
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
                  Document Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g., Liability Waiver"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="document_type">
                  Document Type <span className="text-destructive">*</span>
                </Label>
                <select
                  id="document_type"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  value={form.document_type_id}
                  onChange={(e) => setForm({ ...form, document_type_id: e.target.value })}
                  required
                >
                  <option value="">Select a document type</option>
                  {documentTypes.map((docType) => (
                    <option key={docType.id} value={docType.id}>
                      {docType.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="version">
                  Version <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="version"
                  value={form.version}
                  onChange={(e) => setForm({ ...form, version: e.target.value })}
                  placeholder="e.g., 1.0, 2024-01, v2"
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
                  placeholder="Brief description of the document"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="file">
                  File {!editing && <span className="text-destructive">*</span>}
                </Label>
                <Input
                  id="file"
                  type="file"
                  accept=".pdf,.doc,.docx"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  required={!editing}
                />
                {editing && (
                  <p className="text-xs text-muted-foreground">
                    Current file: {editing.file_name}. Upload a new file to replace it.
                  </p>
                )}
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
                {saving ? "Saving..." : editing ? "Update Document" : "Upload Document"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Assign to Events Dialog */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Assign to Events</DialogTitle>
            <DialogDescription>
              Select which events require this document: {assigningDocument?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {events.length === 0 ? (
              <p className="text-sm text-muted-foreground">No events available.</p>
            ) : (
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {events.map((event) => (
                  <label
                    key={event.id}
                    className="flex items-center gap-3 p-2 rounded hover:bg-muted cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedEvents.includes(event.id)}
                      onChange={() => toggleEventSelection(event.id)}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                    <span className="text-sm">{event.name}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAssignDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAssignEvents} disabled={saving}>
              {saving ? "Saving..." : "Save Assignments"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
