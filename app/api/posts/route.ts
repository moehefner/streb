import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/posts
 * Get all posts for a user
 * 
 * Query params:
 * - userId: string (required)
 * - status?: 'draft' | 'scheduled' | 'posted' | 'failed'
 * - limit?: number
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const status = searchParams.get('status');
    const limit = searchParams.get('limit');

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    const posts = await prisma.post.findMany({
      where: {
        userId,
        ...(status && { status }),
      },
      include: {
        video: {
          select: {
            id: true,
            title: true,
            videoUrl: true,
            thumbnailUrl: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      ...(limit && { take: parseInt(limit) }),
    });

    return NextResponse.json(posts);
  } catch (error) {
    console.error('Error fetching posts:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/posts
 * Create a new post
 * 
 * Body: {
 *   userId: string,
 *   postType: 'text' | 'image_text' | 'video',
 *   contentText?: string,
 *   imageUrl?: string,
 *   videoId?: string,
 *   platforms: string[],
 *   scheduledFor?: string (ISO date),
 *   platformCaptions?: object
 * }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      userId,
      postType,
      contentText,
      imageUrl,
      videoId,
      platforms,
      scheduledFor,
      platformCaptions,
      isAutopilot = false,
    } = body;

    if (!userId || !postType || !platforms || platforms.length === 0) {
      return NextResponse.json(
        { error: 'userId, postType, and platforms are required' },
        { status: 400 }
      );
    }

    // Check usage limits
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { postsUsed: true, postsLimit: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    if (user.postsUsed >= user.postsLimit) {
      return NextResponse.json(
        { error: 'Post limit reached for your plan' },
        { status: 403 }
      );
    }

    // Create post
    const post = await prisma.post.create({
      data: {
        userId,
        postType,
        contentText,
        imageUrl,
        videoId,
        platforms,
        scheduledFor: scheduledFor ? new Date(scheduledFor) : null,
        platformCaptions,
        isAutopilot,
        status: scheduledFor ? 'scheduled' : 'draft',
      },
    });

    // Increment usage counter
    await prisma.user.update({
      where: { id: userId },
      data: { postsUsed: { increment: 1 } },
    });

    return NextResponse.json(post, { status: 201 });
  } catch (error) {
    console.error('Error creating post:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
