import { ArrowUpRight, ArrowRight, Play } from "lucide-react"

export function CTASection() {
  return (
    <section className="py-24 px-6">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="font-sans text-5xl font-bold leading-tight max-w-4xl mx-auto text-white text-adaptive">
            Ready to <em className="italic text-[#ADA996] text-adaptive">automate</em> your marketing and <em className="italic text-[#ADA996] text-adaptive">grow faster</em>?
          </h2>
        </div>

        <div className="flex justify-center mb-12">
          <div className="relative w-full max-w-4xl">
            {/* Gradient overlay - black to transparent from bottom */}
            <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent z-10 pointer-events-none" />

            {/* iPad hand image */}
            <img
              src="/images/ipad-hand.png"
              alt="Hands holding iPad showing Streb dashboard"
              className="w-full h-auto"
            />
          </div>
        </div>

        {/* Bottom stats and CTA */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="flex gap-12">
            <div>
              <p className="text-4xl font-bold text-white">1000+</p>
              <p className="text-xs text-gray-400 uppercase tracking-wider">Apps Launched</p>
            </div>
            <div>
              <p className="text-4xl font-bold text-white">5M+</p>
              <p className="text-xs text-gray-400 uppercase tracking-wider">Videos Created</p>
            </div>
          </div>

          <div className="flex flex-col items-center md:items-end gap-4">
            <p className="text-sm max-w-sm text-center md:text-right text-gray-300">
              Join <em className="italic text-[#ADA996]">1,000+ indie hackers</em> who are growing faster with Streb's <em className="italic text-[#ADA996]">AI-powered</em> marketing automation platform.
            </p>
            <a
              href="/sign-up"
              className="relative flex items-center gap-0 border border-border rounded-full pl-6 pr-1.5 py-1.5 transition-all duration-300 group overflow-hidden"
            >
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
      </div>
    </section>
  )
}