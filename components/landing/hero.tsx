import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { ArrowRight, ChevronDown } from "lucide-react"

interface HeroProps {
  isAuthenticated?: boolean
}

export function Hero({ isAuthenticated = false }: HeroProps) {
  return (
    <section className="relative overflow-hidden min-h-[calc(100vh-4rem)] flex items-center">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-2 lg:gap-8 items-center">
          <div className="flex flex-col gap-6">
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
              Welcome to <span style={{ color: '#7A8F98' }}>Montana</span>
            </h1>
            <p className="text-lg text-white/90 max-w-xl">
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
            <p className="text-sm text-white/90">
              No credit card required. Start building in minutes.
            </p>
          </div>
          <div className="relative">
          </div>
        </div>
      </div>
      {isAuthenticated && (
        <Link
          href="#features"
          className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white/50 hover:text-white/80 transition-colors animate-bounce"
        >
          <ChevronDown className="h-8 w-8" />
          <span className="sr-only">Scroll to features</span>
        </Link>
      )}
    </section>
  )
}
