"use client"

import { useState } from "react"
import { Plus, Minus, HelpCircle } from "lucide-react"

const faqs = [
  {
    question: "How quickly can I set up Streb for my SaaS?",
    answer: "You can have Streb fully configured and running your first automated campaigns within 5 minutes. Simply connect your accounts, add your app details, and activate AutoPilot mode."
  },
  {
    question: "Do I need technical skills to use Streb?",
    answer: "Not at all! Streb is designed for non-technical founders and marketers. Our AI handles all the complex automation, content generation, and optimization automatically."
  },
  {
    question: "What platforms does Streb integrate with?",
    answer: "Streb integrates with Product Hunt, Twitter, Reddit, Hacker News, LinkedIn, YouTube, email providers, and many more. We're constantly adding new integrations based on user requests."
  },
  {
    question: "How does the AI content generation work?",
    answer: "Our AI analyzes your app, target audience, and platform requirements to generate personalized content for each channel. It creates posts, videos, emails, and more that match your brand voice and convert well."
  },
  {
    question: "Can I customize the automated campaigns?",
    answer: "Absolutely! While AutoPilot mode handles everything automatically, you can customize templates, approval workflows, posting schedules, and targeting parameters to match your specific needs."
  },
  {
    question: "What kind of results can I expect?",
    answer: "Our users typically see 3x more signups, 40%+ email open rates, and successful Product Hunt launches. Results vary by industry and execution, but most see significant growth within the first month."
  }
]

export function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  const toggleFAQ = (index: number) => {
    setOpenIndex(openIndex === index ? null : index)
  }

  return (
    <section className="py-24 px-6">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="font-sans text-5xl font-normal mb-6 text-balance">Frequently asked questions</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Everything you need to know about Streb and how it can transform your SaaS marketing.
          </p>
        </div>

        <div className="space-y-4">
          {faqs.map((faq, index) => (
            <div key={index} className="border border-border rounded-2xl overflow-hidden">
              <button
                onClick={() => toggleFAQ(index)}
                className="w-full px-6 py-5 text-left flex items-center justify-between hover:bg-card/50 transition-colors"
              >
                <span className="text-foreground font-medium pr-4">{faq.question}</span>
                {openIndex === index ? (
                  <Minus className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                ) : (
                  <Plus className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                )}
              </button>
              
              {openIndex === index && (
                <div className="px-6 pb-5">
                  <p className="text-muted-foreground leading-relaxed">{faq.answer}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}