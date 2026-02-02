# Streb - Quick Reference

## 🚀 Start Development
```bash
npm run dev
```
Visit: http://localhost:3000

## 📁 Key Files to Edit

### Landing Page
- `app/page.tsx` - Home/landing page

### Dashboard
- `app/dashboard/page.tsx` - Main dashboard UI

### Auth Pages  
- `app/auth/sign-in/page.tsx` - Sign in
- `app/auth/sign-up/page.tsx` - Sign up

### API Endpoints
- `app/api/health/route.ts` - Health check
- Create more in `app/api/[endpoint]/route.ts`

### Utilities
- `lib/utils.ts` - Helper functions
- `lib/config.ts` - App config
- `lib/types.ts` - TypeScript types

## 🎨 Add UI Components
```bash
# Button
npx shadcn@latest add button

# Form inputs
npx shadcn@latest add input
npx shadcn@latest add form
npx shadcn@latest add label

# Layout
npx shadcn@latest add card
npx shadcn@latest add dialog
npx shadcn@latest add tabs

# Data display
npx shadcn@latest add table
npx shadcn@latest add badge
npx shadcn@latest add avatar

# Navigation
npx shadcn@latest add dropdown-menu
npx shadcn@latest add navigation-menu
```

## 🔧 Install Integrations

### Clerk (Auth)
```bash
npm install @clerk/nextjs
```

### Supabase (Database)
```bash
npm install @supabase/supabase-js
```

### Stripe (Payments)
```bash
npm install stripe @stripe/stripe-js
```

### Remotion (Video)
```bash
npm install @remotion/cli @remotion/renderer remotion
```

## 📝 Common Commands

```bash
# Development
npm run dev           # Start dev server
npm run build         # Build for production
npm run start         # Start production server
npm run lint          # Run linter

# Add shadcn components
npx shadcn@latest add [component]
npx shadcn@latest add --help

# TypeScript
npx tsc --noEmit      # Type check without building
```

## 🌐 Routes

### Pages
- `/` - Landing page
- `/dashboard` - Dashboard (needs auth)
- `/auth/sign-in` - Sign in
- `/auth/sign-up` - Sign up

### API
- `/api/health` - Health check

## 📦 Project Structure Quick View

```
app/
├── dashboard/         ← Edit your dashboard here
├── api/              ← Add API endpoints here
├── auth/             ← Authentication pages
├── layout.tsx        ← Root layout (add Clerk provider)
└── page.tsx          ← Landing page

components/
└── ui/               ← shadcn components go here

lib/
├── utils.ts          ← Utility functions
├── config.ts         ← Configuration
├── types.ts          ← TypeScript types
├── supabase.ts       ← Database client
├── stripe.ts         ← Payment client
└── n8n.ts            ← Workflow client
```

## 🔐 Environment Setup

1. Copy template:
   ```bash
   cp .env.example .env.local
   ```

2. Add your keys to `.env.local`

3. Never commit `.env.local` (already in .gitignore)

## 💡 Tips

- Components auto-install to `components/ui/`
- Use `cn()` from `lib/utils.ts` for conditional classes
- API routes return JSON automatically
- Hot reload works out of the box
- TypeScript errors? Check `tsconfig.json`

## 📚 Documentation

- `README.md` - Project overview
- `SETUP.md` - Detailed setup guide
- `ARCHITECTURE.md` - System architecture
- `PROJECT_STATUS.md` - Current status

## 🆘 Troubleshooting

### Port already in use
```bash
# Next.js will auto-try next port (3001, 3002, etc.)
```

### TypeScript errors
```bash
npx tsc --noEmit
```

### Tailwind not working
```bash
# Restart dev server
npm run dev
```

### shadcn component not found
```bash
npx shadcn@latest add [component-name]
```

---

**Need more help? Check SETUP.md for detailed instructions!**
