"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { ShieldCheck, HeartPulse, Utensils, Map, Mountain, Calendar, Loader2, CheckCircle2, AlertCircle } from "lucide-react"

interface FeaturesProps {
  eventId: string | null
  visitorId: string | null
}

const featureDefinitions = [
  {
    key: "safety",
    title: "Safety",
    description: "Your safety is our top priority with 24/7 on-site support and emergency protocols.",
    icon: ShieldCheck,
    documentType: "Safety",
  },
  {
    key: "medical",
    title: "Medical",
    description: "Access to medical resources and first aid facilities for your peace of mind.",
    icon: HeartPulse,
    documentType: "Medical",
  },
  {
    key: "food",
    title: "Food Preferences",
    description: "Customizable dining options to accommodate all dietary needs and preferences.",
    icon: Utensils,
    documentType: "Food Preferences",
  },
  {
    key: "directions",
    title: "Directions",
    description: "Easy-to-follow guides and maps to help you navigate the ranch and surrounding areas.",
    icon: Map,
    documentType: "Directions",
  },
  {
    key: "activities",
    title: "Activities and Amenities",
    description: "Explore outdoor adventures, modern comforts, and conveniences to make your stay memorable.",
    icon: Mountain,
    documentType: "Activities & Amenities",
  },
  {
    key: "schedule",
    title: "Schedule of Events",
    description: "View the full itinerary of activities and events planned during your visit.",
    icon: Calendar,
    documentType: "Schedule of Events",
  },
]

