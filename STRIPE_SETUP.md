# Stripe Payment Integration - Setup Complete! 🎉

## ✅ What Was Installed & Configured

### Packages Added
- ✅ `stripe` (latest) - Stripe Node.js SDK
- ✅ `@stripe/stripe-js` (latest) - Stripe.js for client-side

### Payment System

#### 1. Stripe Configuration
- ✅ **Stripe client** configured in `lib/stripe.ts`
- ✅ **Plan definitions** with pricing and limits
- ✅ **Helper functions** for subscription management

#### 2. Subscription Plans
- ✅ **Starter**: $49/month - 100 posts, 25 videos, 750 emails
- ✅ **Pro**: $99/month - 250 posts, 75 videos, 2,000 emails
- ✅ **Agency**: $249/month - 500 posts, 150 videos, 5,000 emails

#### 3. API Routes
- ✅ **Checkout**: `/api/create-checkout` - Create payment sessions
- ✅ **Webhook**: `/api/webhooks/stripe` - Handle subscription events
- ✅ **Manage**: `/api/manage-subscription` - Cancel/reactivate
- ✅ **Portal**: `/api/customer-portal` - Customer portal access

#### 4. Pricing Page
- ✅ **Beautiful pricing UI** at `/pricing`
- ✅ **Plan comparison** with features
- ✅ **One-click checkout** integration

### Files Created/Modified

#### Payment Configuration
- ✅ `lib/stripe.ts` - Stripe client and plan definitions
- ✅ `lib/subscription-helpers.ts` - Subscription management utilities

#### API Routes
- ✅ `app/api/create-checkout/route.ts` - Checkout session creation
- ✅ `app/api/webhooks/stripe/route.ts` - Webhook event handler
- ✅ `app/api/manage-subscription/route.ts` - Subscription management
- ✅ `app/api/customer-portal/route.ts` - Portal URL generation

#### UI Components
- ✅ `app/pricing/page.tsx` - Pricing page with plans
- ✅ `app/dashboard/page.tsx` - Updated with subscription info

#### Configuration
- ✅ `.env.example` - Stripe environment variables

## 💳 Payment Flow

### 1. User Selects Plan
```
User visits /pricing → Clicks "Subscribe" → 
Redirected to Stripe Checkout → Enters payment info
```

### 2. Checkout Completion
```
Payment successful → Stripe fires webhook → 
User record updated in Supabase → Redirected to dashboard
```

### 3. Subscription Management
```
User visits dashboard → Clicks "Manage Subscription" → 
Opens Stripe Customer Portal → Can cancel/update payment
```

### 4. Subscription Cancellation
```
User cancels in portal → Webhook fires → 
Subscription marked for cancellation → Downgraded at period end
```

## 🔄 Webhook Events Handled

### checkout.session.completed
- Triggered when checkout is successful
- Logs the completion (subscription.created handles the update)

### customer.subscription.created
- Updates user's plan in database
- Sets subscription limits based on plan
- Saves subscription ID and status

### customer.subscription.updated
- Updates subscription status
- Handles plan changes
- Updates billing period

### customer.subscription.deleted
- Downgrades user to free plan
- Resets limits to free tier
- Clears subscription data

## 🚀 Setup Instructions

### 1. Create Stripe Account

