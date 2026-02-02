# Clerk Authentication Setup Guide

## ✅ What's Already Configured

Your Streb app now has complete Clerk authentication integration:

- ✅ **@clerk/nextjs** installed (latest version)
- ✅ **ClerkProvider** configured in root layout
- ✅ **Sign-in page** at `/sign-in` with custom styling
- ✅ **Sign-up page** at `/sign-up` with custom styling
- ✅ **Middleware** protecting `/dashboard` and API routes
- ✅ **Webhook** for syncing users to Supabase database
- ✅ **Helper functions** for server-side auth
- ✅ **Updated dashboard** showing user info
- ✅ **Updated homepage** with auth buttons

## 🚀 Quick Setup

### 1. Create a Clerk Application

1. Go to [clerk.com](https://clerk.com) and sign up
2. Create a new application
3. Choose your authentication methods (email, Google, GitHub, etc.)
4. Copy your API keys

### 2. Set Environment Variables

Add to your `.env.local` file:

```env
# Required
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_your-key-here
CLERK_SECRET_KEY=sk_test_your-secret-here
CLERK_WEBHOOK_SECRET=whsec_your-webhook-secret

# Optional (defaults provided)
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/dashboard
```

**Where to find these:**
- **Publishable Key**: Clerk Dashboard → API Keys → Publishable key
- **Secret Key**: Clerk Dashboard → API Keys → Secret key  
- **Webhook Secret**: Clerk Dashboard → Webhooks → Create endpoint → Copy signing secret

### 3. Configure Webhook (Important!)

1. In Clerk Dashboard, go to **Webhooks**
2. Click **Add Endpoint**
3. Set URL to: `https://yourdomain.com/api/webhooks/clerk`
   - For local development: `https://your-ngrok-url.ngrok.io/api/webhooks/clerk`
4. Subscribe to events:
   - ✅ `user.created`
   - ✅ `user.updated` 
   - ✅ `user.deleted`
5. Copy the **Signing Secret** to `CLERK_WEBHOOK_SECRET`

### 4. Test Authentication

```bash
npm run dev
```

Visit your app and try:
- ✅ Sign up at `/sign-up`
- ✅ Sign in at `/sign-in`
- ✅ Access protected `/dashboard`
- ✅ Check user appears in Supabase database

## 📁 Files Created/Modified

### Authentication Pages
- ✅ `app/sign-in/page.tsx` - Custom sign-in page with Streb branding
- ✅ `app/sign-up/page.tsx` - Custom sign-up page with Streb branding

### Middleware & Protection
- ✅ `middleware.ts` - Route protection and auth checks

### Database Integration  
- ✅ `app/api/webhooks/clerk/route.ts` - User sync webhook
- ✅ `lib/auth-helpers.ts` - Server-side auth utilities

### UI Updates
- ✅ `app/layout.tsx` - ClerkProvider wrapper
- ✅ `app/page.tsx` - Homepage with auth buttons
- ✅ `app/dashboard/page.tsx` - User info display

## 🔐 Authentication Flow

### 1. User Signs Up
```
User fills form → Clerk creates account → Webhook fires → User created in Supabase
```

### 2. User Signs In
```
User enters credentials → Clerk validates → Redirects to /dashboard → Shows user data
```

### 3. Protected Routes
```
User visits /dashboard → Middleware checks auth → Redirects to /sign-in if not authenticated
```

### 4. API Protection
```
Client calls API → Middleware checks auth → Returns 401 if not authenticated
```

## 💻 Usage Examples

### In Server Components

```typescript
import { getCurrentUser } from '@/lib/auth-helpers';

export default async function MyPage() {
  const user = await getCurrentUser();
  
  if (!user) {
    return <div>Please sign in</div>;
  }
  
  return <div>Hello, {user.fullName}!</div>;
}
```

### In API Routes

```typescript
import { requireAuth } from '@/lib/auth-helpers';

export async function GET() {
  try {
    const userId = await requireAuth();
    
    // User is authenticated, proceed...
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}
```

### In Client Components

```typescript
import { useUser } from '@clerk/nextjs';

export default function MyComponent() {
  const { user, isLoaded, isSignedIn } = useUser();
  
  if (!isLoaded) return <div>Loading...</div>;
  if (!isSignedIn) return <div>Please sign in</div>;
  
  return <div>Hello, {user.fullName}!</div>;
}
```

## 🛠 Available Helper Functions

### `getCurrentUser()`
Get current user's database record (includes Supabase data):

```typescript
const user = await getCurrentUser();
// Returns: User with connectedAccounts, autopilotConfig, etc.
```

### `getCurrentClerkUser()`
Get Clerk user data:

```typescript
const clerkUser = await getCurrentClerkUser();
// Returns: Clerk user object with email, name, etc.
```

### `isAuthenticated()`
Quick auth check:

```typescript
const authenticated = await isAuthenticated();
// Returns: boolean
```

### `requireAuth()`
Require authentication (throws if not authenticated):

```typescript
const userId = await requireAuth(); // Throws if not authenticated
```

## 🎨 UI Components Available

### Clerk Components
- `<SignInButton>` - Trigger sign-in modal/redirect
- `<SignUpButton>` - Trigger sign-up modal/redirect  
- `<UserButton>` - User profile dropdown (already in dashboard)
- `<SignedIn>` - Show content only when signed in
- `<SignedOut>` - Show content only when signed out

### Example Usage

```typescript
import { SignedIn, SignedOut, SignInButton, UserButton } from '@clerk/nextjs';

export default function Navigation() {
  return (
    <nav>
      <SignedOut>
        <SignInButton mode="modal">
          <button>Sign In</button>
        </SignInButton>
      </SignedOut>
      
      <SignedIn>
        <UserButton afterSignOutUrl="/" />
      </SignedIn>
    </nav>
  );
}
```

## 🔄 User Synchronization

Users are automatically synced between Clerk and Supabase:

### When User Signs Up
1. Clerk creates user account
2. Webhook fires to `/api/webhooks/clerk`
3. User created in Supabase `users` table with:
   - `clerkUserId` (Clerk ID)
   - `email` (primary email)
   - `fullName` (first + last name)
   - Default plan limits (free tier)

### When User Updates Profile
1. User updates profile in Clerk
2. Webhook fires with updated data
3. Supabase user record updated

### When User Deletes Account
1. User deleted from Clerk
2. Webhook fires
3. User deleted from Supabase (cascades to all related data)

## 🚨 Important Security Notes

### Environment Variables
- ✅ `NEXT_PUBLIC_*` variables are safe for client-side
- ⚠️ `CLERK_SECRET_KEY` must be server-only (never expose)
- ⚠️ `CLERK_WEBHOOK_SECRET` must be server-only

### Route Protection
- ✅ `/dashboard/*` routes are protected by middleware
- ✅ API routes require authentication
- ✅ Public routes: `/`, `/sign-in`, `/sign-up`, `/api/health`, `/api/webhooks/*`

### Webhook Security
- ✅ Webhook signature verification using `svix`
- ✅ Only processes verified Clerk events
- ✅ Graceful error handling

## 🐛 Troubleshooting

### "Clerk: Missing publishableKey"
- Check `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` in `.env.local`
- Ensure it starts with `pk_test_` or `pk_live_`

### "Webhook signature verification failed"
- Check `CLERK_WEBHOOK_SECRET` matches Clerk dashboard
- Ensure webhook URL is correct in Clerk dashboard

### "User not found in database"
- Check webhook is configured and firing
- Verify webhook endpoint is accessible
- Check server logs for webhook errors

### Infinite redirect loops
- Check middleware configuration
- Verify sign-in/sign-up URLs are correct
- Ensure public routes are properly defined

### TypeScript errors
```bash
# Restart dev server after adding Clerk
npm run dev
```

## 📚 Additional Resources

- [Clerk Documentation](https://clerk.com/docs)
- [Clerk Next.js Guide](https://clerk.com/docs/quickstarts/nextjs)
- [Clerk Webhooks](https://clerk.com/docs/integrations/webhooks)
- [Clerk Components](https://clerk.com/docs/components/overview)

## 🎯 What's Next?

Your authentication is fully set up! You can now:

1. ✅ **Customize sign-in/sign-up pages** - Modify styling in `app/sign-in/page.tsx`
2. ✅ **Add social providers** - Configure in Clerk dashboard
3. ✅ **Set up user roles** - Use Clerk's organization features
4. ✅ **Add profile management** - Use Clerk's `<UserProfile>` component
5. ✅ **Implement team features** - Use the `team_members` table

---

**Status**: ✅ Clerk authentication fully integrated!  
**Test it**: Visit `/sign-up` to create an account  
**Dashboard**: Protected at `/dashboard` with user info