import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth-helpers';

/**
 * GET /api/user
 * Get current authenticated user from database
 * 
 * Example usage:
 * const response = await fetch('/api/user');
 * const user = await response.json();
 */
export async function GET() {
  try {
    const clerkId = await requireAuth();

    const user = await prisma.user.findUnique({
      where: { clerkUserId: clerkId },
      include: {
        connectedAccounts: true,
        autopilotConfig: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(user);
  } catch (error) {
    console.error('Error fetching user:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/user
 * Create a new user
 * 
 * Body: { clerkUserId: string, email: string, fullName?: string }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { clerkUserId, email, fullName } = body;

    if (!clerkUserId || !email) {
      return NextResponse.json(
        { error: 'Clerk user ID and email are required' },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { clerkUserId },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'User already exists', user: existingUser },
        { status: 409 }
      );
    }

    // Create new user
    const user = await prisma.user.create({
      data: {
        clerkUserId,
        email,
        fullName,
      },
    });

    return NextResponse.json(user, { status: 201 });
  } catch (error) {
    console.error('Error creating user:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/user
 * Update user details
 * 
 * Body: { clerkUserId: string, ...updateData }
 */
export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { clerkUserId, ...updateData } = body;

    if (!clerkUserId) {
      return NextResponse.json(
        { error: 'Clerk user ID is required' },
        { status: 400 }
      );
    }

    const user = await prisma.user.update({
      where: { clerkUserId },
      data: updateData,
    });

    return NextResponse.json(user);
  } catch (error) {
    console.error('Error updating user:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