1. Go to [stripe.com](https://stripe.com) and sign up
2. Complete account verification
3. Switch to Test mode for development

### 2. Create Products & Prices

In Stripe Dashboard → Products:

#### Starter Plan
1. Create product: "Streb Starter"
2. Add recurring price: $49/month
3. Copy Price ID → `STRIPE_STARTER_PRICE_ID`

#### Pro Plan
1. Create product: "Streb Pro"
2. Add recurring price: $99/month
3. Copy Price ID → `STRIPE_PRO_PRICE_ID`

#### Agency Plan
1. Create product: "Streb Agency"
2. Add recurring price: $249/month
3. Copy Price ID → `STRIPE_AGENCY_PRICE_ID`

### 3. Configure Environment Variables

Add to `.env.local`:

```env
# Stripe API Keys
STRIPE_SECRET_KEY=sk_test_your_secret_key
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_your_publishable_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret

# Stripe Price IDs
STRIPE_STARTER_PRICE_ID=price_1234567890
STRIPE_PRO_PRICE_ID=price_0987654321
STRIPE_AGENCY_PRICE_ID=price_1122334455
```

**Where to find these:**
- **API Keys**: Dashboard → Developers → API keys
- **Price IDs**: Dashboard → Products → Click product → Copy price ID

### 4. Set Up Webhook

1. Go to Dashboard → Developers → Webhooks
2. Click "Add endpoint"
3. Set URL: `https://yourdomain.com/api/webhooks/stripe`
   - For local testing: Use [Stripe CLI](https://stripe.com/docs/stripe-cli)
4. Select events:
   - ✅ `checkout.session.completed`
   - ✅ `customer.subscription.created`
   - ✅ `customer.subscription.updated`
   - ✅ `customer.subscription.deleted`
5. Copy signing secret → `STRIPE_WEBHOOK_SECRET`

### 5. Test Locally with Stripe CLI

```bash
# Install Stripe CLI
# https://stripe.com/docs/stripe-cli

# Login
stripe login

# Forward webhooks to local server
stripe listen --forward-to localhost:3000/api/webhooks/stripe

# Copy the webhook signing secret to .env.local
```

### 6. Test the Integration

```bash
npm run dev
```

Visit:
- ✅ `/pricing` - View plans
- ✅ Click "Subscribe" - Test checkout
- ✅ Use test card: `4242 4242 4242 4242`
- ✅ Check dashboard for updated plan

## 💻 Usage Examples

### Create Checkout Session (Client-Side)

```typescript
const response = await fetch('/api/create-checkout', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ plan: 'starter' }),
});

const { url } = await response.json();
window.location.href = url; // Redirect to Stripe
```

### Check Subscription Status (Server-Side)

```typescript
import { hasActiveSubscription } from '@/lib/subscription-helpers';

const isSubscribed = await hasActiveSubscription(userId);

if (!isSubscribed) {
  // Show upgrade prompt
}
```

### Get Customer Portal URL

```typescript
const response = await fetch('/api/customer-portal', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ 
    returnUrl: window.location.href 
  }),
});

const { url } = await response.json();
window.location.href = url;
```

### Cancel Subscription

```typescript
const response = await fetch('/api/manage-subscription', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ action: 'cancel' }),
});

const result = await response.json();
// Subscription will cancel at period end
```

## 🛠️ Helper Functions Available

### `getUserSubscription(userId)`
Get user's active Stripe subscription:

```typescript
const subscription = await getUserSubscription(userId);
// Returns: Stripe.Subscription or null
```

### `cancelSubscription(userId)`
Cancel subscription at period end:

```typescript
await cancelSubscription(userId);
// Subscription continues until period end
```

### `reactivateSubscription(userId)`
Reactivate a canceled subscription:

```typescript
await reactivateSubscription(userId);
// Removes cancel_at_period_end flag
```

### `getCustomerPortalUrl(userId, returnUrl)`
Get Stripe Customer Portal URL:

```typescript
const portalUrl = await getCustomerPortalUrl(userId, '/dashboard');
// Returns: URL to Stripe portal
```

### `hasActiveSubscription(userId)`
Check if user has active subscription:

```typescript
const isActive = await hasActiveSubscription(userId);
// Returns: boolean
```

## 📊 Database Schema

User subscription fields in `users` table:

```typescript
{
  planType: 'free' | 'starter' | 'pro' | 'agency',
  stripeCustomerId: string | null,
  stripeSubscriptionId: string | null,
  subscriptionStatus: string | null,
  subscriptionCurrentPeriodEnd: Date | null,
  
  // Usage limits (updated based on plan)
  postsLimit: number,
  videosLimit: number,
  emailsLimit: number,
}
```

## 🔒 Security Features

### Webhook Verification
- ✅ Signature verification using Stripe webhook secret
- ✅ Only processes verified events
- ✅ Graceful error handling

### Payment Security
- ✅ No card data touches your server
- ✅ PCI compliance handled by Stripe
- ✅ Secure checkout sessions

### API Protection
- ✅ All routes require authentication
- ✅ User can only manage own subscription
- ✅ Webhook endpoint is public (verified by signature)

## 🎯 Features Ready to Use

### Subscription Management
- ✅ Create subscriptions with checkout
- ✅ Automatic plan limit updates
- ✅ Cancel at period end
- ✅ Reactivate canceled subscriptions
- ✅ Customer portal for self-service

### Usage Tracking
- ✅ Limits enforced based on plan
- ✅ Usage counters in database
- ✅ Automatic reset on plan change
- ✅ Display usage in dashboard

### Billing
- ✅ Automatic recurring billing
- ✅ Failed payment handling
- ✅ Invoice generation
- ✅ Payment method updates

## 🐛 Troubleshooting

### "Price ID not configured"
- Check `STRIPE_*_PRICE_ID` in `.env.local`
- Verify price IDs match Stripe Dashboard

### Webhook signature verification failed
- Check `STRIPE_WEBHOOK_SECRET` matches Stripe
- For local testing, use Stripe CLI

### Subscription not updating
- Check webhook is configured and firing
- Verify webhook URL is accessible
- Check server logs for errors

### Test card declined
- Use test card: `4242 4242 4242 4242`
- Any future expiry date
- Any 3-digit CVC

## 📚 Stripe Test Cards

```
Success: 4242 4242 4242 4242
Decline: 4000 0000 0000 0002
Requires authentication: 4000 0025 0000 3155
```

[Full list of test cards](https://stripe.com/docs/testing)

## 🎨 Customization

### Update Plan Pricing

Edit `lib/stripe.ts`:

```typescript
export const STRIPE_PLANS = {
  starter: {
    price: 4900, // $49 in cents
    // ... rest of config
  },
};
```

### Add New Plan

1. Create product in Stripe Dashboard
2. Add to `STRIPE_PLANS` in `lib/stripe.ts`
3. Add to pricing page UI
4. Add price ID to environment variables

### Customize Checkout

Edit `app/api/create-checkout/route.ts`:

```typescript
const session = await stripe.checkout.sessions.create({
  // Add custom fields, trial periods, etc.
  subscription_data: {
    trial_period_days: 14, // 14-day trial
  },
});
```

## 📖 Additional Resources

- [Stripe Documentation](https://stripe.com/docs)
- [Stripe Checkout](https://stripe.com/docs/payments/checkout)
- [Stripe Webhooks](https://stripe.com/docs/webhooks)
- [Stripe Testing](https://stripe.com/docs/testing)
- [Stripe Customer Portal](https://stripe.com/docs/billing/subscriptions/customer-portal)

## 🎯 What's Next?

Your payment system is fully set up! You can now:

1. ✅ **Accept payments** - Users can subscribe to any plan
2. ✅ **Manage subscriptions** - Cancel, upgrade, downgrade
3. ✅ **Track usage** - Limits enforced automatically
4. ✅ **Handle billing** - Automatic recurring payments
5. ✅ **Provide self-service** - Customer portal for users
6. ✅ **Test thoroughly** - Use test mode before going live

---

**Status**: ✅ Stripe payment integration complete!  
**Test URL**: `/pricing` - View plans and test checkout  
**Dashboard**: Updated with subscription info  
**Webhook**: Ready to receive events

Your Streb app now has production-ready payment processing! 💳