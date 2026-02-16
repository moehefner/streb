import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth, getCurrentUser } from '@/lib/auth-helpers'
import {
  stripe,
  STRIPE_PLANS,
  STRIPE_PRICES,
  StripeBillingInterval,
  StripePlan
} from '@/lib/stripe'

type CreateCheckoutRequest = {
  plan?: StripePlan
  interval?: StripeBillingInterval
  priceId?: string
}

const PLAN_PRICE_IDS: Record<StripePlan, Record<StripeBillingInterval, string>> = {
  starter: {
    monthly: STRIPE_PRICES.starter_monthly,
    annual: STRIPE_PRICES.starter_annual
  },
  pro: {
    monthly: STRIPE_PRICES.pro_monthly,
    annual: STRIPE_PRICES.pro_annual
  },
  agency: {
    monthly: STRIPE_PRICES.agency_monthly,
    annual: STRIPE_PRICES.agency_annual
  }
}

function resolvePriceId(
  plan: StripePlan,
  interval: StripeBillingInterval,
  explicitPriceId?: string
): string {
  const planPrices = PLAN_PRICE_IDS[plan]
  const defaultPriceId = planPrices[interval] || PLAN_PRICE_IDS[plan].monthly

  if (!explicitPriceId) {
    return defaultPriceId
  }

  const allowed = new Set([planPrices.monthly, planPrices.annual].filter(Boolean))
  if (!allowed.has(explicitPriceId)) {
    throw new Error('Provided priceId does not match the selected plan')
  }

  return explicitPriceId
}

export async function POST(request: Request) {
  try {
    await requireAuth()
    const user = await getCurrentUser()

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const body = (await request.json()) as CreateCheckoutRequest
    const plan = body.plan
    const interval: StripeBillingInterval = body.interval === 'annual' ? 'annual' : 'monthly'

    if (!plan || !STRIPE_PLANS[plan]) {
      return NextResponse.json({ error: 'Invalid plan selected' }, { status: 400 })
    }

    let priceId: string
    try {
      priceId = resolvePriceId(plan, interval, body.priceId)
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Invalid price selection' },
        { status: 400 }
      )
    }

    if (!priceId) {
      return NextResponse.json(
        { error: `Price ID not configured for ${plan} (${interval})` },
        { status: 500 }
      )
    }

    let customerId = user.stripeCustomerId
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.fullName || undefined,
        metadata: {
          clerkUserId: user.clerkUserId,
          userId: user.id
        }
      })

      customerId = customer.id

      await prisma.user.update({
        where: { id: user.id },
        data: { stripeCustomerId: customerId }
      })
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL
    if (!appUrl) {
      return NextResponse.json({ error: 'NEXT_PUBLIC_APP_URL is not configured' }, { status: 500 })
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: user.email,
      client_reference_id: user.id,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1
        }
      ],
      success_url: `${appUrl}/dashboard?upgrade=success`,
      cancel_url: `${appUrl}/pricing?upgrade=cancelled`,
      metadata: {
        userId: user.id,
        clerkUserId: user.clerkUserId,
        plan,
        interval
      },
      subscription_data: {
        metadata: {
          userId: user.id,
          clerkUserId: user.clerkUserId,
          plan,
          interval
        }
      }
    })

    return NextResponse.json({
      sessionId: session.id,
      url: session.url
    })
  } catch (error) {
    console.error('Error creating Stripe checkout session:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create checkout session' },
      { status: 500 }
    )
  }
}
