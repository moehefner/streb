# Supabase Integration - Setup Complete! 🎉

## ✅ What Was Installed & Configured

### Packages Installed
- ✅ `@supabase/supabase-js` (v2.93.3) - Supabase JavaScript client
- ✅ `prisma` (v7.3.0) - Prisma CLI and migrations
- ✅ `@prisma/client` (v7.3.0) - Prisma Client for type-safe queries

### Files Created

#### Configuration Files
- ✅ `lib/supabase.ts` - Supabase client (browser & admin)
- ✅ `lib/prisma.ts` - Prisma Client singleton
- ✅ `lib/database.types.ts` - TypeScript types for Supabase
- ✅ `prisma/config.ts` - Prisma 7 configuration
- ✅ `prisma/schema.prisma` - Complete Prisma schema with all models
- ✅ `prisma/schema.sql` - Full PostgreSQL schema with RLS policies

#### Helper Functions
- ✅ `lib/db-helpers.ts` - Database utility functions:
  - `getOrCreateUser()` - Create user from Clerk
  - `checkUsageLimit()` - Check if user can perform action
  - `incrementUsage()` - Update usage counters
  - `updatePlanLimits()` - Set limits based on subscription
  - `getCurrentMonthStats()` - Get monthly analytics
  - `getScheduledPosts()` - Fetch scheduled content
  - `getActiveCampaigns()` - Get campaigns with leads
  - `getRecentVideos()` - Fetch recent videos
  - `getUserWithRelations()` - Get user with all data

#### API Routes
- ✅ `app/api/user/route.ts` - User CRUD operations
  - `GET /api/user?clerkId=xxx` - Get user
  - `POST /api/user` - Create user
  - `PATCH /api/user` - Update user

- ✅ `app/api/posts/route.ts` - Posts management
  - `GET /api/posts?userId=xxx` - Get all posts
  - `POST /api/posts` - Create new post

- ✅ `app/api/usage/route.ts` - Usage tracking
  - `GET /api/usage?userId=xxx&type=posts` - Check limits
  - `POST /api/usage` - Increment counter

#### Documentation
- ✅ `DATABASE_SETUP.md` - Complete setup guide
- ✅ `app/database-example/page.tsx` - Working example page

### Environment Variables Updated
- ✅ Added `DATABASE_URL` for Prisma
- ✅ Added `DIRECT_URL` for migrations
- ✅ Updated Supabase configuration

## 🗄️ Database Schema

### 11 Tables Created

1. **users** - User accounts, subscriptions, usage tracking
2. **connected_accounts** - OAuth tokens for platforms
3. **posts** - Social media posts with scheduling
4. **videos** - Remotion-generated videos
5. **outreach_campaigns** - Email campaigns
6. **leads** - Campaign leads with tracking
7. **usage_stats** - Monthly analytics
8. **autopilot_config** - AutoPilot settings
9. **team_members** - Team collaboration (Agency)
10. **clients** - Client management (Agency)

### Features Included
- ✅ Row Level Security (RLS) policies
- ✅ Indexes for performance
- ✅ Foreign key constraints
- ✅ Automatic timestamps
- ✅ Usage limit checking function
- ✅ Cascading deletes

## 🚀 Next Steps

### 1. Set Up Supabase Project

```bash
# 1. Create project at supabase.com
# 2. Copy credentials to .env.local:

DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
NEXT_PUBLIC_SUPABASE_URL=https://[PROJECT-REF].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### 2. Run Database Schema

1. Open Supabase SQL Editor
2. Copy contents of `prisma/schema.sql`
3. Run the SQL to create all tables

### 3. Generate Prisma Client (Already Done!)

```bash
npx prisma generate  # ✅ Already completed
```

### 4. Start Using the Database

**In API Routes:**
```typescript
import { prisma } from '@/lib/prisma';

const user = await prisma.user.findUnique({
  where: { clerkUserId: 'user_xxx' }
});
```

**In Server Components:**
```typescript
import { prisma } from '@/lib/prisma';

