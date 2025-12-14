import { Header, Hero, Features, TechStack, GettingStarted, Footer } from "@/components/landing"

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <Hero />
      <Features />
      <TechStack />
      <GettingStarted />
      <Footer />
    </div>
  )
}