export function Features({ eventId, visitorId }: FeaturesProps) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [documentUrl, setDocumentUrl] = useState<string | null>(null)
  const [documentName, setDocumentName] = useState<string>("")
  const [documentMimeType, setDocumentMimeType] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Document tracking state
  const [currentDocumentId, setCurrentDocumentId] = useState<string | null>(null)
  const [currentVersionId, setCurrentVersionId] = useState<string | null>(null)
  const [requiresConfirmation, setRequiresConfirmation] = useState(false)
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false)
  const [isConfirmed, setIsConfirmed] = useState(false)
  const [alreadyConfirmed, setAlreadyConfirmed] = useState(false)
  const [confirmingDocument, setConfirmingDocument] = useState(false)
  const [confirmationSuccess, setConfirmationSuccess] = useState(false)

  // Track which document types have been confirmed with current version
  const [confirmedDocTypes, setConfirmedDocTypes] = useState<Set<string>>(new Set())
  // Track which document types require confirmation
  const [requiresConfirmationDocTypes, setRequiresConfirmationDocTypes] = useState<Set<string>>(new Set())

  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  // Fetch confirmation status for all document types on load
  const fetchConfirmationStatus = useCallback(async () => {
    if (!eventId || !visitorId) return

    try {
      // Get all document types
      const { data: docTypes } = await supabase
        .from("document_types")
        .select("id, name, requires_confirmation")

      if (!docTypes) return

      // Get documents assigned to this event
      const { data: docEvents } = await supabase
        .from("document_events")
        .select("document_id")
        .eq("event_id", eventId)

      if (!docEvents || docEvents.length === 0) return

      const eventDocIds = docEvents.map((de) => de.document_id)

      // Get documents with their types
      const { data: docs } = await supabase
        .from("documents")
        .select("id, document_type_id")
        .in("id", eventDocIds)

      if (!docs) return

      // Get current versions for these documents
      const docIds = docs.map((d) => d.id)
      const { data: versions } = await supabase
        .from("document_versions")
        .select("id, document_id")
        .in("document_id", docIds)
        .eq("is_current", true)

      if (!versions) return

      // Get visitor's confirmations
      const versionIds = versions.map((v) => v.id)
      const { data: confirmations } = await supabase
        .from("visitor_confirmations")
        .select("document_id, document_version_id")
        .eq("visitor_id", visitorId)
        .eq("event_id", eventId)
        .in("document_version_id", versionIds)

      if (!confirmations) return

      // Build a map of document_id -> current_version_id
      const currentVersionMap: Record<string, string> = {}
      versions.forEach((v) => {
        currentVersionMap[v.document_id] = v.id
      })

      // Build a map of document_id -> document_type_id
      const docTypeMap: Record<string, string> = {}
      docs.forEach((d) => {
        docTypeMap[d.id] = d.document_type_id
      })

      // Build a map of document_type_id -> name and requires_confirmation
      const typeNameMap: Record<string, string> = {}
      const typeRequiresConfirmation: Record<string, boolean> = {}
      docTypes.forEach((dt) => {
        typeNameMap[dt.id] = dt.name
        typeRequiresConfirmation[dt.id] = dt.requires_confirmation ?? false
      })

      // Find which document types require confirmation (based on assigned documents)
      const requiresConfirmationTypes = new Set<string>()
      docs.forEach((d) => {
        const typeId = d.document_type_id
        if (typeRequiresConfirmation[typeId]) {
          const typeName = typeNameMap[typeId]
          if (typeName) {
            requiresConfirmationTypes.add(typeName)
          }
        }
      })

      // Find which document types are confirmed with current version
      const confirmedTypes = new Set<string>()
      confirmations?.forEach((c) => {
        const currentVersionId = currentVersionMap[c.document_id]
        if (c.document_version_id === currentVersionId) {
          const typeId = docTypeMap[c.document_id]
          const typeName = typeNameMap[typeId]
          if (typeName) {
            confirmedTypes.add(typeName)
          }
        }
      })

      setRequiresConfirmationDocTypes(requiresConfirmationTypes)
      setConfirmedDocTypes(confirmedTypes)
    } catch (err) {
      console.error("Error fetching confirmation status:", err)
    }
  }, [eventId, visitorId, supabase])

  useEffect(() => {
    fetchConfirmationStatus()
  }, [fetchConfirmationStatus])

  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current
    if (!container) return

    const { scrollTop, scrollHeight, clientHeight } = container
    // Consider "scrolled to bottom" when within 50px of the bottom
    if (scrollHeight - scrollTop - clientHeight < 50) {
      setHasScrolledToBottom(true)
    }
  }, [])

  useEffect(() => {
    const container = scrollContainerRef.current
    const isPdfDocument = documentMimeType === "application/pdf"

    // For PDFs, we use a timer (in the iframe onLoad) instead of scroll tracking
    // since we can't track scrolling inside the iframe
    if (container && documentUrl && requiresConfirmation && !isPdfDocument) {
      container.addEventListener("scroll", handleScroll)
      // Check initial state in case content is short
      handleScroll()
      return () => container.removeEventListener("scroll", handleScroll)
    }
  }, [documentUrl, requiresConfirmation, handleScroll, documentMimeType])

  const checkExistingConfirmation = async (docId: string, versionId: string) => {
    if (!visitorId || !eventId) return false

    const { count, error } = await supabase
      .from("visitor_confirmations")
      .select("*", { count: "exact", head: true })
      .eq("visitor_id", visitorId)
      .eq("event_id", eventId)
      .eq("document_id", docId)
      .eq("document_version_id", versionId)

    return !error && (count ?? 0) > 0
  }

  const handleCardClick = async (documentType: string, title: string) => {
    if (!eventId) {
      setError("No event assigned. Please contact an administrator.")
      setDialogOpen(true)
      return
    }

    setLoading(true)
    setError(null)
    setDocumentUrl(null)
    setDocumentName(title)
    setRequiresConfirmation(false)
    setHasScrolledToBottom(false)
    setIsConfirmed(false)
    setAlreadyConfirmed(false)
    setConfirmationSuccess(false)
    setCurrentDocumentId(null)
    setCurrentVersionId(null)
    setDialogOpen(true)

    try {
      // First, get the document type ID and requires_confirmation setting
      const { data: docType } = await supabase
        .from("document_types")
        .select("id, requires_confirmation")
        .eq("name", documentType)
        .single()

      if (!docType) {
        setError(`No ${title} document type found.`)
        setLoading(false)
        return
      }

      // Set requires confirmation from database
      const needsConfirmation = docType.requires_confirmation ?? false
      setRequiresConfirmation(needsConfirmation)

      // Get document IDs assigned to this event
      const { data: docEvents } = await supabase
        .from("document_events")
        .select("document_id")
        .eq("event_id", eventId)

      if (!docEvents || docEvents.length === 0) {
        setError(`No documents have been assigned to your event yet.`)
        setLoading(false)
        return
      }

      const documentIds = docEvents.map((de) => de.document_id)

      // Find a document of this type from the assigned documents
      const { data: doc } = await supabase
        .from("documents")
        .select("id, name")
        .in("id", documentIds)
        .eq("document_type_id", docType.id)
        .single()

      if (!doc) {
        setError(`No ${title} document has been assigned to your event yet.`)
        setLoading(false)
        return
      }

      setCurrentDocumentId(doc.id)

      // Get the current version of this document
      const { data: currentVersion } = await supabase
        .from("document_versions")
        .select("id, file_path, file_name, mime_type")
        .eq("document_id", doc.id)
        .eq("is_current", true)
        .single()

      if (!currentVersion || !currentVersion.file_path) {
        setError(`The ${title} document has no uploaded file yet.`)
        setLoading(false)
        return
      }

      setCurrentVersionId(currentVersion.id)

      // Check if already confirmed this version
      if (needsConfirmation && visitorId) {
        const confirmed = await checkExistingConfirmation(doc.id, currentVersion.id)
        setAlreadyConfirmed(confirmed)
      }

      // Get the public URL for the file
      const { data: urlData } = supabase.storage
        .from("documents")
        .getPublicUrl(currentVersion.file_path)

      if (urlData?.publicUrl) {
        setDocumentUrl(urlData.publicUrl)
        setDocumentMimeType(currentVersion.mime_type)
      } else {
        setError("Could not retrieve the document file.")
      }
    } catch (err) {
      console.error("Error fetching document:", err)
      setError("An error occurred while loading the document.")
    }

    setLoading(false)
  }

  const checkAllDocumentsConfirmed = async () => {
    if (!visitorId || !eventId) return

    // Get all document types that require confirmation
    const { data: requiredTypes } = await supabase
      .from("document_types")
      .select("id")
      .eq("requires_confirmation", true)

    if (!requiredTypes || requiredTypes.length === 0) return

    const requiredTypeIds = requiredTypes.map((t) => t.id)

    // Get all document IDs assigned to this event
    const { data: eventDocs } = await supabase
      .from("document_events")
      .select("document_id")
      .eq("event_id", eventId)

    if (!eventDocs || eventDocs.length === 0) return

    const eventDocIds = eventDocs.map((ed) => ed.document_id)

    // Get documents that require confirmation (matching type and assigned to event)
    const { data: requiredDocs } = await supabase
      .from("documents")
      .select("id")
      .in("id", eventDocIds)
      .in("document_type_id", requiredTypeIds)

    if (!requiredDocs || requiredDocs.length === 0) return

    // Get the current versions of these documents
    const docIds = requiredDocs.map((d) => d.id)
    const { data: currentVersions } = await supabase
      .from("document_versions")
      .select("id, document_id")
      .in("document_id", docIds)
      .eq("is_current", true)

    if (!currentVersions || currentVersions.length === 0) return

    // Check which of these the visitor has confirmed
    const versionIds = currentVersions.map((v) => v.id)
    const { data: confirmations } = await supabase
      .from("visitor_confirmations")
      .select("document_version_id")
      .eq("visitor_id", visitorId)
      .eq("event_id", eventId)
      .in("document_version_id", versionIds)

    // If all required documents are confirmed, update RSVP status
    if (confirmations && confirmations.length >= currentVersions.length) {
      await supabase
        .from("event_visitors")
        .update({ rsvp_status: "confirmed" })
        .eq("visitor_id", visitorId)
        .eq("event_id", eventId)
    }
  }

  const handleConfirmation = async () => {
    if (!visitorId || !eventId || !currentDocumentId || !currentVersionId) {
      setError("Unable to save confirmation. Please try again.")
      return
    }

    setConfirmingDocument(true)

    try {
      const { error: insertError } = await supabase
        .from("visitor_confirmations")
        .insert({
          visitor_id: visitorId,
          event_id: eventId,
          document_id: currentDocumentId,
          document_version_id: currentVersionId,
          form_name: documentName,
          signed_at: new Date().toISOString(),
        })

      if (insertError) {
        setError(`Failed to save confirmation: ${insertError.message}`)
      } else {
        setConfirmationSuccess(true)
        setAlreadyConfirmed(true)

        // Refresh confirmation status to update card indicators
        await fetchConfirmationStatus()

        // Check if all required documents are now confirmed
        await checkAllDocumentsConfirmed()
      }
    } catch (err) {
      console.error("Error saving confirmation:", err)
      setError("An error occurred while saving your confirmation.")
    }

    setConfirmingDocument(false)
  }

  const closeDialog = () => {
    setDialogOpen(false)
    setDocumentUrl(null)
    setError(null)
    setDocumentMimeType(null)
    setRequiresConfirmation(false)
    setHasScrolledToBottom(false)
    setIsConfirmed(false)
    setConfirmationSuccess(false)
  }

  const isPdf = documentMimeType === "application/pdf"

  return (
    <section id="features" className="py-20 sm:py-32 bg-background">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Everything you need to succeed
          </h2>
          <p className="mt-4 text-lg text-white/90 max-w-2xl mx-auto">
            Review each item below and complete as required.
          </p>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {featureDefinitions.map((feature) => (
            <Card
              key={feature.key}
              className="bg-background cursor-pointer transition-all hover:scale-[1.02] hover:shadow-lg relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              onClick={() => handleCardClick(feature.documentType, feature.title)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault()
                  handleCardClick(feature.documentType, feature.title)
                }
              }}
              role="button"
              tabIndex={0}
              aria-label={`View ${feature.title} document`}
            >
              {confirmedDocTypes.has(feature.documentType) ? (
                <div className="absolute top-3 right-3">
                  <CheckCircle2 className="h-6 w-6 text-green-500" />
                </div>
              ) : requiresConfirmationDocTypes.has(feature.documentType) ? (
                <div className="absolute top-3 right-3">
                  <AlertCircle className="h-6 w-6 text-yellow-500" />
                </div>
              ) : null}
              <CardHeader>
                <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <feature.icon className="h-5 w-5 text-primary" />
                </div>
                <CardTitle className="text-lg">{feature.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-base text-white/90">
                  {feature.description}
                </CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{documentName}</DialogTitle>
          </DialogHeader>

          {requiresConfirmation && !alreadyConfirmed && !confirmationSuccess && documentUrl && !loading && !error && (
            <p className="text-base text-white/90 text-center px-6">
              Please review the entire document before confirming.
            </p>
          )}

          <div className="flex-1 overflow-hidden p-6 pt-4 flex flex-col">
            {loading && (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="ml-2 text-muted-foreground">Loading document...</span>
              </div>
            )}

            {error && !loading && (
              <div className="flex items-center justify-center h-64">
                <div className="text-center">
                  <p className="text-muted-foreground">{error}</p>
                </div>
              </div>
            )}

            {documentUrl && !loading && !error && (
              <>
                <div
                  ref={scrollContainerRef}
                  className="flex-1 overflow-auto rounded-lg border"
                  style={{ maxHeight: requiresConfirmation ? "65vh" : "75vh" }}
                >
                  {isPdf ? (
                    <iframe
                      src={`${documentUrl}#toolbar=0&navpanes=0`}
                      className="w-full h-full min-h-[500px]"
                      title={documentName}
                      onLoad={() => {
                        // For PDFs, we can't track internal scroll, so enable after load
                        if (requiresConfirmation) {
                          setTimeout(() => setHasScrolledToBottom(true), 2000)
                        }
                      }}
                    />
                  ) : (
                    <div className="p-4">
                      <p className="text-muted-foreground mb-4">
                        This document type cannot be previewed directly. Please download it to view.
                      </p>
                      <Button asChild>
                        <a href={documentUrl} target="_blank" rel="noopener noreferrer" download>
                          Download Document
                        </a>
                      </Button>
                    </div>
                  )}
                </div>

                {requiresConfirmation && (
                  <div className="mt-4 pt-4 border-t">
                    {confirmationSuccess ? (
                      <div className="flex flex-col items-center gap-4">
                        <div className="flex items-center gap-2 text-white/90">
                          <CheckCircle2 className="h-5 w-5" />
                          <span className="font-medium">Thank you for confirming this document.</span>
                        </div>
                        <Button onClick={closeDialog}>Close</Button>
                      </div>
                    ) : alreadyConfirmed ? (
                      <div className="flex flex-col items-center gap-4">
                        <div className="flex items-center gap-2 text-white/90">
                          <CheckCircle2 className="h-5 w-5" />
                          <span className="font-medium">You have already confirmed this document.</span>
                        </div>
                        <Button onClick={closeDialog}>Close</Button>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {hasScrolledToBottom && (
                          <label className="flex items-start gap-3 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={isConfirmed}
                              onChange={(e) => setIsConfirmed(e.target.checked)}
                              className="mt-1 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                            />
                            <span className="text-sm">
                              I acknowledge that I have read and understand the contents of this document.
                            </span>
                          </label>
                        )}

                        <div className="flex justify-end">
                          <Button
                            onClick={handleConfirmation}
                            disabled={!hasScrolledToBottom || !isConfirmed || confirmingDocument}
                          >
                            {confirmingDocument ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Confirming...
                              </>
                            ) : (
                              "Confirm Acknowledgment"
                            )}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </section>
  )
}
