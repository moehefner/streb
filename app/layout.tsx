import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import { ClerkProvider } from '@clerk/nextjs'
import { ErrorBoundary } from '@/components/error-boundary'
import "./globals.css"

const inter = Inter({ 
  subsets: ["latin"],
  variable: "--font-inter",
  weight: ["400", "500", "600", "700", "800"]
})

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
          <ErrorBoundary>{children}</ErrorBoundary>
          <Analytics />
        </body>
      </html>
    </ClerkProvider>
  )
}
