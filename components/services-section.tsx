import { CreditCard, Wallet, PiggyBank, LineChart, Shield, Smartphone } from "lucide-react"

const services = [
  {
    icon: CreditCard,
    title: "Post Automation",
    description: "Automatically post to Product Hunt, Twitter, Reddit, Hacker News, and more with AI-generated content.",
  },
  {
    icon: Wallet,
    title: "Video Generation",
    description: "Turn your GitHub repo into stunning demo videos. No editing skills required. Powered by Remotion.",
  },
  {
    icon: PiggyBank,
    title: "Cold Outreach",
    description: "AI finds and emails your ideal customers. Hyper-personalized messages that actually get replies.",
  },
  {
    icon: LineChart,
    title: "Analytics & Insights",
    description: "Track performance across all platforms with detailed analytics and actionable insights.",
  },
  {
    icon: Shield,
    title: "AutoPilot Mode",
    description: "Set it and forget it. Activate AutoPilot and watch Streb handle your entire marketing strategy.",
  },
  {
    icon: Smartphone,
    title: "Multi-Platform",
    description: "Seamlessly integrate with all major platforms and tools in your marketing stack.",
  },
]

export function ServicesSection() {
  return (
    <section id="services" className="py-24 px-6">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="font-sans text-5xl font-bold mb-6 text-balance text-white text-adaptive">Everything you need to <em className="italic text-[#ADA996] text-adaptive">go viral</em></h2>
          <p className="text-gray-300 max-w-2xl mx-auto leading-relaxed">
            Explore our comprehensive <em className="italic text-[#ADA996]">marketing automation</em> services, from content creation to customer outreach, all designed to accelerate your app&apos;s growth.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {services.map((service, index) => (
            <div key={index} className="group relative rounded-3xl transition-all duration-300">
              {/* Gradient border wrapper - only visible on hover */}
              <div className="absolute inset-0 bg-gradient-to-b from-[#ADA996] to-transparent rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

              {/* Card content */}
              <div className="relative bg-card p-8 rounded-3xl h-full border border-border group-hover:border-transparent transition-all duration-300 m-[1px] text-center">
                <div className="w-12 h-12 border border-border rounded-xl flex items-center justify-center mb-6 group-hover:border-foreground/30 transition-colors mx-auto">
                  <service.icon className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-xl font-bold mb-3 text-white">{service.title}</h3>
                <p className="text-gray-300 leading-relaxed text-sm">{service.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
