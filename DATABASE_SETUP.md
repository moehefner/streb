# Supabase + Prisma Database Setup Guide

## Overview

Streb uses **Supabase** (PostgreSQL) for the database with **Prisma ORM** for type-safe database queries. This guide will help you set up and use the database.

## ✅ What's Already Set Up

- ✅ `@supabase/supabase-js` installed
- ✅ `prisma` and `@prisma/client` installed
- ✅ Supabase client configured (`lib/supabase.ts`)
- ✅ Prisma client configured (`lib/prisma.ts`)
- ✅ Complete database schema (`prisma/schema.sql`)
- ✅ Prisma schema (`prisma/schema.prisma`)
- ✅ Helper functions (`lib/db-helpers.ts`)
- ✅ Example API routes

## 🚀 Quick Start

### 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Click "New Project"
3. Choose your organization and region
4. Save your project credentials

### 2. Set Up Environment Variables

Create `.env.local` file:

```bash
# Copy the example file
cp .env.example .env.local
```

Add your Supabase credentials:

```env
# Database
DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres
DIRECT_URL=postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://[YOUR-PROJECT-REF].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

**Where to find these:**
- Go to your Supabase project dashboard
- Click "Settings" → "Database"
- Connection string is under "Connection string" (URI mode)
- API keys are under "Settings" → "API"

### 3. Run the Database Schema

1. Go to Supabase SQL Editor:
   - Dashboard → SQL Editor → New query

2. Copy and paste the contents of `prisma/schema.sql`

3. Click "Run" to create all tables, indexes, and policies

### 4. Generate Prisma Client

```bash
npx prisma generate
```

### 5. Sync Prisma Schema with Database (Optional)

If you make changes to the Prisma schema:

```bash
npx prisma db push
```

## 📊 Database Schema

### Core Tables

#### Users
- Stores user accounts (linked to Clerk)
- Subscription and billing info
- Usage tracking and limits
- App details for AutoPilot

#### Connected Accounts
- OAuth tokens for Twitter, LinkedIn, Reddit, etc.
- Platform-specific account data

#### Posts
- Social media posts (text, image, video)
- Scheduling and status tracking
- Platform-specific captions
- Engagement metrics

#### Videos
- Remotion-generated videos
- Video metadata and rendering status
- Storage URLs

#### Outreach Campaigns
- Email outreach campaigns
- Campaign settings and stats
- Lead management

#### Leads
- Email leads for campaigns
- Personalization data
- Email tracking (opens, clicks, replies)

#### Usage Stats
- Monthly analytics
- Engagement tracking
- Historical data

#### AutoPilot Config
- AutoPilot settings per user
- Content mix preferences
- Platform configurations

#### Team Members & Clients
- For Agency plan
- Team collaboration
- Client management

## 💻 Usage Examples

### In API Routes

```typescript
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  // Get user
  const user = await prisma.user.findUnique({
    where: { clerkUserId: 'user_xxx' },
  });

  return NextResponse.json(user);
}
```

### In Server Components

```typescript
import { prisma } from '@/lib/prisma';

export default async function DashboardPage() {
  // Fetch data directly in server component
  const posts = await prisma.post.findMany({
    where: { userId: 'user-id' },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });

  return (
    <div>
      {posts.map(post => (
        <div key={post.id}>{post.contentText}</div>
      ))}
    </div>
  );
}
```

### Using Helper Functions

```typescript
import { 
  checkUsageLimit, 
  incrementUsage, 
  getOrCreateUser 
} from '@/lib/db-helpers';

// Check if user can create a post
const { allowed, used, limit } = await checkUsageLimit(userId, 'posts');

if (allowed) {
  // Create post...
  await incrementUsage(userId, 'posts');
}

// Get or create user from Clerk
const user = await getOrCreateUser(
  clerkUserId,
  'user@example.com',
  'John Doe'
);
```

### Using Supabase Client (Browser)

```typescript
import { supabase } from '@/lib/supabase';

