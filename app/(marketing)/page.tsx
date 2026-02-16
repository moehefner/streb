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
      <section className="py-12 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 gap-6 text-center sm:grid-cols-3">
            <div>
              <p className="text-2xl font-bold text-foreground">500+</p>
              <p className="text-sm text-muted-foreground">Apps Launched</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">50K+</p>
              <p className="text-sm text-muted-foreground">Posts Generated</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">10K+</p>
              <p className="text-sm text-muted-foreground">Videos Created</p>
            </div>
          </div>
        </div>
      </section>
      <TestimonialsSection />
      <FAQSection />
      <Footer />
    </main>
  )
}
