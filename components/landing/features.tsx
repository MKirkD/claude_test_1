import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Zap, Shield, BarChart3, Users, Cloud, Code } from "lucide-react"

const features = [
  {
    title: "Lightning Fast",
    description: "Built for speed with edge computing and optimized performance at every layer.",
    icon: Zap,
  },
  {
    title: "Secure by Default",
    description: "Enterprise-grade security with end-to-end encryption and compliance built in.",
    icon: Shield,
  },
  {
    title: "Real-time Analytics",
    description: "Get instant insights with powerful dashboards and custom reporting tools.",
    icon: BarChart3,
  },
  {
    title: "Team Collaboration",
    description: "Work together seamlessly with real-time editing and communication tools.",
    icon: Users,
  },
  {
    title: "Cloud Native",
    description: "Deploy anywhere with automatic scaling and global edge distribution.",
    icon: Cloud,
  },
  {
    title: "Developer First",
    description: "APIs, SDKs, and integrations that developers love. Build anything.",
    icon: Code,
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
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
            Powerful features that help your team move faster and deliver more value.
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
                <CardDescription className="text-base">
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
