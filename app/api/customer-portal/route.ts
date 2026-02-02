import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-helpers';
import { getCustomerPortalUrl } from '@/lib/subscription-helpers';

/**
 * POST /api/customer-portal
 * Get Stripe Customer Portal URL for managing subscription
 */
export async function POST(request: Request) {
  try {
    const clerkUserId = await requireAuth();
    
    const body = await request.json();
    const { returnUrl } = body;

    const portalUrl = await getCustomerPortalUrl(
      clerkUserId,
      returnUrl || `${process.env.NEXT_PUBLIC_APP_URL}/dashboard`
    );

    return NextResponse.json({ url: portalUrl });
  } catch (error) {
    console.error('Error creating portal session:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create portal session' },
      { status: 500 }
    );
  }
}