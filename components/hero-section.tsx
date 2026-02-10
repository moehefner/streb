"use client"

import { ArrowUpRight, ArrowRight, CreditCard } from "lucide-react"
import { useEffect, useState } from "react"
import { AnimatedText } from "./animated-text"

function useCountUp(end: number, duration = 2000, suffix = "") {
  const [count, setCount] = useState(0)

  useEffect(() => {
    let startTime: number
    let animationFrame: number

    const animate = (currentTime: number) => {
      if (!startTime) startTime = currentTime
      const progress = Math.min((currentTime - startTime) / duration, 1)

      const easeOutQuart = 1 - Math.pow(1 - progress, 4)
      setCount(Math.floor(easeOutQuart * end))

      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate)
      }
    }

    animationFrame = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(animationFrame)
  }, [end, duration])

  return count + suffix
}

export function HeroSection() {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(true)
    }, 500)
    return () => clearTimeout(timer)
  }, [])

  const cashback = useCountUp(3, 2000, "%")
  const annualFees = useCountUp(0, 2000, "%")
  const customers = useCountUp(10, 2000, "M+")
  const satisfaction = useCountUp(99, 2000, "%")

  return (
    <section className="pt-32 pb-24 px-6">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <div
            className={`transition-all duration-1000 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-4"}`}
          >

            <h1 className="font-serif text-5xl md:text-6xl font-bold leading-tight mb-6 lg:text-8xl w-full text-white text-adaptive">
              Automate your <em className="italic text-[#ADA996] text-adaptive">SaaS marketing</em> with <em className="italic text-[#ADA996] text-adaptive">AI-powered</em> workflows
            </h1>
          </div>

          <p
            className={`max-w-2xl mx-auto leading-relaxed mb-10 transition-all duration-1000 delay-[800ms] text-base text-gray-300 text-adaptive ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}
          >
            Launch, market, and grow your app <em className="italic text-[#ADA996] text-adaptive">automatically</em> with AI. From <em className="italic text-[#ADA996] text-adaptive">Product Hunt</em> to <em className="italic text-[#ADA996] text-adaptive">viral videos</em> to cold outreach - all in one platform.
          </p>
        </div>

        <div className="flex flex-col items-center justify-center gap-12">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12 max-w-6xl">
            <div
              className={`text-left transition-all duration-1000 delay-200 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}
            >
              <p className="text-6xl font-medium bg-gradient-to-r from-[#ADA996] to-[#F2F2F2] bg-clip-text text-transparent mb-2">
                {cashback}
              </p>
              <p className="text-base font-bold text-white mb-1">Conversion Rate</p>
              <p className="text-sm text-gray-300 leading-relaxed">
                Average conversion increase with our automated marketing campaigns.
              </p>
            </div>

            <div
              className={`text-left transition-all duration-1000 delay-300 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}
            >
              <p className="text-6xl font-medium bg-gradient-to-r from-[#ADA996] to-[#F2F2F2] bg-clip-text text-transparent mb-2">
                {annualFees}
              </p>
              <p className="text-base font-bold text-white mb-1">Setup Time</p>
              <p className="text-sm text-gray-300 leading-relaxed">
                Minutes to set up your entire marketing automation workflow.
              </p>
            </div>

            <div
              className={`text-left transition-all duration-1000 delay-[400ms] ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}
            >
              <p className="text-6xl font-medium bg-gradient-to-r from-[#ADA996] to-[#F2F2F2] bg-clip-text text-transparent mb-2">
                {customers}
              </p>
              <p className="text-base font-bold text-white mb-1">Apps Launched</p>
              <p className="text-sm text-gray-300 leading-relaxed">
                Successful app launches powered by our automation platform.
              </p>
            </div>

            <div
              className={`text-left transition-all duration-1000 delay-500 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}
            >
              <p className="text-6xl font-medium bg-gradient-to-r from-[#ADA996] to-[#F2F2F2] bg-clip-text text-transparent mb-2">
                {satisfaction}
              </p>
              <p className="text-base font-bold text-white mb-1">Success Rate</p>
              <p className="text-sm text-gray-300 leading-relaxed">
                Of users see significant growth within the first month.
              </p>
            </div>
          </div>
        </div>

        <div
          className={`flex justify-center mt-16 transition-all duration-1000 delay-[600ms] ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}
        >
          <a href="/sign-up" className="relative flex items-center gap-0 border border-border rounded-full pl-6 pr-1.5 py-1.5 transition-all duration-300 group overflow-hidden">
            {/* Background that expands on hover */}
            <span className="absolute inset-0 bg-white rounded-full scale-0 group-hover:scale-100 transition-transform duration-300 origin-right" />

            <span className="relative text-sm text-white group-hover:text-black pr-4 uppercase tracking-wide transition-colors duration-300">
              Start Free Trial
            </span>
            <span className="relative w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300">
              <ArrowRight className="w-4 h-4 text-white group-hover:hidden" />
              <ArrowUpRight className="w-4 h-4 text-black hidden group-hover:block" />
            </span>
          </a>
        </div>
      </div>
    </section>
  )
}