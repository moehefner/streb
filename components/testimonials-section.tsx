import { Star, Quote } from "lucide-react"

const testimonials = [
  {
    name: "Sarah Chen",
    role: "Founder, TaskFlow",
    content: "Streb helped us launch on Product Hunt and get 2,000+ signups on day one. The automation is incredible.",
    rating: 5,
    avatar: "/images/avatar1.jpg"
  },
  {
    name: "Marcus Rodriguez", 
    role: "CEO, DevTools Pro",
    content: "From zero to 10K users in 3 months. Streb's AI-generated content and outreach campaigns are game-changing.",
    rating: 5,
    avatar: "/images/avatar2.jpg"
  },
  {
    name: "Emily Watson",
    role: "Co-founder, FinanceApp",
    content: "The video generation feature alone saved us $10K in production costs. ROI was immediate.",
    rating: 5,
    avatar: "/images/avatar3.jpg"
  }
]

export function TestimonialsSection() {
  return (
    <section className="py-24 px-6">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="font-sans text-5xl font-normal mb-6 text-balance">What our customers say</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Join thousands of SaaS builders who have transformed their marketing with Streb.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {testimonials.map((testimonial, index) => (
            <div key={index} className="bg-card border border-border rounded-3xl p-8 text-center">
              <div className="flex gap-1 mb-4 justify-center">
                {[...Array(testimonial.rating)].map((_, i) => (
                  <Star key={i} className="w-4 h-4 fill-foreground text-foreground" />
                ))}
              </div>
              <p className="text-foreground mb-6 leading-relaxed">"{testimonial.content}"</p>
              <div className="flex items-center gap-3 justify-center">
                <div className="w-10 h-10 bg-muted rounded-full flex items-center justify-center">
                  <span className="text-sm font-medium text-foreground">{testimonial.name[0]}</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{testimonial.name}</p>
                  <p className="text-xs text-muted-foreground">{testimonial.role}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}