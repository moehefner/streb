import Stripe from 'stripe';

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY is not set in environment variables');
}

// Initialize Stripe with the latest API version
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2026-01-28.clover',
  typescript: true,
});

export const STRIPE_PRICES = {
  starter_monthly: process.env.STRIPE_STARTER_MONTHLY_PRICE_ID || process.env.STRIPE_STARTER_PRICE_ID || '',
  starter_annual: process.env.STRIPE_STARTER_ANNUAL_PRICE_ID || '',
  pro_monthly: process.env.STRIPE_PRO_MONTHLY_PRICE_ID || process.env.STRIPE_PRO_PRICE_ID || '',
  pro_annual: process.env.STRIPE_PRO_ANNUAL_PRICE_ID || '',
  agency_monthly: process.env.STRIPE_AGENCY_MONTHLY_PRICE_ID || process.env.STRIPE_AGENCY_PRICE_ID || '',
  agency_annual: process.env.STRIPE_AGENCY_ANNUAL_PRICE_ID || '',
} as const;

export type StripeBillingInterval = 'monthly' | 'annual';

export const PLAN_LIMITS = {
  free: { campaigns: 1, posts: 5, videos: 3, emails: 25 },
  starter: { campaigns: 2, posts: 100, videos: 25, emails: 750 },
  pro: { campaigns: 7, posts: 250, videos: 75, emails: 2000 },
  agency: { campaigns: 15, posts: 500, videos: 150, emails: 5000 },
} as const;

// Stripe pricing configuration
export const STRIPE_PLANS = {
  starter: {
    name: 'Starter',
    price: 4900, // $49.00 in cents
    priceId: STRIPE_PRICES.starter_monthly,
    features: [
      '100 posts per month',
      '25 videos per month',
      '750 emails per month',
      'Basic analytics',
      'Email support',
    ],
    limits: {
      campaigns: PLAN_LIMITS.starter.campaigns,
      posts: 100,
      videos: 25,
      emails: 750,
    },
  },
  pro: {
    name: 'Pro',
    price: 9900, // $99.00 in cents
    priceId: STRIPE_PRICES.pro_monthly,
    features: [
      '250 posts per month',
      '75 videos per month',
      '2,000 emails per month',
      'Advanced analytics',
      'Priority support',
      'Custom branding',
    ],
    limits: {
      campaigns: PLAN_LIMITS.pro.campaigns,
      posts: 250,
      videos: 75,
      emails: 2000,
    },
  },
  agency: {
    name: 'Agency',
    price: 24900, // $249.00 in cents
    priceId: STRIPE_PRICES.agency_monthly,
    features: [
      '500 posts per month',
      '150 videos per month',
      '5,000 emails per month',
      'Team collaboration',
      'Client management',
      'White-label options',
      'Dedicated support',
    ],
    limits: {
      campaigns: PLAN_LIMITS.agency.campaigns,
      posts: 500,
      videos: 150,
      emails: 5000,
    },
  },
} as const;

export type StripePlan = keyof typeof STRIPE_PLANS;

// Helper function to format price for display
export function formatPrice(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100);
}
