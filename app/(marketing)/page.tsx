import { Header } from "@/components/header"
import { HeroSection } from "@/components/hero-section"
import { ServicesSection } from "@/components/services-section"
import { FeaturesSection } from "@/components/features-section"
import { PricingSection } from "@/components/pricing-section"
import { TestimonialsSection } from "@/components/testimonials-section"
import { FAQSection } from "@/components/faq-section"
import { CTASection } from "@/components/cta-section"
import { Footer } from "@/components/footer"
import { GradientBackground } from "@/components/gradient-background"

export default function Home() {
  return (
    <main className="relative min-h-screen bg-background">
      <GradientBackground />
      <Header />
      <HeroSection />
      <ServicesSection />
      <FeaturesSection />
      <CTASection />
      <PricingSection />
      <TestimonialsSection />
      <FAQSection />
      <Footer />
    </main>
  )
}