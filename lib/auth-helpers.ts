/**
 * Clerk authentication helpers
 * 
 * These functions help you work with Clerk authentication
 * in Server Components and API routes.
 */

import { auth, currentUser } from '@clerk/nextjs/server';
import { prisma } from './prisma';
import { getOrCreateUser } from './db-helpers';

/**
 * Get the current user's database record
 * Use this in Server Components and API routes
 */
export async function getCurrentUser() {
  const { userId } = await auth();
  
  if (!userId) {
    return null;
  }

  try {
    // Get user from database
    let user = await prisma.user.findUnique({
      where: { clerkUserId: userId },
      include: {
        connectedAccounts: true,
        autopilotConfig: true,
      },
    });

    // If user doesn't exist in database, create them
    if (!user) {
      const clerkUser = await currentUser();
      if (clerkUser) {
        const email = clerkUser.emailAddresses[0]?.emailAddress;
        const fullName = clerkUser.fullName;
        
        if (email) {
          user = await getOrCreateUser(userId, email, fullName || undefined);
        }
      }
    }

    return user;
  } catch (error) {
    console.error('Error getting current user:', error);
    return null;
  }
}

/**
 * Get the current user's Clerk data
 * Use this when you need Clerk-specific information
 */
export async function getCurrentClerkUser() {
  return await currentUser();
}

/**
 * Check if user is authenticated
 * Use this for quick auth checks
 */
export async function isAuthenticated() {
  const { userId } = await auth();
  return !!userId;
}

/**
 * Get user ID from Clerk
 * Use this when you just need the user ID
 */
export async function getCurrentUserId() {
  const { userId } = await auth();
  return userId;
}

/**
 * Require authentication - throws if not authenticated
 * Use this in API routes that require auth
 */
export async function requireAuth() {
  const { userId } = await auth();
  
  if (!userId) {
    throw new Error('Unauthorized');
  }
  
  return userId;
}