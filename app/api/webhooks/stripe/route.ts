import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import Stripe from 'stripe';
import { stripe, STRIPE_PLANS, PLAN_LIMITS } from '@/lib/stripe';
import { prisma } from '@/lib/prisma';
import { updatePlanLimits } from '@/lib/db-helpers';
import { supabaseAdmin } from '@/lib/supabase';

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
type ManagedPlan = keyof typeof PLAN_LIMITS;

function resolvePlanFromPriceId(priceId?: string | null): ManagedPlan | null {
  if (!priceId) return null;
  if (priceId === STRIPE_PLANS.starter.priceId) return 'starter';
  if (priceId === STRIPE_PLANS.pro.priceId) return 'pro';
  if (priceId === STRIPE_PLANS.agency.priceId) return 'agency';
  return null;
}

function normalizePlan(plan?: string | null): ManagedPlan | null {
  if (!plan) return null;
  const value = plan.toLowerCase();
  if (value === 'free' || value === 'starter' || value === 'pro' || value === 'agency') {
    return value;
  }
  return null;
}

async function syncSupabasePlan(
  userId: string,
  plan: ManagedPlan,
  options?: {
    stripeCustomerId?: string | null;
    stripeSubscriptionId?: string | null;
    subscriptionStatus?: string | null;
  }
) {
  const limits = PLAN_LIMITS[plan];
  const updatePayload: Record<string, unknown> = {
    plan_type: plan,
    campaigns_limit: limits.campaigns,
    posts_limit: limits.posts,
    videos_limit: limits.videos,
    emails_limit: limits.emails,
    updated_at: new Date().toISOString(),
  };

  if (options?.stripeCustomerId !== undefined) {
    updatePayload.stripe_customer_id = options.stripeCustomerId;
  }
  if (options?.stripeSubscriptionId !== undefined) {
    updatePayload.stripe_subscription_id = options.stripeSubscriptionId;
  }
  if (options?.subscriptionStatus !== undefined) {
    updatePayload.subscription_status = options.subscriptionStatus;
  }

  const { error } = await supabaseAdmin
    .from('users')
    .update(updatePayload as never)
    .eq('id', userId);

  if (error) {
    console.error('Failed to sync Supabase plan limits from Stripe webhook:', error);
  }
}

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
  const userId = session.client_reference_id || session.metadata?.userId;
  const plan = normalizePlan(session.metadata?.plan);

  if (!userId || !plan) {
    console.error('Missing metadata in checkout session:', session.id);
    return;
  }

  console.log(`Checkout completed for user ${userId}, plan: ${plan}`);

  await syncSupabasePlan(userId, plan, {
    stripeCustomerId: typeof session.customer === 'string' ? session.customer : null,
    stripeSubscriptionId: typeof session.subscription === 'string' ? session.subscription : null,
  });
}

/**
 * Handle subscription creation
 */
async function handleSubscriptionCreated(subscription: Stripe.Subscription) {
  const userId = subscription.metadata?.userId;
  const metadataPlan = normalizePlan(subscription.metadata?.plan);
  const inferredPlan = resolvePlanFromPriceId(subscription.items.data[0]?.price?.id);
  const plan = metadataPlan || inferredPlan;

  if (!userId || !plan) {
    console.error('Missing metadata in subscription:', subscription.id);
    return;
  }

  const planLimits = PLAN_LIMITS[plan];

  if (!planLimits) {
    console.error('Invalid plan in subscription:', plan);
    return;
  }

  try {
    // Update user's subscription in database
    const periodEnd = (subscription as unknown as Record<string, unknown>).current_period_end as number | undefined;
    
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

    await syncSupabasePlan(userId, plan, {
      stripeCustomerId: typeof subscription.customer === 'string' ? subscription.customer : null,
      stripeSubscriptionId: subscription.id,
      subscriptionStatus: subscription.status,
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
  const plan = normalizePlan(subscription.metadata?.plan);

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
      planType = resolvePlanFromPriceId(priceId);
    }

    const planLimits = planType ? PLAN_LIMITS[planType] : null;

    // Update user subscription status
    const periodEnd = (subscription as unknown as Record<string, unknown>).current_period_end as number | undefined;
    
    const updateData: Record<string, unknown> = {
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

    if (planType) {
      await syncSupabasePlan(user.id, planType, {
        stripeCustomerId: typeof subscription.customer === 'string' ? subscription.customer : null,
        stripeSubscriptionId: subscription.id,
        subscriptionStatus: subscription.status,
      });
    }

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
    await syncSupabasePlan(user.id, 'free', {
      stripeCustomerId: typeof subscription.customer === 'string' ? subscription.customer : null,
      stripeSubscriptionId: null,
      subscriptionStatus: 'canceled',
    });

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
