import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowRight } from "lucide-react"

export function Hero() {
  return (
    <section className="relative overflow-hidden py-20 sm:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-2 lg:gap-8 items-center">
          <div className="flex flex-col gap-6">
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
              Build faster.{" "}
              <span className="text-primary">Ship smarter.</span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-xl">
              The all-in-one platform for modern teams. Streamline your workflow,
              collaborate seamlessly, and deliver exceptional results.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Button size="lg" asChild>
                <Link href="/signup">
                  Get started NOW
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" className="border-zinc-400" asChild>
                <Link href="#features">Learn more</Link>
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              No credit card required. Start building in minutes.
            </p>
          </div>
          <div className="relative">
            <div className="aspect-square w-full max-w-lg mx-auto rounded-2xl bg-gradient-to-br from-primary/20 via-primary/10 to-transparent p-8">
              <div className="h-full w-full rounded-xl bg-card border shadow-lg flex items-center justify-center">
                <div className="text-center p-8">
                  <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                    <div className="h-8 w-8 rounded-full bg-primary"></div>
                  </div>
                  <div className="space-y-2">
                    <div className="h-4 w-32 mx-auto rounded bg-muted"></div>
                    <div className="h-3 w-24 mx-auto rounded bg-muted"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
