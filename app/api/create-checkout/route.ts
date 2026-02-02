import { NextResponse } from 'next/server';
import { stripe, STRIPE_PLANS, StripePlan } from '@/lib/stripe';
import { requireAuth, getCurrentUser } from '@/lib/auth-helpers';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/create-checkout
 * Create a Stripe checkout session for subscription
 * 
 * Body: {
 *   plan: 'starter' | 'pro' | 'agency'
 * }
 */
export async function POST(request: Request) {
  try {
    // Require authentication
    const clerkUserId = await requireAuth();
    
    // Get user from database
    const user = await getCurrentUser();
    
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { plan } = body as { plan: StripePlan };

    // Validate plan
    if (!plan || !STRIPE_PLANS[plan]) {
      return NextResponse.json(
        { error: 'Invalid plan selected' },
        { status: 400 }
      );
    }

    const selectedPlan = STRIPE_PLANS[plan];

    // Check if price ID is configured
    if (!selectedPlan.priceId) {
      return NextResponse.json(
        { error: 'Price ID not configured for this plan' },
        { status: 500 }
      );
    }

    // Create or get Stripe customer
    let customerId = user.stripeCustomerId;

    if (!customerId) {
      // Create new Stripe customer
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.fullName || undefined,
        metadata: {
          clerkUserId: user.clerkUserId,
          userId: user.id,
        },
      });

      customerId = customer.id;

      // Save customer ID to database
      await prisma.user.update({
        where: { id: user.id },
        data: { stripeCustomerId: customerId },
      });
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: selectedPlan.priceId,
          quantity: 1,
        },
      ],
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?success=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/pricing?canceled=true`,
      metadata: {
        userId: user.id,
        clerkUserId: user.clerkUserId,
        plan: plan,
      },
      subscription_data: {
        metadata: {
          userId: user.id,
          clerkUserId: user.clerkUserId,
          plan: plan,
        },
      },
    });

    return NextResponse.json({
      sessionId: session.id,
      url: session.url,
    });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}