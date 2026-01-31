"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { ShieldCheck, HeartPulse, Utensils, Map, Mountain, Calendar, X, Loader2 } from "lucide-react"

interface FeaturesProps {
  eventId: string | null
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

export function Features({ eventId }: FeaturesProps) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [documentUrl, setDocumentUrl] = useState<string | null>(null)
  const [documentName, setDocumentName] = useState<string>("")
  const [documentMimeType, setDocumentMimeType] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const supabase = createClient()

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
    setDialogOpen(true)

    try {
      // First, get the document type ID
      const { data: docType } = await supabase
        .from("document_types")
        .select("id")
        .eq("name", documentType)
        .single()

      if (!docType) {
        setError(`No ${title} document type found.`)
        setLoading(false)
        return
      }

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

      // Get the current version of this document
      const { data: currentVersion } = await supabase
        .from("document_versions")
        .select("file_path, file_name, mime_type")
        .eq("document_id", doc.id)
        .eq("is_current", true)
        .single()

      if (!currentVersion || !currentVersion.file_path) {
        setError(`The ${title} document has no uploaded file yet.`)
        setLoading(false)
        return
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

  const closeDialog = () => {
    setDialogOpen(false)
    setDocumentUrl(null)
    setError(null)
    setDocumentMimeType(null)
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
            Everything you need to know for an unforgettable stay at West Creek Ranch.
          </p>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {featureDefinitions.map((feature) => (
            <Card
              key={feature.key}
              className="bg-background cursor-pointer transition-all hover:scale-[1.02] hover:shadow-lg"
              onClick={() => handleCardClick(feature.documentType, feature.title)}
            >
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] flex flex-col p-0">
          <DialogHeader className="p-6 pb-0">
            <div className="flex items-center justify-between">
              <DialogTitle>{documentName}</DialogTitle>
              <Button variant="ghost" size="icon" onClick={closeDialog}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-hidden p-6 pt-4">
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
              <div className="h-[70vh] overflow-auto rounded-lg border">
                {isPdf ? (
                  <iframe
                    src={documentUrl}
                    className="w-full h-full"
                    title={documentName}
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
            )}
          </div>
        </DialogContent>
      </Dialog>
    </section>
  )
}
