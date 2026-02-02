/**
 * Database helper functions for common operations
 */

import { prisma } from './prisma';

/**
 * Get or create a user in the database from Clerk user data
 */
export async function getOrCreateUser(clerkUserId: string, email: string, fullName?: string) {
  let user = await prisma.user.findUnique({
    where: { clerkUserId },
    include: {
      connectedAccounts: true,
      autopilotConfig: true,
    },
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        clerkUserId,
        email,
        fullName,
        // Default plan and limits for new users
        planType: 'free',
        postsLimit: 5,
        videosLimit: 3,
        emailsLimit: 25,
      },
      include: {
        connectedAccounts: true,
        autopilotConfig: true,
      },
    });
  }

  return user;
}

/**
 * Check if user has reached their usage limit
 */
export async function checkUsageLimit(
  userId: string,
  type: 'posts' | 'videos' | 'emails'
): Promise<{ allowed: boolean; used: number; limit: number }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      postsUsed: true,
      postsLimit: true,
      videosUsed: true,
      videosLimit: true,
      emailsUsed: true,
      emailsLimit: true,
    },
  });

  if (!user) {
    throw new Error('User not found');
  }

  let used = 0;
  let limit = 0;

  switch (type) {
    case 'posts':
      used = user.postsUsed;
      limit = user.postsLimit;
      break;
    case 'videos':
      used = user.videosUsed;
      limit = user.videosLimit;
      break;
    case 'emails':
      used = user.emailsUsed;
      limit = user.emailsLimit;
      break;
  }

  return {
    allowed: used < limit,
    used,
    limit,
  };
}

/**
 * Increment user's usage count
 */
export async function incrementUsage(
  userId: string,
  type: 'posts' | 'videos' | 'emails',
  amount: number = 1
) {
  const updateData: any = {};

  switch (type) {
    case 'posts':
      updateData.postsUsed = { increment: amount };
      break;
    case 'videos':
      updateData.videosUsed = { increment: amount };
      break;
    case 'emails':
      updateData.emailsUsed = { increment: amount };
      break;
  }

  return await prisma.user.update({
    where: { id: userId },
    data: updateData,
  });
}

/**
 * Reset monthly usage for all users (to be called by a cron job)
 */
export async function resetMonthlyUsage() {
  return await prisma.user.updateMany({
    data: {
      postsUsed: 0,
      videosUsed: 0,
      emailsUsed: 0,
    },
  });
}

/**
 * Get user's current month usage stats
 */
export async function getCurrentMonthStats(userId: string) {
  const currentMonth = new Date().toISOString().slice(0, 7); // '2026-02'

  let stats = await prisma.usageStat.findUnique({
    where: {
      userId_month: {
        userId,
        month: currentMonth,
      },
    },
  });

  if (!stats) {
    stats = await prisma.usageStat.create({
      data: {
        userId,
        month: currentMonth,
      },
    });
  }

  return stats;
}

/**
 * Update plan limits based on subscription tier
 */
export async function updatePlanLimits(
  userId: string,
  plan: 'free' | 'starter' | 'pro' | 'agency'
) {
  const limits: Record<string, { posts: number; videos: number; emails: number }> = {
    free: { posts: 5, videos: 3, emails: 25 },
    starter: { posts: 100, videos: 25, emails: 750 },
    pro: { posts: 250, videos: 75, emails: 2000 },
    agency: { posts: 500, videos: 150, emails: 5000 },
  };

  const planLimits = limits[plan];

  return await prisma.user.update({
    where: { id: userId },
    data: {
      planType: plan,
      postsLimit: planLimits.posts,
      videosLimit: planLimits.videos,
      emailsLimit: planLimits.emails,
    },
  });
}

/**
 * Get user with all related data
 */
export async function getUserWithRelations(userId: string) {
  return await prisma.user.findUnique({
    where: { id: userId },
    include: {
      connectedAccounts: true,
      autopilotConfig: true,
      usageStats: {
        orderBy: { createdAt: 'desc' },
        take: 12, // Last 12 months
      },
    },
  });
}

/**
 * Get user's scheduled posts
 */
export async function getScheduledPosts(userId: string) {
  return await prisma.post.findMany({
    where: {
      userId,
      status: 'scheduled',
      scheduledFor: {
        gte: new Date(),
      },
    },
    orderBy: {
      scheduledFor: 'asc',
    },
  });
}

/**
 * Get user's active campaigns with stats
 */
export async function getActiveCampaigns(userId: string) {
  return await prisma.outreachCampaign.findMany({
    where: {
      userId,
      status: 'active',
    },
    include: {
      leads: {
        select: {
          id: true,
          email: true,
          emailSent: true,
          emailOpened: true,
          emailReplied: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });
}

/**
 * Get user's recent videos
 */
export async function getRecentVideos(userId: string, limit: number = 10) {
  return await prisma.video.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}
