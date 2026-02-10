import { Calendar, ArrowUpRight, BookOpen } from "lucide-react"

const blogPosts = [
  {
    title: "How to Launch on Product Hunt: Complete Guide",
    excerpt: "Everything you need to know to successfully launch your SaaS on Product Hunt and get featured.",
    date: "Dec 15, 2024",
    readTime: "5 min read",
    category: "Launch Strategy"
  },
  {
    title: "AI-Generated Videos: The Future of SaaS Marketing",
    excerpt: "Learn how AI-generated demo videos are revolutionizing how SaaS companies showcase their products.",
    date: "Dec 12, 2024", 
    readTime: "8 min read",
    category: "Video Marketing"
  },
  {
    title: "Cold Email Automation That Actually Works",
    excerpt: "Discover the strategies and templates that generate 40%+ open rates and drive real conversions.",
    date: "Dec 8, 2024",
    readTime: "6 min read", 
    category: "Email Marketing"
  }
]

export function BlogSection() {
  return (
    <section id="blog" className="py-24 px-6">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#ADA996] to-[#F2F2F2] rounded-full mb-6">
            <BookOpen className="w-4 h-4 text-black" />
            <span className="text-xs text-black uppercase tracking-widest">Blog</span>
          </div>
          <h2 className="font-sans text-5xl font-normal mb-6 text-balance">Latest insights and guides</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Learn from our marketing automation experts and stay ahead of the curve.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {blogPosts.map((post, index) => (
            <article key={index} className="group cursor-pointer">
              <div className="bg-card border border-border rounded-3xl p-8 h-full transition-all duration-300 group-hover:border-foreground/20">
                <div className="mb-4">
                  <span className="text-xs text-muted-foreground uppercase tracking-wider">{post.category}</span>
                </div>
                
                <h3 className="text-xl font-medium text-foreground mb-3 group-hover:text-foreground/80 transition-colors">
                  {post.title}
                </h3>
                
                <p className="text-muted-foreground text-sm leading-relaxed mb-6">
                  {post.excerpt}
                </p>
                
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      <span>{post.date}</span>
                    </div>
                    <span>{post.readTime}</span>
                  </div>
                  <ArrowUpRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}