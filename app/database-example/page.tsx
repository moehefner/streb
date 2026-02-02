/**
 * Example Server Component demonstrating database queries
 * 
 * This file shows how to:
 * - Query the database in Server Components
 * - Use Prisma for type-safe queries
 * - Handle errors gracefully
 * - Display data with proper TypeScript types
 */

import { prisma } from '@/lib/prisma';

// Example: Fetch user data
async function getUserData(userId: string) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        connectedAccounts: {
          where: { isActive: true },
        },
        autopilotConfig: true,
      },
    });

    return user;
  } catch (error) {
    console.error('Error fetching user:', error);
    return null;
  }
}

// Example: Fetch recent posts
async function getRecentPosts(userId: string, limit: number = 10) {
  try {
    const posts = await prisma.post.findMany({
      where: { userId },
      include: {
        video: {
          select: {
            id: true,
            title: true,
            thumbnailUrl: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return posts;
  } catch (error) {
    console.error('Error fetching posts:', error);
    return [];
  }
}

// Example: Fetch usage stats
async function getUsageStats(userId: string) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        postsUsed: true,
        postsLimit: true,
        videosUsed: true,
        videosLimit: true,
        emailsUsed: true,
        emailsLimit: true,
        planType: true,
      },
    });

    return user;
  } catch (error) {
    console.error('Error fetching usage stats:', error);
    return null;
  }
}

// Server Component
export default async function DatabaseExamplePage() {
  // Replace with actual user ID from Clerk
  const userId = 'example-user-id';

  // Fetch data in parallel
  const [user, posts, usage] = await Promise.all([
    getUserData(userId),
    getRecentPosts(userId, 5),
    getUsageStats(userId),
  ]);

  if (!user) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4">User Not Found</h1>
        <p className="text-muted-foreground">
          Please create a user account first.
        </p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-8">
      <h1 className="text-3xl font-bold mb-8">Database Integration Example</h1>

      {/* User Information */}
      <div className="mb-8 rounded-lg border bg-card p-6">
        <h2 className="text-xl font-semibold mb-4">User Information</h2>
        <div className="space-y-2">
          <p>
            <span className="font-medium">Email:</span> {user.email}
          </p>
          <p>
            <span className="font-medium">Plan:</span>{' '}
            <span className="capitalize">{user.planType}</span>
          </p>
          <p>
            <span className="font-medium">Connected Accounts:</span>{' '}
            {user.connectedAccounts.length}
          </p>
          <p>
            <span className="font-medium">AutoPilot:</span>{' '}
            {user.autopilotConfig?.isActive ? 'Active' : 'Inactive'}
          </p>
        </div>
      </div>

      {/* Usage Stats */}
      {usage && (
        <div className="mb-8 rounded-lg border bg-card p-6">
          <h2 className="text-xl font-semibold mb-4">Usage Stats</h2>
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <p className="text-sm text-muted-foreground">Posts</p>
              <p className="text-2xl font-bold">
                {usage.postsUsed} / {usage.postsLimit}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Videos</p>
              <p className="text-2xl font-bold">
                {usage.videosUsed} / {usage.videosLimit}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Emails</p>
              <p className="text-2xl font-bold">
                {usage.emailsUsed} / {usage.emailsLimit}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Recent Posts */}
      <div className="rounded-lg border bg-card p-6">
        <h2 className="text-xl font-semibold mb-4">Recent Posts</h2>
        {posts.length === 0 ? (
          <p className="text-muted-foreground">No posts yet.</p>
        ) : (
          <div className="space-y-4">
            {posts.map((post) => (
              <div
                key={post.id}
                className="rounded-md border p-4 hover:bg-muted/50"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="font-medium capitalize">{post.postType}</p>
                    <p className="text-sm text-muted-foreground">
                      {post.contentText?.substring(0, 100)}
                      {post.contentText && post.contentText.length > 100 && '...'}
                    </p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Platforms: {post.platforms.join(', ')}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2 py-1 text-xs ${
                      post.status === 'posted'
                        ? 'bg-green-100 text-green-700'
                        : post.status === 'scheduled'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {post.status}
                  </span>
                </div>
                {post.video && (
                  <div className="mt-2 text-sm text-muted-foreground">
                    📹 {post.video.title || 'Untitled Video'}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* API Examples */}
      <div className="mt-8 rounded-lg border bg-muted p-6">
        <h2 className="text-xl font-semibold mb-4">API Usage Examples</h2>
        <div className="space-y-4 text-sm">
          <div>
            <p className="font-medium mb-1">Get User:</p>
            <code className="block rounded bg-black p-2 text-white">
              GET /api/user?clerkId=user_xxx
            </code>
          </div>
          <div>
            <p className="font-medium mb-1">Create Post:</p>
            <code className="block rounded bg-black p-2 text-white">
              POST /api/posts<br />
              {`{ "userId": "xxx", "postType": "text", "platforms": ["twitter"] }`}
            </code>
          </div>
          <div>
            <p className="font-medium mb-1">Check Usage:</p>
            <code className="block rounded bg-black p-2 text-white">
              GET /api/usage?userId=xxx&type=posts
            </code>
          </div>
        </div>
      </div>
    </div>
  );
}
