# Streb - Project Architecture

## 📐 Project Structure

```
streb/
│
├── 📱 app/                          # Next.js App Router
│   ├── 📊 dashboard/                # Dashboard Feature
│   │   ├── page.tsx                 # Main dashboard UI
│   │   └── layout.tsx               # Dashboard layout wrapper
│   │
│   ├── 🔌 api/                      # API Routes
│   │   └── health/
│   │       └── route.ts             # Health check endpoint
│   │
│   ├── 🔐 auth/                     # Authentication Pages
│   │   ├── sign-in/
│   │   │   └── page.tsx             # Sign in page
│   │   └── sign-up/
│   │       └── page.tsx             # Sign up page
│   │
│   ├── layout.tsx                   # Root layout (wrap with Clerk)
│   ├── page.tsx                     # Landing page
│   ├── globals.css                  # Global styles + Tailwind
│   └── fonts/                       # Geist font files
│
├── 🧩 components/                   # React Components
│   ├── ui/                          # shadcn/ui components
│   └── index.ts                     # Component exports
│
├── 📚 lib/                          # Utilities & Integrations
│   ├── utils.ts                     # Utility functions (cn)
│   ├── config.ts                    # App configuration
│   ├── types.ts                     # TypeScript types
│   ├── supabase.ts                  # Supabase client (commented)
│   ├── stripe.ts                    # Stripe client (commented)
│   └── n8n.ts                       # n8n API client (commented)
│
├── 📄 Configuration Files
│   ├── .env.example                 # Environment variables template
│   ├── middleware.ts.example        # Clerk middleware template
│   ├── next.config.mjs              # Next.js configuration
│   ├── tailwind.config.ts           # Tailwind CSS config
│   ├── tsconfig.json                # TypeScript config
│   ├── postcss.config.mjs           # PostCSS config
│   ├── components.json              # shadcn/ui config
│   ├── .eslintrc.json               # ESLint config
│   └── package.json                 # Dependencies & scripts
│
├── 📖 Documentation
│   ├── README.md                    # Project overview
│   ├── SETUP.md                     # Setup instructions
│   └── PROJECT_STATUS.md            # Current status
│
└── 🚫 .gitignore                    # Git ignore rules

```

## 🔄 Data Flow Architecture

```
┌─────────────────┐
│   User Browser  │
└────────┬────────┘
         │
         ↓
┌─────────────────────────────────────────┐
│         Next.js App (Port 3000)         │
│                                          │
│  ┌────────────┐      ┌──────────────┐  │
│  │  Frontend  │◄────►│  API Routes  │  │
│  │  (React)   │      │  (/app/api)  │  │
│  └────────────┘      └──────┬───────┘  │
│         │                    │          │
│         ↓                    ↓          │
│  ┌────────────┐      ┌──────────────┐  │
│  │ Middleware │      │   Server     │  │
│  │  (Clerk)   │      │   Actions    │  │
│  └────────────┘      └──────────────┘  │
└─────────┬──────────────────┬───────────┘
          │                  │
          ↓                  ↓
┌─────────────────┐  ┌─────────────────┐
│  Clerk Auth     │  │   Supabase DB   │
│  (Sessions)     │  │   (Postgres)    │
└─────────────────┘  └─────────────────┘
          │                  │
          ↓                  ↓
┌─────────────────┐  ┌─────────────────┐
│  Stripe         │  │   n8n           │
│  (Payments)     │  │   (Workflows)   │
└─────────────────┘  └─────────────────┘
          │
          ↓
┌─────────────────┐
│  Remotion       │
│  (Videos)       │
└─────────────────┘
```

## 🎯 Feature Roadmap

### Phase 1: Foundation (Current)
- ✅ Next.js project setup
- ✅ TypeScript configuration
- ✅ Tailwind CSS + shadcn/ui
- ✅ Basic routing structure
- ✅ Environment setup

### Phase 2: Authentication
- ⏳ Clerk integration
- ⏳ Protected routes
- ⏳ User authentication flow
- ⏳ Session management

### Phase 3: Database
- ⏳ Supabase setup
- ⏳ Database schema design
- ⏳ User profiles
- ⏳ Workspace management

### Phase 4: Core Features
- ⏳ Dashboard UI
- ⏳ Workflow builder
- ⏳ n8n integration
- ⏳ Analytics display

### Phase 5: Payments
- ⏳ Stripe integration
- ⏳ Subscription plans
- ⏳ Billing management
- ⏳ Usage tracking

### Phase 6: Video Generation
- ⏳ Remotion setup
- ⏳ Video templates
- ⏳ Rendering pipeline
- ⏳ Video storage

## 🔧 Tech Stack Details

### Frontend
- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **UI Library**: React 18
- **Styling**: Tailwind CSS
- **Components**: shadcn/ui
- **Icons**: Lucide React

### Backend
- **API**: Next.js API Routes
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Clerk
- **Payments**: Stripe
- **Automation**: n8n
- **Video**: Remotion

### DevOps
- **Package Manager**: npm
- **Version Control**: Git
- **Linting**: ESLint
- **Type Checking**: TypeScript

## 📋 Environment Variables

```bash
# Supabase - Database
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Clerk - Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=

# Stripe - Payments
STRIPE_SECRET_KEY=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_WEBHOOK_SECRET=

# n8n - Automation
N8N_API_URL=
N8N_API_KEY=

# Remotion - Video Generation
REMOTION_LICENSE_KEY=

# Application
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## 🚀 Deployment Options

### Vercel (Recommended for Next.js)
1. Push to GitHub
2. Connect to Vercel
3. Add environment variables
4. Deploy automatically

### Self-Hosted
1. Build: `npm run build`
2. Start: `npm run start`
3. Configure reverse proxy (Nginx/Caddy)
4. Set up SSL certificate

### Docker
1. Create Dockerfile
2. Build image: `docker build -t streb .`
3. Run container: `docker run -p 3000:3000 streb`

---

**Status**: ✅ Foundation Complete - Ready to Build!
