import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Header } from "@/components/landing/header"
import { Footer } from "@/components/landing/footer"
import { AdminSidebar } from "@/components/admin/sidebar"

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("security_group")
    .eq("id", user.id)
    .single()

  if (profile?.security_group !== "admin") {
    redirect("/")
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header initialUser={user} />
      <div className="flex flex-1">
        <AdminSidebar />
        <main className="flex-1 bg-background p-6">
          {children}
        </main>
      </div>
      <Footer isAuthenticated />
    </div>
  )
}
