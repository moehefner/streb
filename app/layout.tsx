import type React from "react"
import type { Metadata } from "next"
import { Inter, Geist_Mono, Playfair_Display } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import { ClerkProvider } from '@clerk/nextjs'
import "./globals.css"

const inter = Inter({ 
  subsets: ["latin"],
  variable: "--font-inter",
  weight: ["400", "500", "600", "700", "800"]
})
const _geistMono = Geist_Mono({ subsets: ["latin"] })
const _playfair = Playfair_Display({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Streb - Marketing Automation Platform",
  description: "AI-powered marketing automation for SaaS builders",
    generator: 'v0.app'
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <ClerkProvider
      signInForceRedirectUrl="/dashboard"
      signUpForceRedirectUrl="/dashboard"
    >
      <html lang="en">
        <body className={`${inter.variable} font-sans antialiased`}>
          {children}
          <Analytics />
        </body>
      </html>
    </ClerkProvider>
  )
}