// Subscribe to real-time changes
const channel = supabase
  .channel('posts')
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'posts',
  }, (payload) => {
    console.log('New post:', payload.new);
  })
  .subscribe();
```

## 🔐 Row Level Security (RLS)

All tables have RLS enabled. Users can only access their own data.

**Important:** When using the Supabase client in the browser, RLS policies automatically apply. When using Prisma or `supabaseAdmin`, you bypass RLS (use carefully in API routes).

## 📝 API Routes

Example API routes are available:

### `/api/user`
- `GET` - Get user by Clerk ID
- `POST` - Create new user
- `PATCH` - Update user

### `/api/posts`
- `GET` - Get posts (with filters)
- `POST` - Create new post

### `/api/usage`
- `GET` - Check usage limits
- `POST` - Increment usage counter

## 🛠 Common Operations

### Create a New User (from Clerk webhook)

```typescript
const user = await prisma.user.create({
  data: {
    clerkUserId: clerkUser.id,
    email: clerkUser.emailAddresses[0].emailAddress,
    fullName: clerkUser.fullName,
  },
});
```

### Create a Scheduled Post

```typescript
const post = await prisma.post.create({
  data: {
    userId: 'user-id',
    postType: 'text',
    contentText: 'Check out our new feature!',
    platforms: ['twitter', 'linkedin'],
    scheduledFor: new Date('2026-02-15T10:00:00Z'),
    status: 'scheduled',
  },
});
```

### Get User's Dashboard Data

```typescript
const user = await prisma.user.findUnique({
  where: { id: userId },
  include: {
    posts: {
      where: { status: 'scheduled' },
      take: 5,
    },
    videos: {
      where: { status: 'ready' },
      take: 5,
    },
    outreachCampaigns: {
      where: { status: 'active' },
    },
  },
});
```

### Update Subscription Plan

```typescript
await prisma.user.update({
  where: { id: userId },
  data: {
    planType: 'pro',
    postsLimit: 250,
    videosLimit: 75,
    emailsLimit: 2000,
    subscriptionStatus: 'active',
  },
});
```

## 🔄 Prisma Commands

```bash
# Generate Prisma Client after schema changes
npx prisma generate

# Open Prisma Studio (database GUI)
npx prisma studio

# Push schema changes to database
npx prisma db push

# Create a migration
npx prisma migrate dev --name add_new_field

# Reset database (CAUTION: deletes all data)
npx prisma db push --force-reset
```

## 📚 Type Safety

Prisma generates TypeScript types automatically:

```typescript
import { User, Post, Video } from '@prisma/client';

// Types are auto-generated from your schema
const user: User = await prisma.user.findUnique({
  where: { id: userId }
});

// Include relations with type inference
type UserWithPosts = User & {
  posts: Post[];
};
```

## 🚨 Important Notes

1. **Never commit `.env.local`** - It's already in `.gitignore`

2. **Use Prisma for write operations** - Better type safety and migrations

3. **Use Supabase client for real-time** - Subscribe to database changes

4. **RLS is enabled** - Browser queries are automatically filtered by user

5. **Usage limits are enforced** - Always check limits before creating content

6. **Monthly reset** - Usage counters reset on the 1st of each month (implement cron job)

## 🐛 Troubleshooting

### "Prisma Client not found"
```bash
npx prisma generate
```

### Connection string errors
- Check `DATABASE_URL` in `.env.local`
- Ensure password is URL-encoded
- Verify Supabase project is active

### RLS blocking queries
- Use `supabaseAdmin` in API routes
- Or use Prisma (bypasses RLS)

### Type errors after schema changes
```bash
npx prisma generate
# Restart your dev server
```

## 📖 Additional Resources

- [Prisma Documentation](https://www.prisma.io/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [Prisma + Supabase Guide](https://www.prisma.io/docs/guides/database/supabase)

---

**Status**: ✅ Database ready to use!
