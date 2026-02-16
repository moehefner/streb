import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

type CheckResult = boolean | Promise<boolean>
type Check = {
  name: string
  check: () => CheckResult
}

function loadLocalEnvFile(fileName: string) {
  const filePath = path.resolve(process.cwd(), fileName)
  if (!fs.existsSync(filePath)) return

  const raw = fs.readFileSync(filePath, 'utf8')
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    const eqIndex = trimmed.indexOf('=')
    if (eqIndex < 1) continue

    const key = trimmed.slice(0, eqIndex).trim()
    const value = trimmed.slice(eqIndex + 1).trim().replace(/^['"]|['"]$/g, '')
    if (!process.env[key]) {
      process.env[key] = value
    }
  }
}

loadLocalEnvFile('.env')
loadLocalEnvFile('.env.local')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

const supabase = supabaseUrl && serviceRoleKey
  ? createClient(supabaseUrl, serviceRoleKey)
  : null

const checks: Check[] = [
  { name: 'Clerk Auth', check: () => !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY },
  { name: 'Supabase URL', check: () => !!process.env.NEXT_PUBLIC_SUPABASE_URL },
  { name: 'Supabase Service Role', check: () => !!process.env.SUPABASE_SERVICE_ROLE_KEY },
  { name: 'Stripe Secret', check: () => !!process.env.STRIPE_SECRET_KEY },
  { name: 'Claude API', check: () => !!process.env.ANTHROPIC_API_KEY },
  { name: 'OpenAI API', check: () => !!process.env.OPENAI_API_KEY },
  { name: 'Twitter API', check: () => !!process.env.TWITTER_CLIENT_ID },
  { name: 'LinkedIn API', check: () => !!process.env.LINKEDIN_CLIENT_ID },
  { name: 'Meta API', check: () => !!process.env.META_APP_ID },
  { name: 'Resend API', check: () => !!process.env.RESEND_API_KEY },
  {
    name: 'Users table',
    check: async () => {
      if (!supabase) return false
      const { error } = await supabase.from('users').select('id').limit(1)
      return !error
    }
  },
  {
    name: 'Campaigns table',
    check: async () => {
      if (!supabase) return false
      const { error } = await supabase.from('autopilot_configs').select('id').limit(1)
      return !error
    }
  },
  {
    name: 'Stripe Starter Price',
    check: () => !!(process.env.STRIPE_STARTER_MONTHLY_PRICE_ID || process.env.STRIPE_STARTER_PRICE_ID)
  },
  {
    name: 'Stripe Pro Price',
    check: () => !!(process.env.STRIPE_PRO_MONTHLY_PRICE_ID || process.env.STRIPE_PRO_PRICE_ID)
  }
]

async function runChecks() {
  console.log('Running preflight checks...\n')

  let passed = 0
  let failed = 0

  for (const check of checks) {
    try {
      const result = await check.check()
      if (result) {
        console.log(`[OK] ${check.name}`)
        passed += 1
      } else {
        console.log(`[FAIL] ${check.name}`)
        failed += 1
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.log(`[FAIL] ${check.name} (error: ${message})`)
      failed += 1
    }
  }

  console.log(`\nResults: ${passed} passed, ${failed} failed`)

  if (failed > 0) {
    console.log('\n[WARN] Fix errors before launching!')
    process.exit(1)
  }

  console.log('\n[OK] All checks passed! Ready to launch!')
}

void runChecks()
