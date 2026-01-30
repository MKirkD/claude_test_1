import { createClient } from "@/lib/supabase/server"
import { Header } from "@/components/landing/header"
import { Hero } from "@/components/landing/hero"
import { Features } from "@/components/landing/features"
import { Pricing } from "@/components/landing/pricing"
import { Footer } from "@/components/landing/footer"

export default async function Home() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

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
          <Hero />
          {user && (
            <>
              <Features />
              <Pricing />
            </>
          )}
        </main>
        <Footer isAuthenticated={!!user} />
      </div>
    </div>
  )
}
