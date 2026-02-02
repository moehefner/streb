# Streb

An all-in-one marketing automation platform for SaaS/app builders.

## Tech Stack

- **Next.js 14** (App Router) + TypeScript
- **Supabase** (Postgres database)
- **Clerk** (authentication)
- **shadcn/ui** + Tailwind CSS (UI components)
- **n8n** (automation workflows)
- **Remotion** (video generation)
- **Stripe** (payments)

## Getting Started

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Environment Variables

Copy `.env.example` to `.env.local` and fill in your credentials:

```bash
cp .env.example .env.local
```

Required environment variables:
- **Supabase**: Create a project at [supabase.com](https://supabase.com)
- **Clerk**: Create an application at [clerk.com](https://clerk.com)
- **Stripe**: Get API keys from [stripe.com](https://stripe.com)
- **n8n**: Self-host or use [n8n.cloud](https://n8n.cloud)
- **Remotion**: Get license key from [remotion.dev](https://remotion.dev)

### 3. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see your application.

## Project Structure

```
streb/
├── app/
│   ├── dashboard/          # Dashboard pages
│   ├── api/                # API routes
│   ├── auth/               # Authentication pages (sign-in, sign-up)
│   ├── layout.tsx          # Root layout
│   └── page.tsx            # Home page
├── components/
│   └── ui/                 # shadcn/ui components
├── lib/
│   ├── utils.ts            # Utility functions
│   ├── supabase.ts         # Supabase client
│   ├── stripe.ts           # Stripe client
│   └── n8n.ts              # n8n API client
├── .env.example            # Environment variables template
└── package.json
```

## Available Routes

- `/` - Landing page
- `/dashboard` - Main dashboard (protected)
- `/auth/sign-in` - Sign in page
- `/auth/sign-up` - Sign up page
- `/api/health` - Health check endpoint

## Next Steps

### 1. Install Additional Packages

Install the packages for your integrations:

```bash
# Supabase
npm install @supabase/supabase-js

# Clerk
npm install @clerk/nextjs

# Stripe
npm install stripe @stripe/stripe-js

# Additional UI dependencies
npm install clsx tailwind-merge
```

### 2. Configure Clerk

Add the Clerk provider to your root layout (`app/layout.tsx`):

```tsx
import { ClerkProvider } from '@clerk/nextjs'
```

### 3. Set Up Supabase

Create your database schema in Supabase and uncomment the client code in `lib/supabase.ts`.

### 4. Configure Stripe

Uncomment the Stripe client in `lib/stripe.ts` and set up webhooks.

### 5. Integrate n8n

Set up your n8n workflows and uncomment the client code in `lib/n8n.ts`.

### 6. Add shadcn/ui Components

Add components as needed:

```bash
npx shadcn@latest add button
npx shadcn@latest add card
npx shadcn@latest add dialog
npx shadcn@latest add form
npx shadcn@latest add input
npx shadcn@latest add label
npx shadcn@latest add table
```

## Development

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
```

## Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [Clerk Documentation](https://clerk.com/docs)
- [shadcn/ui Documentation](https://ui.shadcn.com)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [n8n Documentation](https://docs.n8n.io)
- [Remotion Documentation](https://www.remotion.dev/docs)
- [Stripe Documentation](https://stripe.com/docs)

## License

MIT
"# streb" 
