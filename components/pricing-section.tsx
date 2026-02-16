import { Check, ArrowUpRight, ArrowRight } from "lucide-react"
import Link from "next/link"

const plans = [
  {
    name: "Free",
    price: "$0",
    period: "/mo",
    description: "Perfect to get started with Streb",
    features: [
      "5 posts per month",
      "3 videos per month",
      "25 emails per month",
      "Basic analytics",
      "Community support",
    ],
    cta: "Start Free",
    href: "/sign-up",
    popular: false,
  },
  {
    name: "Starter",
    price: "$49",
    period: "/mo",
    description: "For growing SaaS businesses",
    features: [
      "100 posts per month",
      "25 videos per month",
      "750 emails per month",
      "Advanced analytics",
      "Priority support",
      "AutoPilot mode",
    ],
    cta: "Start Free Trial",
    href: "/pricing?plan=starter",
    popular: true,
  },
  {
    name: "Pro",
    price: "$99",
    period: "/mo",
    description: "For established SaaS companies",
    features: [
      "250 posts per month",
      "75 videos per month",
      "2,000 emails per month",
      "A/B testing",
      "Custom integrations",
      "Dedicated support",
    ],
    cta: "Start Free Trial",
    href: "/pricing?plan=pro",
    popular: false,
  },
]

export function PricingSection() {
  return (
    <section id="pricing" className="py-24 px-6">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="font-sans text-5xl font-bold mb-6 text-balance text-white text-adaptive">Pricing that <em className="italic text-[#ADA996] text-adaptive">scales with you</em></h2>
          <p className="text-gray-300 max-w-2xl mx-auto leading-relaxed">
            <em className="italic text-[#ADA996]">Transparent pricing</em> with no hidden fees. Change plans or cancel anytime.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {plans.map((plan, index) => (
            <div key={index} className="relative group">
              {/* Halo effect on hover - positioned outside card */}
              <div className="absolute -inset-4 rounded-[2rem] bg-gradient-to-b from-white/20 to-transparent blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

              <div
                className={`relative bg-card border p-8 flex flex-col rounded-3xl text-center ${
                  plan.popular ? "border-foreground/50" : "border-border"
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                    <span className="bg-foreground text-background text-xs font-medium px-3 py-1 rounded-full uppercase tracking-wider">
                      Popular
                    </span>
                  </div>
                )}

                <div className="mb-8">
                  <h3 className="text-xl font-bold text-white mb-2">{plan.name}</h3>
                  <p className="text-sm text-gray-300 mb-4">{plan.description}</p>
                  <div className="flex items-baseline gap-1 justify-center">
                    <span className="text-4xl font-bold text-white">{plan.price}</span>
                    <span className="text-gray-400 text-sm">{plan.period}</span>
                  </div>
                </div>

                <ul className="space-y-3 mb-8 flex-grow">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-center gap-3 justify-center">
                      <div className="w-5 h-5 border border-border rounded-full flex items-center justify-center flex-shrink-0">
                        <Check className="w-3 h-3 text-white" />
                      </div>
                      <span className="text-sm text-white font-semibold">{feature}</span>
                    </li>
                  ))}
                </ul>

                <Link
                  href={plan.href}
                  className={`relative flex items-center gap-0 border rounded-full pl-5 pr-1 py-1 transition-all duration-300 group/btn overflow-hidden mx-auto ${
                    plan.popular ? "border-foreground/50" : "border-border"
                  }`}
                >
                  <span
                    className={`absolute inset-0 rounded-full scale-x-0 origin-right group-hover/btn:scale-x-100 transition-transform duration-300 ${
                      plan.popular ? "bg-foreground" : "bg-foreground"
                    }`}
                  />
                  <span
                    className={`text-sm pr-3 relative z-10 transition-colors duration-300 ${
                      plan.popular
                        ? "text-foreground group-hover/btn:text-background"
                        : "text-foreground group-hover/btn:text-background"
                    }`}
                  >
                    {plan.cta}
                  </span>
                  <span className="w-8 h-8 rounded-full flex items-center justify-center relative z-10">
                    <ArrowRight
                      className={`w-4 h-4 group-hover/btn:opacity-0 absolute transition-opacity duration-300 ${
                        plan.popular ? "text-foreground" : "text-foreground"
                      }`}
                    />
                    <ArrowUpRight
                      className={`w-4 h-4 opacity-0 group-hover/btn:opacity-100 transition-all duration-300 ${
                        plan.popular
                          ? "text-foreground group-hover/btn:text-background"
                          : "text-foreground group-hover/btn:text-background"
                      }`}
                    />
                  </span>
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
