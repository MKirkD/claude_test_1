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
import { Plus, Pencil, Search, X, Upload, FileText, History, Check } from "lucide-react"

interface DocumentVersion {
  id: string
  document_id: string
  version_number: number
  file_path: string
  file_name: string
  file_size: number | null
  mime_type: string | null
  is_current: boolean
  notes: string | null
  created_at: string
}

interface Document {
  id: string
  name: string
  description: string | null
  document_type_id: string | null
  document_type?: { name: string } | null
  is_active: boolean
  created_at: string
  current_version?: DocumentVersion | null
  versions?: DocumentVersion[]
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

const emptyDocumentForm = {
  name: "",
  description: "",
  document_type_id: "",
}

const emptyVersionForm = {
  notes: "",
}

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<Document[]>([])
  const [events, setEvents] = useState<Event[]>([])
  const [documentTypes, setDocumentTypes] = useState<DocumentType[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")

  // Document dialog state
  const [documentDialogOpen, setDocumentDialogOpen] = useState(false)
  const [editingDocument, setEditingDocument] = useState<Document | null>(null)
  const [documentForm, setDocumentForm] = useState(emptyDocumentForm)

  // Version dialog state
  const [versionDialogOpen, setVersionDialogOpen] = useState(false)
  const [uploadingToDocument, setUploadingToDocument] = useState<Document | null>(null)
  const [versionForm, setVersionForm] = useState(emptyVersionForm)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  // Version history dialog state
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false)
  const [viewingDocument, setViewingDocument] = useState<Document | null>(null)
  const [versions, setVersions] = useState<DocumentVersion[]>([])

  // Assign events dialog state
  const [assignDialogOpen, setAssignDialogOpen] = useState(false)
  const [assigningDocument, setAssigningDocument] = useState<Document | null>(null)
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

