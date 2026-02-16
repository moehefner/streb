"use client"

import { useMemo, useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CreditCard, ExternalLink, Loader2 } from "lucide-react"
import { STRIPE_PLANS, StripeBillingInterval, formatPrice } from "@/lib/stripe"

type UserLimitsPayload = {
  success?: boolean
  plan_type?: string
  posts_limit?: number
  videos_limit?: number
  emails_limit?: number
}

type PaidPlan = "starter" | "pro" | "agency"

function normalizePlan(plan: string | undefined): "free" | PaidPlan {
  const normalized = (plan || "free").toLowerCase()
  if (normalized === "starter" || normalized === "pro" || normalized === "agency") {
    return normalized
  }
  return "free"
}

const PLAN_ORDER: PaidPlan[] = ["starter", "pro", "agency"]

export default function BillingPage() {
  const [plan, setPlan] = useState<"free" | PaidPlan>("free")
  const [billingInterval, setBillingInterval] = useState<StripeBillingInterval>("monthly")
  const [isLoading, setIsLoading] = useState(true)
  const [checkoutLoading, setCheckoutLoading] = useState<PaidPlan | null>(null)
  const [portalLoading, setPortalLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void fetchLimits()
  }, [])

  async function fetchLimits() {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch("/api/user/limits", { cache: "no-store" })
      const data = (await response.json().catch(() => null)) as UserLimitsPayload | null

      if (!response.ok || !data?.success) {
        throw new Error("Failed to load billing details")
      }

      setPlan(normalizePlan(data.plan_type))
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Failed to load billing details")
    } finally {
      setIsLoading(false)
    }
  }

  async function handleUpgrade(nextPlan: PaidPlan) {
    setError(null)
    setCheckoutLoading(nextPlan)
    try {
      const response = await fetch("/api/stripe/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan: nextPlan,
          interval: billingInterval
        })
      })

      const data = await response.json().catch(() => ({} as { error?: string; url?: string }))

      if (!response.ok || data.error) {
        throw new Error(data.error || "Failed to start checkout")
      }

      if (data.url) {
        window.location.href = data.url
      } else {
        throw new Error("Stripe checkout URL missing from response")
      }
    } catch (checkoutError) {
      setError(checkoutError instanceof Error ? checkoutError.message : "Failed to start checkout")
    } finally {
      setCheckoutLoading(null)
    }
  }

  async function openBillingPortal() {
    setError(null)
    setPortalLoading(true)
    try {
      const response = await fetch("/api/customer-portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ returnUrl: `${window.location.origin}/dashboard/billing` })
      })

      const data = await response.json().catch(() => ({} as { error?: string; url?: string }))
      if (!response.ok || data.error || !data.url) {
        throw new Error(data.error || "Failed to open billing portal")
      }

      window.location.href = data.url
    } catch (portalError) {
      setError(portalError instanceof Error ? portalError.message : "Failed to open billing portal")
    } finally {
      setPortalLoading(false)
    }
  }

  const upgradePlans = useMemo(() => {
    if (plan === "free") return PLAN_ORDER
    const currentIndex = PLAN_ORDER.indexOf(plan)
    return currentIndex >= 0 ? PLAN_ORDER.slice(currentIndex + 1) : PLAN_ORDER
  }, [plan])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Billing</h1>
        <p className="mt-1 text-gray-400">Manage plan upgrades and Stripe subscription settings.</p>
      </div>

      {error && (
        <Card className="border-red-900 bg-red-950/20">
          <CardContent className="p-4 text-red-300">{error}</CardContent>
        </Card>
      )}

      <Card className="border-[#404040] bg-[#2A2A2A]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <CreditCard className="h-5 w-5" />
            Current Plan
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <div className="flex items-center gap-2 text-gray-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading billing details...
            </div>
          ) : (
            <>
              <p className="text-white">
                Active plan:{" "}
                <span className="font-semibold capitalize">{plan}</span>
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setBillingInterval("monthly")}
                  className={`rounded-md px-3 py-2 text-sm ${
                    billingInterval === "monthly"
                      ? "bg-white text-black"
                      : "border border-[#404040] text-white hover:bg-[#1A1A1A]"
                  }`}
                >
                  Monthly
                </button>
                <button
                  type="button"
                  onClick={() => setBillingInterval("annual")}
                  className={`rounded-md px-3 py-2 text-sm ${
                    billingInterval === "annual"
                      ? "bg-white text-black"
                      : "border border-[#404040] text-white hover:bg-[#1A1A1A]"
                  }`}
                >
                  Annual
                </button>
              </div>

              {plan !== "free" && (
                <Button
                  onClick={openBillingPortal}
                  disabled={portalLoading}
                  className="bg-[#FF3D71] text-white hover:bg-[#FF3D71]/90"
                >
                  {portalLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Opening...
                    </>
                  ) : (
                    <>
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Manage in Stripe
                    </>
                  )}
                </Button>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {upgradePlans.length > 0 && (
        <div className="grid gap-4 md:grid-cols-3">
          {upgradePlans.map((nextPlan) => (
            <Card key={nextPlan} className="border-[#404040] bg-[#2A2A2A]">
              <CardHeader>
                <CardTitle className="text-white">{STRIPE_PLANS[nextPlan].name}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-3xl font-bold text-white">
                  {formatPrice(STRIPE_PLANS[nextPlan].price)}
                  <span className="ml-1 text-base font-normal text-gray-400">
                    {billingInterval === "annual" ? "/year" : "/month"}
                  </span>
                </p>
                <ul className="space-y-1 text-sm text-gray-300">
                  {STRIPE_PLANS[nextPlan].features.slice(0, 4).map((feature) => (
                    <li key={feature}>- {feature}</li>
                  ))}
                </ul>
                <Button
                  onClick={() => handleUpgrade(nextPlan)}
                  disabled={checkoutLoading === nextPlan}
                  className="w-full bg-[#FF3D71] text-white hover:bg-[#FF3D71]/90"
                >
                  {checkoutLoading === nextPlan ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Redirecting...
                    </>
                  ) : (
                    `Upgrade to ${STRIPE_PLANS[nextPlan].name}`
                  )}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}


