"use client"

import { useState } from "react"
import { Plus, Minus } from "lucide-react"

const faqs = [
  {
    question: "How is this different from Buffer or Hootsuite?",
    answer:
      "Buffer and Hootsuite require you to manually create content and schedule posts. Streb uses AI to generate posts, create videos, and find leads automatically. Set it once, and it runs forever.",
  },
  {
    question: "Do I need technical skills to use Streb?",
    answer:
      "No. The entire setup takes about 10 minutes. Connect your social accounts, tell us about your app, and Streb handles the rest.",
  },
  {
    question: "What platforms do you support?",
    answer:
      "We support Twitter/X, LinkedIn, Instagram, Facebook, TikTok, YouTube Shorts, and Threads. More platforms are being added regularly.",
  },
  {
    question: "Can I cancel anytime?",
    answer: "Yes. You can cancel anytime from your billing page with no lock-in.",
  },
  {
    question: "Do you offer refunds?",
    answer: "Yes. If you're not satisfied within the first 14 days, we offer a full refund.",
  },
]

export function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  const toggleFAQ = (index: number) => {
    setOpenIndex(openIndex === index ? null : index)
  }

  return (
    <section className="py-24 px-6 bg-gray-50 dark:bg-[#101010]">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="font-sans text-5xl font-normal mb-6 text-balance">Frequently asked questions</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Everything you need to know before launching with Streb.
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
