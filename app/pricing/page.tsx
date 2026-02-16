'use client';

import { useState } from 'react';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { STRIPE_PLANS, STRIPE_PRICES, StripeBillingInterval, formatPrice } from '@/lib/stripe';

type PaidPlan = 'starter' | 'pro' | 'agency'

function getPriceId(plan: PaidPlan, interval: StripeBillingInterval): string {
  if (plan === 'starter') {
    return interval === 'annual' ? STRIPE_PRICES.starter_annual : STRIPE_PRICES.starter_monthly
  }
  if (plan === 'pro') {
    return interval === 'annual' ? STRIPE_PRICES.pro_annual : STRIPE_PRICES.pro_monthly
  }
  return interval === 'annual' ? STRIPE_PRICES.agency_annual : STRIPE_PRICES.agency_monthly
}

export default function PricingPage() {
  const router = useRouter();
  const { isSignedIn, isLoaded } = useUser();
  const [requestedPlan, setRequestedPlan] = useState<string | null>(null)
  const [loading, setLoading] = useState<string | null>(null);
  const [billingInterval, setBillingInterval] = useState<StripeBillingInterval>('monthly')

  useEffect(() => {
    const plan = new URLSearchParams(window.location.search).get('plan')
    setRequestedPlan(plan ? plan.toLowerCase() : null)
  }, [])

  const handleSubscribe = async (plan: PaidPlan) => {
    if (!isSignedIn) {
      router.push('/sign-in?redirect_url=/pricing');
      return;
    }

    setLoading(plan);

    try {
      const response = await fetch('/api/stripe/create-checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          plan,
          interval: billingInterval,
          priceId: getPriceId(plan, billingInterval),
        }),
      });

      const data = await response.json();

      if (data.error) {
        alert(data.error);
        setLoading(null);
        return;
      }

      // Redirect to Stripe Checkout
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error('Error creating checkout:', error);
      alert('Failed to start checkout. Please try again.');
      setLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <nav className="flex items-center justify-between p-6">
        <a href="/" className="text-2xl font-bold text-gray-900">
          Streb
        </a>
        <a
          href="/dashboard"
          className="text-gray-600 hover:text-gray-900"
        >
          Dashboard
        </a>
      </nav>

      {/* Pricing Section */}
      <div className="container mx-auto px-6 py-20">
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold text-gray-900 mb-4">
            Simple, Transparent Pricing
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Choose the plan that fits your needs. All plans include a 14-day free trial.
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="flex justify-center mb-8">
          <div className="inline-flex rounded-lg border border-gray-300 p-1 bg-white">
            <button
              type="button"
              onClick={() => setBillingInterval('monthly')}
              className={`px-4 py-2 text-sm font-medium rounded-md transition ${
                billingInterval === 'monthly'
                  ? 'bg-gray-900 text-white'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => setBillingInterval('annual')}
              className={`px-4 py-2 text-sm font-medium rounded-md transition ${
                billingInterval === 'annual'
                  ? 'bg-gray-900 text-white'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              Annual
            </button>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {/* Free Plan */}
          <div className="bg-white rounded-2xl shadow-lg p-8 border-2 border-gray-200">
            <div className="mb-8">
              <h3 className="text-2xl font-bold text-gray-900 mb-2">Free</h3>
              <div className="flex items-baseline mb-4">
                <span className="text-5xl font-bold">$0</span>
                <span className="text-gray-600 ml-2">/month</span>
              </div>
              <p className="text-gray-600">Perfect for trying out Streb</p>
            </div>

            <ul className="space-y-4 mb-8">
              <li className="flex items-start">
                <svg className="w-5 h-5 text-green-500 mr-3 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                <span className="text-gray-700">5 posts per month</span>
              </li>
              <li className="flex items-start">
                <svg className="w-5 h-5 text-green-500 mr-3 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                <span className="text-gray-700">3 videos per month</span>
              </li>
              <li className="flex items-start">
                <svg className="w-5 h-5 text-green-500 mr-3 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                <span className="text-gray-700">25 emails per month</span>
              </li>
              <li className="flex items-start">
                <svg className="w-5 h-5 text-green-500 mr-3 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                <span className="text-gray-700">Basic analytics</span>
              </li>
            </ul>

            <a
              href="/sign-up"
              className="block w-full text-center bg-gray-100 hover:bg-gray-200 text-gray-900 font-semibold py-3 px-6 rounded-lg transition"
            >
              Get Started
            </a>
          </div>

          {/* Starter Plan */}
          <div className={`bg-white rounded-2xl shadow-lg p-8 border-2 relative ${requestedPlan === 'starter' ? 'border-blue-600' : 'border-blue-500'}`}>
            <div className="absolute top-0 right-0 bg-blue-500 text-white px-4 py-1 rounded-bl-lg rounded-tr-lg text-sm font-semibold">
              Popular
            </div>
            
            <div className="mb-8">
              <h3 className="text-2xl font-bold text-gray-900 mb-2">Starter</h3>
              <div className="flex items-baseline mb-4">
                <span className="text-5xl font-bold">{formatPrice(STRIPE_PLANS.starter.price)}</span>
                <span className="text-gray-600 ml-2">{billingInterval === 'annual' ? '/year' : '/month'}</span>
              </div>
              <p className="text-gray-600">For growing businesses</p>
            </div>

            <ul className="space-y-4 mb-8">
              {STRIPE_PLANS.starter.features.map((feature, index) => (
                <li key={index} className="flex items-start">
                  <svg className="w-5 h-5 text-green-500 mr-3 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span className="text-gray-700">{feature}</span>
                </li>
              ))}
            </ul>

            <button
              onClick={() => handleSubscribe('starter')}
              disabled={loading === 'starter' || !isLoaded}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading === 'starter' ? 'Loading...' : 'Start Free Trial'}
            </button>
          </div>

          {/* Pro Plan */}
          <div className={`bg-white rounded-2xl shadow-lg p-8 border-2 ${requestedPlan === 'pro' ? 'border-gray-900' : 'border-gray-200'}`}>
            <div className="mb-8">
              <h3 className="text-2xl font-bold text-gray-900 mb-2">Pro</h3>
              <div className="flex items-baseline mb-4">
                <span className="text-5xl font-bold">{formatPrice(STRIPE_PLANS.pro.price)}</span>
                <span className="text-gray-600 ml-2">{billingInterval === 'annual' ? '/year' : '/month'}</span>
              </div>
              <p className="text-gray-600">For power users</p>
            </div>

            <ul className="space-y-4 mb-8">
              {STRIPE_PLANS.pro.features.map((feature, index) => (
                <li key={index} className="flex items-start">
                  <svg className="w-5 h-5 text-green-500 mr-3 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span className="text-gray-700">{feature}</span>
                </li>
              ))}
            </ul>

            <button
              onClick={() => handleSubscribe('pro')}
              disabled={loading === 'pro' || !isLoaded}
              className="w-full bg-gray-900 hover:bg-gray-800 text-white font-semibold py-3 px-6 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading === 'pro' ? 'Loading...' : 'Start Free Trial'}
            </button>
          </div>
        </div>

        {/* Agency Plan - Full Width */}
        <div className="max-w-6xl mx-auto mt-8">
          <div className={`bg-gradient-to-r from-purple-600 to-indigo-600 rounded-2xl shadow-xl p-8 text-white ${requestedPlan === 'agency' ? 'ring-4 ring-purple-300/40' : ''}`}>
            <div className="grid md:grid-cols-2 gap-8 items-center">
              <div>
                <h3 className="text-3xl font-bold mb-4">Agency</h3>
                <div className="flex items-baseline mb-4">
                  <span className="text-5xl font-bold">{formatPrice(STRIPE_PLANS.agency.price)}</span>
                  <span className="text-purple-100 ml-2">{billingInterval === 'annual' ? '/year' : '/month'}</span>
                </div>
                <p className="text-purple-100 mb-6">
                  For agencies managing multiple clients
                </p>
                <button
                  onClick={() => handleSubscribe('agency')}
                  disabled={loading === 'agency' || !isLoaded}
                  className="bg-white text-purple-600 hover:bg-purple-50 font-semibold py-3 px-8 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading === 'agency' ? 'Loading...' : 'Start Free Trial'}
                </button>
              </div>

              <div>
                <ul className="space-y-3">
                  {STRIPE_PLANS.agency.features.map((feature, index) => (
                    <li key={index} className="flex items-start">
                      <svg className="w-5 h-5 text-purple-200 mr-3 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      <span className="text-white">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* FAQ or Additional Info */}
        <div className="text-center mt-16">
          <p className="text-gray-600">
            All plans include a 14-day free trial. No credit card required.
          </p>
          <p className="text-gray-600 mt-2">
            Need a custom plan?{' '}
            <a href="mailto:support@streb.com" className="text-blue-600 hover:text-blue-700 font-semibold">
              Contact us
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