export default async function Page() {
  const posts = await prisma.post.findMany({
    where: { userId: 'xxx' },
    orderBy: { createdAt: 'desc' }
  });
  
  return <div>{/* render posts */}</div>;
}
```

**Using Helper Functions:**
```typescript
import { checkUsageLimit, incrementUsage } from '@/lib/db-helpers';

const { allowed, used, limit } = await checkUsageLimit(userId, 'posts');

if (allowed) {
  // Create post...
  await incrementUsage(userId, 'posts');
}
```

## 📚 Documentation

- **Full Setup Guide**: See `DATABASE_SETUP.md`
- **Example Page**: Visit `/database-example` (after adding user ID)
- **API Routes**: Check `app/api/*/route.ts` files
- **Schema Reference**: See `prisma/schema.prisma`

## 🔧 Useful Commands

```bash
# Generate Prisma Client after schema changes
npx prisma generate

# Open Prisma Studio (database GUI)
npx prisma studio

# Push schema changes to database
npx prisma db push

# View database in browser
# Visit: https://app.supabase.com/project/[PROJECT-REF]/editor
```

## 📊 Usage Example Flow

### 1. User Signs Up (Clerk Webhook)
```typescript
// Create user in database
const user = await prisma.user.create({
  data: {
    clerkUserId: clerkUser.id,
    email: clerkUser.email,
    fullName: clerkUser.fullName,
  }
});
```

### 2. User Creates a Post
```typescript
// Check limit
const { allowed } = await checkUsageLimit(userId, 'posts');

if (!allowed) {
  return { error: 'Post limit reached' };
}

// Create post
const post = await prisma.post.create({
  data: {
    userId,
    postType: 'text',
    contentText: 'Hello world!',
    platforms: ['twitter', 'linkedin'],
    status: 'draft',
  }
});

// Increment usage
await incrementUsage(userId, 'posts');
```

### 3. Fetch Dashboard Data
```typescript
const user = await prisma.user.findUnique({
  where: { id: userId },
  include: {
    posts: { take: 10, orderBy: { createdAt: 'desc' } },
    videos: { take: 5, where: { status: 'ready' } },
    outreachCampaigns: { where: { status: 'active' } },
  }
});
```

## 🎯 Key Features Ready to Use

### User Management
- ✅ Create/update users from Clerk
- ✅ Track subscription status
- ✅ Enforce usage limits by plan
- ✅ Store app details for AutoPilot

### Content Creation
- ✅ Schedule posts to multiple platforms
- ✅ Generate and store videos
- ✅ Track engagement metrics
- ✅ AutoPilot content generation

### Outreach Campaigns
- ✅ Create email campaigns
- ✅ Manage leads with personalization
- ✅ Track opens, clicks, replies
- ✅ Automated follow-ups

### Analytics
- ✅ Monthly usage tracking
- ✅ Engagement metrics
- ✅ Campaign performance
- ✅ Video view tracking

### Team Collaboration (Agency Plan)
- ✅ Add team members
- ✅ Manage permissions
- ✅ Assign clients to team members

## ⚠️ Important Notes

1. **Row Level Security (RLS) is enabled** - Users can only access their own data
2. **Usage limits are enforced** - Check limits before creating content
3. **Monthly reset needed** - Implement a cron job to reset usage on the 1st
4. **Use Prisma for writes** - Better type safety and easier migrations
5. **Use Supabase client for real-time** - Subscribe to database changes in browser

## 🐛 Troubleshooting

### Prisma Client Not Found
```bash
npx prisma generate
```

### Connection Errors
- Verify `DATABASE_URL` in `.env.local`
- Check Supabase project is active
- Ensure password is URL-encoded

### Type Errors
```bash
npx prisma generate
# Restart dev server
npm run dev
```

## 🎉 You're Ready!

Your Streb database is fully configured and ready to use. You can now:

1. ✅ Query the database from API routes
2. ✅ Fetch data in Server Components
3. ✅ Use helper functions for common operations
4. ✅ Track user usage and enforce limits
5. ✅ Store posts, videos, and campaign data
6. ✅ Manage team members and clients

**Next**: Set up your Supabase project and run the SQL schema to create the tables!

---

**Status**: ✅ Supabase integration complete!  
**Documentation**: `DATABASE_SETUP.md`  
**Example**: `/database-example`
