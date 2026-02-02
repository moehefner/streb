import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-helpers';
import { cancelSubscription, reactivateSubscription } from '@/lib/subscription-helpers';

/**
 * POST /api/manage-subscription
 * Cancel or reactivate a subscription
 * 
 * Body: {
 *   action: 'cancel' | 'reactivate'
 * }
 */
export async function POST(request: Request) {
  try {
    const clerkUserId = await requireAuth();
    
    const body = await request.json();
    const { action } = body;

    if (action === 'cancel') {
      const subscription = await cancelSubscription(clerkUserId);
      
      return NextResponse.json({
        success: true,
        message: 'Subscription will be canceled at the end of the billing period',
        cancelAt: subscription.cancel_at,
      });
    } else if (action === 'reactivate') {
      await reactivateSubscription(clerkUserId);
      
      return NextResponse.json({
        success: true,
        message: 'Subscription reactivated successfully',
      });
    } else {
      return NextResponse.json(
        { error: 'Invalid action' },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Error managing subscription:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to manage subscription' },
      { status: 500 }
    );
  }
}