import { createClient } from "@/lib/supabase/server"
import { Header } from "@/components/landing/header"
import { Hero } from "@/components/landing/hero"
import { Features } from "@/components/landing/features"
import { Pricing } from "@/components/landing/pricing"
import { Footer } from "@/components/landing/footer"

interface UpcomingEvent {
  id: string
  start_date: string
  end_date: string
}

export default async function Home() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let firstName: string | null = null
  let upcomingEvent: UpcomingEvent | null = null
  let visitorId: string | null = null

  if (user) {
    // Get user's profile for first name
    const { data: profile } = await supabase
      .from("profiles")
      .select("first_name")
      .eq("id", user.id)
      .single()

    firstName = profile?.first_name || null

    // Get visitor record linked to this profile
    const { data: visitor } = await supabase
      .from("visitors")
      .select("id")
      .eq("profile_id", user.id)
      .single()

    if (visitor) {
      visitorId = visitor.id

      // Get the next upcoming event for this visitor
      const today = new Date().toISOString().split("T")[0]
      const { data: eventVisitor } = await supabase
        .from("event_visitors")
        .select(`
          event:events (
            id,
            start_date,
            end_date
          )
        `)
        .eq("visitor_id", visitor.id)
        .gte("event.start_date", today)
        .order("event(start_date)", { ascending: true })
        .limit(1)
        .single()

      if (eventVisitor?.event) {
        upcomingEvent = eventVisitor.event as UpcomingEvent
      }
    }
  }

  return (
    <div className="flex min-h-screen flex-col relative">
      <div
        className="fixed inset-0 z-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url('/westcreek_stone.jpg')" }}
      />
      {/* <div className="fixed inset-0 z-0 bg-background/70" /> */}
      <div className="relative z-10 flex min-h-screen flex-col">
        <Header initialUser={user} />
        <main className="flex-1">
          <Hero
            isAuthenticated={!!user}
            firstName={firstName}
            upcomingEvent={upcomingEvent}
          />
          {user && (
            <>
              <Features eventId={upcomingEvent?.id || null} visitorId={visitorId} />
              <Pricing />
            </>
          )}
        </main>
        <Footer isAuthenticated={!!user} />
      </div>
    </div>
  )
}
