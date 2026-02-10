"use client"

import { Check, Sparkles } from "lucide-react"
import { useState, useEffect, useRef } from "react"

const features = [
  "Setup in 5 minutes",
  "AI content generation",
  "Multi-platform posting",
  "24/7 automation",
  "No hidden fees",
  "Advanced analytics",
]

const allTransactions = [
  { name: "Product Hunt", amount: "+1,250", category: "Launch" },
  { name: "Twitter Post", amount: "+850", category: "Social" },
  { name: "Demo Video", amount: "+2,100", category: "Content" },
  { name: "Cold Email", amount: "+450", category: "Outreach" },
  { name: "Reddit Post", amount: "+320", category: "Community" },
  { name: "Blog Article", amount: "+680", category: "Content" },
  { name: "Newsletter", amount: "+1,500", category: "Email" },
  { name: "YouTube Video", amount: "+3,200", category: "Video" },
  { name: "LinkedIn Post", amount: "+890", category: "Professional" },
  { name: "App Store", amount: "+1,750", category: "Launch" },
]

export function FeaturesSection() {
  const [balance, setBalance] = useState(25847)
  const scrollRef = useRef<HTMLDivElement>(null)
  const animationRef = useRef<number>()
  const scrollPosition = useRef(0)
  const lastUpdateTime = useRef(0)

  const tripleTransactions = [...allTransactions, ...allTransactions, ...allTransactions]

  useEffect(() => {
    const animate = (timestamp: number) => {
      if (!scrollRef.current) {
        animationRef.current = requestAnimationFrame(animate)
        return
      }

      if (!lastUpdateTime.current) lastUpdateTime.current = timestamp
      const deltaTime = timestamp - lastUpdateTime.current
      lastUpdateTime.current = timestamp

      scrollPosition.current += (deltaTime / 1000) * 35

      const singleSetHeight = scrollRef.current.scrollHeight / 3

      if (scrollPosition.current >= singleSetHeight) {
        scrollPosition.current = 0

        const randomTransaction = allTransactions[Math.floor(Math.random() * allTransactions.length)]
        const amount = Number.parseInt(randomTransaction.amount.replace(/[,+]/g, ""))
        setBalance((prev) => prev + amount)
      }

      scrollRef.current.style.transform = `translateY(-${scrollPosition.current}px)`
      animationRef.current = requestAnimationFrame(animate)
    }

    animationRef.current = requestAnimationFrame(animate)

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [])

  return (
    <section id="features" className="py-24 px-6">
      <div className="max-w-7xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <div className="order-2 lg:order-1">
            <div className="bg-card border border-border p-6 shadow-xl rounded-3xl">
              <div className="space-y-6">
                <div className="flex items-center justify-between pb-4 border-b border-border">
                  <div>
                    <p className="text-xs text-gray-400 mb-1">Total reach this month</p>
                    <p className="text-3xl font-bold text-white transition-all duration-500">
                      {balance.toLocaleString("en-US")} users
                    </p>
                  </div>
                  <div className="w-10 h-10 border border-border rounded-full flex items-center justify-center">
                    <span className="text-white text-sm font-bold">S</span>
                  </div>
                </div>

                <div className="relative h-[240px] overflow-hidden">
                  <div className="absolute top-0 left-0 right-0 h-12 bg-gradient-to-b from-card to-transparent z-10 pointer-events-none" />

                  <div className="space-y-3">
                    <p className="text-xs text-gray-400 uppercase tracking-wider relative z-20">
                      Recent campaigns
                    </p>

                    <div className="relative">
                      <div ref={scrollRef} className="space-y-0 will-change-transform">
                        {tripleTransactions.map((tx, i) => (
                          <div
                            key={`${tx.name}-${i}`}
                            className="flex items-center justify-between py-3 border-b border-border"
                          >
                            <div className="flex items-center gap-4">
                              <div className="w-9 h-9 bg-card border border-border rounded-lg flex items-center justify-center">
                                <span className="text-xs text-muted-foreground">{tx.name[0]}</span>
                              </div>
                              <div>
                                <p className="text-sm text-white font-semibold">{tx.name}</p>
                                <p className="text-xs text-gray-400">{tx.category}</p>
                              </div>
                            </div>
                            <p className="text-sm text-white font-semibold">
                              {tx.amount} views
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-card to-transparent z-10 pointer-events-none" />
                </div>
              </div>
            </div>
          </div>

          <div className="order-1 lg:order-2 space-y-8">
            <div>
              <h2 className="font-sans text-5xl font-bold mb-6 text-balance text-white text-adaptive">
                Designed for <em className="italic text-[#ADA996] text-adaptive">SaaS builders</em> and <em className="italic text-[#ADA996] text-adaptive">indie hackers</em>
              </h2>
              <p className="text-gray-300 leading-relaxed">
                Launch your <em className="italic text-[#ADA996]">marketing automation</em> today and meet the future of app growth. Innovative solutions designed for your modern SaaS, offering <em className="italic text-[#ADA996]">efficiency</em>, reach, and excellent results.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              {features.map((feature, index) => (
                <div key={index} className="flex items-center gap-3">
                  <div className="w-5 h-5 border border-border rounded-full flex items-center justify-center flex-shrink-0">
                    <Check className="w-3 h-3 text-white" />
                  </div>
                  <span className="text-sm text-white font-semibold">{feature}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}