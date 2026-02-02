# Streb - Quick Setup Guide

## ✅ What's Already Done

Your Next.js 14 project is ready with:
- ✅ TypeScript configured
- ✅ Tailwind CSS set up
- ✅ shadcn/ui initialized
- ✅ Folder structure created
- ✅ Environment variables template ready
- ✅ Basic dashboard page
- ✅ Auth page placeholders
- ✅ **Supabase + Prisma database integration**
- ✅ **Complete database schema**
- ✅ **API routes with database queries**

## 🚀 Getting Started

### 1. Start the Development Server

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) to see your app!

### 2. Set Up Environment Variables

```bash
# Copy the example file
cp .env.example .env.local

# Then edit .env.local with your actual credentials
```

### 3. Install Integration Packages (As Needed)

#### Clerk Authentication
```bash
# Already installed! ✅
# @clerk/nextjs
# svix (for webhooks)
```

**See [CLERK_SETUP.md](./CLERK_SETUP.md) for complete authentication setup instructions.**

#### Supabase Database
```bash
# Already installed! ✅
# @supabase/supabase-js
# prisma
# @prisma/client
```

**See [DATABASE_SETUP.md](./DATABASE_SETUP.md) for complete database setup instructions.**

#### Stripe Payments
```bash
npm install stripe @stripe/stripe-js
```
Uncomment the client code in `lib/stripe.ts`.

## 📁 Project Structure

```
streb/
├── app/
│   ├── dashboard/          # Dashboard pages
│   │   ├── page.tsx        # Main dashboard (ready to customize!)
│   │   └── layout.tsx      # Dashboard layout
│   ├── api/
│   │   └── health/         # Health check endpoint
│   ├── auth/
│   │   ├── sign-in/        # Sign in page (needs Clerk setup)
│   │   └── sign-up/        # Sign up page (needs Clerk setup)
│   ├── layout.tsx          # Root layout
│   ├── page.tsx            # Landing page
│   └── globals.css         # Global styles
├── components/
│   ├── ui/                 # shadcn/ui components (add as needed)
│   └── index.ts            # Component exports
├── lib/
│   ├── utils.ts            # Utility functions (cn helper)
│   ├── config.ts           # App configuration
│   ├── types.ts            # TypeScript types
│   ├── supabase.ts         # Supabase client (commented)
│   ├── stripe.ts           # Stripe client (commented)
│   └── n8n.ts              # n8n API client (commented)
└── .env.example            # Environment variables template
```

## 🎨 Adding UI Components

shadcn/ui is already initialized. Add components as you need them:

```bash
# Common components you'll likely need:
npx shadcn@latest add button
npx shadcn@latest add card
npx shadcn@latest add input
npx shadcn@latest add form
npx shadcn@latest add dialog
npx shadcn@latest add table
npx shadcn@latest add tabs
npx shadcn@latest add badge
npx shadcn@latest add avatar
npx shadcn@latest add dropdown-menu
```

[Browse all components](https://ui.shadcn.com/docs/components)

## 🔐 Setting Up Clerk Authentication

1. Install Clerk:
   ```bash
   npm install @clerk/nextjs
   ```

2. Get your keys from [clerk.com](https://clerk.com) and add to `.env.local`

3. Wrap your app with ClerkProvider in `app/layout.tsx`:
   ```tsx
   import { ClerkProvider } from '@clerk/nextjs'
   
   export default function RootLayout({
     children,
   }: {
     children: React.ReactNode
   }) {
     return (
       <ClerkProvider>
         <html lang="en">
           <body>{children}</body>
         </html>
       </ClerkProvider>
     )
   }
   ```

4. Update auth pages to use Clerk components:
   ```tsx
   // app/auth/sign-in/page.tsx
   import { SignIn } from '@clerk/nextjs'
   
   export default function SignInPage() {
     return <SignIn />
   }
   ```

5. Enable middleware by renaming `middleware.ts.example` to `middleware.ts`

## 💾 Setting Up Supabase

1. Install Supabase:
   ```bash
   npm install @supabase/supabase-js
   ```

2. Create a project at [supabase.com](https://supabase.com)

3. Add your URL and keys to `.env.local`

4. Uncomment the code in `lib/supabase.ts`

5. Create your database schema in the Supabase dashboard

## 💳 Setting Up Stripe

1. Install Stripe:
   ```bash
   npm install stripe @stripe/stripe-js
   ```

2. Get your API keys from [stripe.com](https://stripe.com)

3. Add keys to `.env.local`

4. Uncomment the code in `lib/stripe.ts`

## 🔄 Setting Up n8n Workflows

1. Set up n8n instance (self-hosted or [n8n.cloud](https://n8n.cloud))

2. Add your n8n URL and API key to `.env.local`

3. Uncomment the code in `lib/n8n.ts`

4. Create your workflows in n8n dashboard

## 🎥 Setting Up Remotion

1. Install Remotion:
   ```bash
   npm install @remotion/cli @remotion/renderer remotion
   ```

2. Get your license key from [remotion.dev](https://remotion.dev)

3. Add license key to `.env.local`

## 📋 Next Steps

1. **Customize the Dashboard**: Edit `app/dashboard/page.tsx` to build your UI
2. **Add Components**: Use shadcn/ui to add the components you need
3. **Set Up Authentication**: Follow the Clerk setup guide above
4. **Create Database Schema**: Design your tables in Supabase
5. **Build API Routes**: Add endpoints in `app/api/`
6. **Create Workflows**: Set up automation in n8n

## 🆘 Need Help?

- [Next.js Docs](https://nextjs.org/docs)
- [shadcn/ui Docs](https://ui.shadcn.com)
- [Clerk Docs](https://clerk.com/docs)
- [Supabase Docs](https://supabase.com/docs)
- [Stripe Docs](https://stripe.com/docs)
- [n8n Docs](https://docs.n8n.io)
- [Remotion Docs](https://www.remotion.dev/docs)

---

**Ready to build? Start the dev server and open `/dashboard`!** 🚀
