import { NextResponse } from 'next/server';
import { checkUsageLimit, incrementUsage } from '@/lib/db-helpers';

/**
 * GET /api/usage/check
 * Check if user can perform an action based on their usage limits
 * 
 * Query params:
 * - userId: string (required)
 * - type: 'posts' | 'videos' | 'emails' (required)
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const type = searchParams.get('type') as 'posts' | 'videos' | 'emails';

    if (!userId || !type) {
      return NextResponse.json(
        { error: 'userId and type are required' },
        { status: 400 }
      );
    }

    if (!['posts', 'videos', 'emails'].includes(type)) {
      return NextResponse.json(
        { error: 'type must be posts, videos, or emails' },
        { status: 400 }
      );
    }

    const result = await checkUsageLimit(userId, type);

    return NextResponse.json({
      canUse: result.allowed,
      used: result.used,
      limit: result.limit,
      remaining: result.limit - result.used,
    });
  } catch (error) {
    console.error('Error checking usage:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/usage/increment
 * Increment user's usage counter
 * 
 * Body: {
 *   userId: string,
 *   type: 'posts' | 'videos' | 'emails',
 *   amount?: number (default: 1)
 * }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userId, type, amount = 1 } = body;

    if (!userId || !type) {
      return NextResponse.json(
        { error: 'userId and type are required' },
        { status: 400 }
      );
    }

    if (!['posts', 'videos', 'emails'].includes(type)) {
      return NextResponse.json(
        { error: 'type must be posts, videos, or emails' },
        { status: 400 }
      );
    }

    const user = await incrementUsage(userId, type, amount);

    return NextResponse.json({
      success: true,
      used: type === 'posts' ? user.postsUsed : type === 'videos' ? user.videosUsed : user.emailsUsed,
    });
  } catch (error) {
    console.error('Error incrementing usage:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
