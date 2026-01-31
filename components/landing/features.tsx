import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ShieldCheck, HeartPulse, Utensils, Map, Mountain, Calendar } from "lucide-react"

const features = [
  {
    title: "Safety",
    description: "Your safety is our top priority with 24/7 on-site support and emergency protocols.",
    icon: ShieldCheck,
  },
  {
    title: "Medical",
    description: "Access to medical resources and first aid facilities for your peace of mind.",
    icon: HeartPulse,
  },
  {
    title: "Food Preferences",
    description: "Customizable dining options to accommodate all dietary needs and preferences.",
    icon: Utensils,
  },
  {
    title: "Directions",
    description: "Easy-to-follow guides and maps to help you navigate the ranch and surrounding areas.",
    icon: Map,
  },
  {
    title: "Activities and Amenities",
    description: "Explore outdoor adventures, modern comforts, and conveniences to make your stay memorable.",
    icon: Mountain,
  },
  {
    title: "Schedule of Events",
    description: "View the full itinerary of activities and events planned during your visit.",
    icon: Calendar,
  },
]

export function Features() {
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
          {features.map((feature) => (
            <Card key={feature.title} className="bg-background">
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
    </section>
  )
}
