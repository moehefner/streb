import { Star } from "lucide-react"
import Image from "next/image"

const testimonials = [
  {
    name: "Alex Chen",
    role: "TaskMaster.io",
    content:
      "Streb helped us get 500+ signups in the first month. The AI-generated posts actually convert!",
    rating: 5,
    avatar: "/avatars/1.jpg",
  },
  {
    name: "Priya Nair",
    role: "LaunchBoard.app",
    content:
      "We stopped wasting hours on content calendars. AutoPilot ships daily posts and outreach while we build product.",
    rating: 5,
    avatar: "/avatars/2.jpg",
  },
  {
    name: "Daniel Kim",
    role: "GrowthLoop.dev",
    content:
      "The onboarding took 10 minutes, then Streb handled everything. We finally have consistent growth every week.",
    rating: 5,
    avatar: "/avatars/3.jpg",
  },
]

export function TestimonialsSection() {
  return (
    <section className="py-24 px-6">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="font-sans text-5xl font-normal mb-6 text-balance">Trusted by Indie Hackers</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Join hundreds of founders using Streb to grow their apps.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {testimonials.map((testimonial, index) => (
            <div key={index} className="bg-card border border-border rounded-3xl p-8">
              <div className="flex items-center gap-3 mb-5">
                <Image
                  src={testimonial.avatar}
                  alt={`${testimonial.name} avatar`}
                  width={48}
                  height={48}
                  className="h-12 w-12 rounded-full object-cover bg-muted"
                />
                <div>
                  <p className="text-sm font-semibold text-foreground">{testimonial.name}</p>
                  <p className="text-xs text-muted-foreground">{testimonial.role}</p>
                </div>
              </div>

              <p className="text-foreground mb-6 leading-relaxed">&quot;{testimonial.content}&quot;</p>

              <div className="flex gap-1">
                {[...Array(testimonial.rating)].map((_, i) => (
                  <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