    if (data) {
      // Fetch current version for each document
      const docsWithVersions = await Promise.all(
        data.map(async (doc) => {
          const { data: versionData } = await supabase
            .from("document_versions")
            .select("*")
            .eq("document_id", doc.id)
            .eq("is_current", true)
            .single()

          return { ...doc, current_version: versionData }
        })
      )
      setDocuments(docsWithVersions)
    }
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
      (doc.description?.toLowerCase().includes(term) ?? false) ||
      (doc.document_type?.name?.toLowerCase().includes(term) ?? false)
    )
  })

  // Document CRUD
  const openCreateDocument = () => {
    setEditingDocument(null)
    setDocumentForm(emptyDocumentForm)
    setSelectedFile(null)
    setMessage(null)
    setDocumentDialogOpen(true)
  }

  const openEditDocument = (doc: Document) => {
    setEditingDocument(doc)
    setDocumentForm({
      name: doc.name,
      description: doc.description || "",
      document_type_id: doc.document_type_id || "",
    })
    setMessage(null)
    setDocumentDialogOpen(true)
  }

  const handleSaveDocument = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setMessage(null)

    try {
      const payload = {
        name: documentForm.name,
        description: documentForm.description || null,
        document_type_id: documentForm.document_type_id || null,
        updated_at: new Date().toISOString(),
      }

      if (editingDocument) {
        const { error } = await supabase
          .from("documents")
          .update(payload)
          .eq("id", editingDocument.id)

        if (error) throw error
        setMessage({ type: "success", text: "Document updated" })
      } else {
        // Creating new document - need a file for first version
        if (!selectedFile) {
          setMessage({ type: "error", text: "Please select a file for the first version" })
          setSaving(false)
          return
        }

        const { data: userData } = await supabase.auth.getUser()

        // Create the document
        const { data: newDoc, error: docError } = await supabase
          .from("documents")
          .insert({ ...payload, created_by: userData.user?.id })
          .select()
          .single()

        if (docError) throw docError

        // Upload the file
        const fileExt = selectedFile.name.split(".").pop()
        const uniqueName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
        const filePath = `documents/${uniqueName}`

        const { error: uploadError } = await supabase.storage
          .from("documents")
          .upload(filePath, selectedFile)

        if (uploadError) throw uploadError

        // Create version 1
        const { error: versionError } = await supabase
          .from("document_versions")
          .insert({
            document_id: newDoc.id,
            version_number: 1,
            file_path: filePath,
            file_name: selectedFile.name,
            file_size: selectedFile.size,
            mime_type: selectedFile.type,
            is_current: true,
            created_by: userData.user?.id,
          })

        if (versionError) throw versionError
        setMessage({ type: "success", text: "Document created with version 1" })
      }

      setDocumentDialogOpen(false)
      setSelectedFile(null)
      fetchDocuments()
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "An error occurred"
      setMessage({ type: "error", text: errorMessage })
    }

    setSaving(false)
  }

  // Version management
  const openUploadVersion = (doc: Document) => {
    setUploadingToDocument(doc)
    setVersionForm(emptyVersionForm)
    setSelectedFile(null)
    setMessage(null)
    setVersionDialogOpen(true)
  }

  const handleUploadVersion = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!uploadingToDocument || !selectedFile) return

    setSaving(true)
    setMessage(null)

    try {
      const { data: userData } = await supabase.auth.getUser()

      // Get next version number
      const { data: nextVersion } = await supabase
        .rpc("get_next_version_number", { doc_id: uploadingToDocument.id })

      // Upload the file
      const fileExt = selectedFile.name.split(".").pop()
      const uniqueName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
      const filePath = `documents/${uniqueName}`

      const { error: uploadError } = await supabase.storage
        .from("documents")
        .upload(filePath, selectedFile)

      if (uploadError) throw uploadError

      // Set all existing versions to not current
      await supabase
        .from("document_versions")
        .update({ is_current: false })
        .eq("document_id", uploadingToDocument.id)

      // Create new version
      const { error: versionError } = await supabase
        .from("document_versions")
        .insert({
          document_id: uploadingToDocument.id,
          version_number: nextVersion,
          file_path: filePath,
          file_name: selectedFile.name,
          file_size: selectedFile.size,
          mime_type: selectedFile.type,
          is_current: true,
          notes: versionForm.notes || null,
          created_by: userData.user?.id,
        })

      if (versionError) throw versionError

      setMessage({ type: "success", text: `Version ${nextVersion} uploaded` })
      setVersionDialogOpen(false)
      fetchDocuments()
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "An error occurred"
      setMessage({ type: "error", text: errorMessage })
    }

    setSaving(false)
  }

  // Version history
  const openVersionHistory = async (doc: Document) => {
    setViewingDocument(doc)

    const { data } = await supabase
      .from("document_versions")
      .select("*")
      .eq("document_id", doc.id)
      .order("version_number", { ascending: false })

    if (data) setVersions(data)
    setHistoryDialogOpen(true)
  }

  const setCurrentVersion = async (version: DocumentVersion) => {
    setSaving(true)

    try {
      await supabase.rpc("set_current_version", { version_id: version.id })

      // Refresh versions list
      const { data } = await supabase
        .from("document_versions")
        .select("*")
        .eq("document_id", version.document_id)
        .order("version_number", { ascending: false })

      if (data) setVersions(data)
      fetchDocuments()
    } catch (error: unknown) {
      console.error("Error setting current version:", error)
    }

    setSaving(false)
  }

  // Event assignment
  const openAssign = async (doc: Document) => {
    setAssigningDocument(doc)
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

  const handleAssignEvents = async () => {
    if (!assigningDocument) return
    setSaving(true)

    try {
      await supabase
        .from("document_events")
        .delete()
        .eq("document_id", assigningDocument.id)

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
      console.error("Error assigning events:", error)
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
        <Button onClick={openCreateDocument}>
          <Plus className="mr-2 h-4 w-4" />
          New Document
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
          {search ? "No documents match your search." : "No documents yet. Create your first document."}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium">Name</th>
                <th className="px-4 py-3 text-left font-medium">Type</th>
                <th className="px-4 py-3 text-left font-medium">Current Version</th>
                <th className="px-4 py-3 text-left font-medium">File</th>
                <th className="px-4 py-3 text-left font-medium">Assigned Events</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredDocuments.map((doc) => (
                <tr key={doc.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium">{doc.name}</td>
                  <td className="px-4 py-3">{doc.document_type?.name || "—"}</td>
                  <td className="px-4 py-3">
                    {doc.current_version ? (
                      <span className="inline-flex items-center px-2 py-1 rounded bg-blue-100 text-blue-800 text-xs font-medium">
                        v{doc.current_version.version_number}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {doc.current_version ? (
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span className="truncate max-w-[120px]" title={doc.current_version.file_name}>
                          {doc.current_version.file_name}
                        </span>
                        <span className="text-muted-foreground text-xs">
                          ({formatFileSize(doc.current_version.file_size)})
                        </span>
                      </div>
                    ) : (
                      "—"
                    )}
                  </td>
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
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => openVersionHistory(doc)}
                        title="Version history"
                      >
                        <History className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => openUploadVersion(doc)}
                        title="Upload new version"
                      >
                        <Upload className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => openAssign(doc)}
                        title="Assign to events"
                      >
                        <FileText className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => openEditDocument(doc)}
                        title="Edit document"
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

      {/* Create/Edit Document Dialog */}
      <Dialog open={documentDialogOpen} onOpenChange={setDocumentDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingDocument ? "Edit Document" : "New Document"}</DialogTitle>
            <DialogDescription>
              {editingDocument
                ? "Update the document details below."
                : "Create a new document and upload the first version."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveDocument}>
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
                  value={documentForm.name}
                  onChange={(e) => setDocumentForm({ ...documentForm, name: e.target.value })}
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
                  value={documentForm.document_type_id}
                  onChange={(e) => setDocumentForm({ ...documentForm, document_type_id: e.target.value })}
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
                <Label htmlFor="description">Description</Label>
                <textarea
                  id="description"
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  value={documentForm.description}
                  onChange={(e) => setDocumentForm({ ...documentForm, description: e.target.value })}
                  placeholder="Brief description of the document"
                />
              </div>

              {!editingDocument && (
                <div className="space-y-2">
                  <Label htmlFor="file">
                    File (Version 1) <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="file"
                    type="file"
                    accept=".pdf,.doc,.docx"
                    onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                    required
                  />
                </div>
              )}

              <p className="text-xs text-muted-foreground">
                <span className="text-destructive">*</span> Required field
              </p>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDocumentDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving..." : editingDocument ? "Update Document" : "Create Document"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Upload New Version Dialog */}
      <Dialog open={versionDialogOpen} onOpenChange={setVersionDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Upload New Version</DialogTitle>
            <DialogDescription>
              Upload a new version of: {uploadingToDocument?.name}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUploadVersion}>
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
                <Label htmlFor="version_file">
                  File <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="version_file"
                  type="file"
                  accept=".pdf,.doc,.docx"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Version Notes</Label>
                <textarea
                  id="notes"
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  value={versionForm.notes}
                  onChange={(e) => setVersionForm({ ...versionForm, notes: e.target.value })}
                  placeholder="What changed in this version?"
                />
              </div>

              <p className="text-xs text-muted-foreground">
                The new version will automatically become the current version.
              </p>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setVersionDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving || !selectedFile}>
                {saving ? "Uploading..." : "Upload Version"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Version History Dialog */}
      <Dialog open={historyDialogOpen} onOpenChange={setHistoryDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Version History</DialogTitle>
            <DialogDescription>
              All versions of: {viewingDocument?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {versions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No versions found.</p>
            ) : (
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {versions.map((version) => (
                  <div
                    key={version.id}
                    className={`flex items-center justify-between p-3 rounded-lg border ${
                      version.is_current ? "border-blue-300 bg-blue-50" : "border-gray-200"
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">v{version.version_number}</span>
                        {version.is_current && (
                          <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                            Current
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        <span>{version.file_name}</span>
                        <span className="mx-2">•</span>
                        <span>{formatFileSize(version.file_size)}</span>
                        <span className="mx-2">•</span>
                        <span>{formatDate(version.created_at)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {version.notes && (
                        <span className="text-xs text-muted-foreground max-w-[150px] truncate" title={version.notes}>
                          {version.notes}
                        </span>
                      )}
                      {!version.is_current && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentVersion(version)}
                          disabled={saving}
                        >
                          <Check className="h-3 w-3 mr-1" />
                          Set Current
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setHistoryDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
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
