import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import Stripe from 'stripe';
import { stripe, STRIPE_PLANS } from '@/lib/stripe';
import { prisma } from '@/lib/prisma';
import { updatePlanLimits } from '@/lib/db-helpers';

/**
 * Stripe Webhook Handler
 * 
 * Handles subscription lifecycle events from Stripe.
 * 
 * Setup in Stripe Dashboard:
 * 1. Go to Developers → Webhooks
 * 2. Add endpoint: https://yourdomain.com/api/webhooks/stripe
 * 3. Select events: checkout.session.completed, customer.subscription.*
 * 4. Copy webhook signing secret to STRIPE_WEBHOOK_SECRET
 */

// Disable body parsing for webhook signature verification
export const runtime = 'nodejs';

export async function POST(request: Request) {
  const body = await request.text();
  const headersList = await headers();
  const signature = headersList.get('stripe-signature');

  if (!signature) {
    return NextResponse.json(
      { error: 'No signature provided' },
      { status: 400 }
    );
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error('STRIPE_WEBHOOK_SECRET is not set');
    return NextResponse.json(
      { error: 'Webhook secret not configured' },
      { status: 500 }
    );
  }

  let event: Stripe.Event;

  try {
    // Verify webhook signature
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return NextResponse.json(
      { error: 'Invalid signature' },
      { status: 400 }
    );
  }

  console.log(`Received Stripe webhook: ${event.type}`);

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;

      case 'customer.subscription.created':
        await handleSubscriptionCreated(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Error processing webhook:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

/**
 * Handle successful checkout session
 */
async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.userId;
  const plan = session.metadata?.plan as keyof typeof STRIPE_PLANS;

  if (!userId || !plan) {
    console.error('Missing metadata in checkout session:', session.id);
    return;
  }

  console.log(`Checkout completed for user ${userId}, plan: ${plan}`);

  // Update will happen when subscription.created event fires
  // This is just for logging/tracking
}

/**
 * Handle subscription creation
 */
async function handleSubscriptionCreated(subscription: Stripe.Subscription) {
  const userId = subscription.metadata?.userId;
  const plan = subscription.metadata?.plan as keyof typeof STRIPE_PLANS;

  if (!userId || !plan) {
    console.error('Missing metadata in subscription:', subscription.id);
    return;
  }

  const planLimits = STRIPE_PLANS[plan]?.limits;

  if (!planLimits) {
    console.error('Invalid plan in subscription:', plan);
    return;
  }

  try {
    // Update user's subscription in database
    const periodEnd = (subscription as any).current_period_end;
    
    await prisma.user.update({
      where: { id: userId },
      data: {
        planType: plan,
        stripeSubscriptionId: subscription.id,
        subscriptionStatus: subscription.status,
        subscriptionCurrentPeriodEnd: periodEnd 
          ? new Date(periodEnd * 1000)
          : null,
        postsLimit: planLimits.posts,
        videosLimit: planLimits.videos,
        emailsLimit: planLimits.emails,
      },
    });

    console.log(`Subscription created for user ${userId}: ${plan}`);
  } catch (error) {
    console.error('Error updating user subscription:', error);
    throw error;
  }
}

/**
 * Handle subscription updates
 */
async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const userId = subscription.metadata?.userId;
  const plan = subscription.metadata?.plan as keyof typeof STRIPE_PLANS;

  if (!userId) {
    console.error('Missing userId in subscription metadata:', subscription.id);
    return;
  }

  try {
    // Find user by subscription ID if userId not in metadata
    let user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      user = await prisma.user.findFirst({
        where: { stripeSubscriptionId: subscription.id },
      });
    }

    if (!user) {
      console.error('User not found for subscription:', subscription.id);
      return;
    }

    // Determine plan from subscription items if not in metadata
    let planType = plan;
    if (!planType && subscription.items.data.length > 0) {
      const priceId = subscription.items.data[0].price.id;
      // Find plan by price ID
      for (const [key, value] of Object.entries(STRIPE_PLANS)) {
        if (value.priceId === priceId) {
          planType = key as keyof typeof STRIPE_PLANS;
          break;
        }
      }
    }

    const planLimits = planType ? STRIPE_PLANS[planType]?.limits : null;

    // Update user subscription status
    const periodEnd = (subscription as any).current_period_end;
    
    const updateData: any = {
      subscriptionStatus: subscription.status,
      subscriptionCurrentPeriodEnd: periodEnd
        ? new Date(periodEnd * 1000)
        : null,
    };

    if (planType) {
      updateData.planType = planType;
    }

    if (planLimits) {
      updateData.postsLimit = planLimits.posts;
      updateData.videosLimit = planLimits.videos;
      updateData.emailsLimit = planLimits.emails;
    }

    await prisma.user.update({
      where: { id: user.id },
      data: updateData,
    });

    console.log(`Subscription updated for user ${user.id}: ${subscription.status}`);
  } catch (error) {
    console.error('Error updating subscription:', error);
    throw error;
  }
}

/**
 * Handle subscription deletion/cancellation
 */
async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const userId = subscription.metadata?.userId;

  try {
    // Find user by subscription ID or metadata
    let user = userId
      ? await prisma.user.findUnique({ where: { id: userId } })
      : null;

    if (!user) {
      user = await prisma.user.findFirst({
        where: { stripeSubscriptionId: subscription.id },
      });
    }

    if (!user) {
      console.error('User not found for canceled subscription:', subscription.id);
      return;
    }

    // Downgrade to free plan
    await updatePlanLimits(user.id, 'free');

    // Clear subscription data
    await prisma.user.update({
      where: { id: user.id },
      data: {
        stripeSubscriptionId: null,
        subscriptionStatus: 'canceled',
        subscriptionCurrentPeriodEnd: null,
      },
    });

    console.log(`Subscription canceled for user ${user.id}, downgraded to free`);
  } catch (error) {
    console.error('Error handling subscription deletion:', error);
    throw error;
  }
}