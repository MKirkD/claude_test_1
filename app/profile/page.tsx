"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Header } from "@/components/landing/header"
import { Footer } from "@/components/landing/footer"
import type { User } from "@supabase/supabase-js"

interface Profile {
  id: string
  first_name: string | null
  last_name: string | null
  account_type: string
}

export default function ProfilePage() {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const getProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        router.push("/login")
        return
      }

      setUser(user)

      const { data: profile, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single()

      if (profile) {
        setProfile(profile)
        setFirstName(profile.first_name || "")
        setLastName(profile.last_name || "")
      } else if (error?.code === "PGRST116") {
        // No profile exists, create one for existing users
        const { data: newProfile } = await supabase
          .from("profiles")
          .insert({ id: user.id })
          .select()
          .single()

        if (newProfile) {
          setProfile(newProfile)
        }
      }

      setLoading(false)
    }

    getProfile()
  }, [supabase, router])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setMessage(null)

    const { error } = await supabase
      .from("profiles")
      .update({
        first_name: firstName,
        last_name: lastName,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user?.id)

    if (error) {
      setMessage({ type: "error", text: error.message })
    } else {
      setMessage({ type: "success", text: "Profile updated successfully" })
      setProfile((prev) => prev ? { ...prev, first_name: firstName, last_name: lastName } : null)
    }

    setSaving(false)
  }

  const getAccountTypeLabel = (type: string) => {
    switch (type) {
      case "free":
        return "Free"
      case "pro":
        return "Pro"
      case "enterprise":
        return "Enterprise"
      default:
        return type
    }
  }

  const getAccountTypeBadgeColor = (type: string) => {
    switch (type) {
      case "pro":
        return "bg-primary text-primary-foreground"
      case "enterprise":
        return "bg-zinc-800 text-white"
      default:
        return "bg-zinc-200 text-zinc-800"
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header initialUser={null} />
        <div className="flex flex-1 items-center justify-center bg-background">
          <p className="text-muted-foreground">Loading...</p>
        </div>
        <Footer isAuthenticated />
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header initialUser={user} />
      <main className="flex-1 bg-background py-20 sm:py-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Profile Management
            </h1>
            <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
              Manage your profile and administer account settings
            </p>
          </div>
          <div className="grid gap-8 lg:grid-cols-2">
            <Card className="relative flex flex-col">
              <CardHeader>
                <CardTitle>Profile</CardTitle>
                <CardDescription>Manage your personal information</CardDescription>
              </CardHeader>
              <form onSubmit={handleSave}>
                <CardContent className="flex-1 space-y-6">
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

                  <div className="space-y-2 pb-8">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={user?.email || ""}
                      disabled
                      className="bg-muted"
                    />
                    <p className="text-xs text-muted-foreground">
                      Email cannot be changed
                    </p>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2 pb-8">
                    <div className="space-y-2">
                      <Label htmlFor="firstName">First Name</Label>
                      <Input
                        id="firstName"
                        type="text"
                        placeholder="Enter your first name"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lastName">Last Name</Label>
                      <Input
                        id="lastName"
                        type="text"
                        placeholder="Enter your last name"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                      />
                    </div>
                  </div>
                </CardContent>
                <CardFooter>
                  <Button type="submit" className="w-full" disabled={saving}>
                    {saving ? "Saving..." : "Save changes"}
                  </Button>
                </CardFooter>
              </form>
            </Card>

            <Card className="relative flex flex-col">
              <CardHeader>
                <CardTitle>Account</CardTitle>
                <CardDescription>Manage your subscription and billing</CardDescription>
              </CardHeader>
              <CardContent className="flex-1">
                <div className="space-y-2">
                  <Label>Account Type</Label>
                  <div className="flex items-center gap-3">
                    <span
                      className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${getAccountTypeBadgeColor(
                        profile?.account_type || "free"
                      )}`}
                    >
                      {getAccountTypeLabel(profile?.account_type || "free")}
                    </span>
                    {profile?.account_type === "free" && (
                      <Link
                        href="/#pricing"
                        className="text-sm text-primary hover:underline"
                      >
                        Upgrade your plan
                      </Link>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}
