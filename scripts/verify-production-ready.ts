import { execSync } from 'child_process'
import { existsSync, readFileSync } from 'fs'
import { createClient } from '@supabase/supabase-js'

type CheckResult = boolean | string

const checks: Array<{ name: string; check: () => Promise<CheckResult> }> = []

function loadEnvFile(filePath: string) {
  if (!existsSync(filePath)) return

  const raw = readFileSync(filePath, 'utf8')
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    const idx = trimmed.indexOf('=')
    if (idx === -1) continue

    const key = trimmed.slice(0, idx).trim()
    let value = trimmed.slice(idx + 1).trim()

    // Strip surrounding quotes.
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }

    if (!process.env[key]) {
      process.env[key] = value
    }
  }
}

// Load local env for CLI usage (won't override existing env).
loadEnvFile('.env.local')
loadEnvFile('.env')

// Build checks
checks.push({
  name: 'TypeScript compiles',
  check: async () => {
    try {
      execSync('npx tsc --noEmit', { stdio: 'pipe' })
      return true
    } catch {
      return 'Type errors found'
    }
  }
})

checks.push({
  name: 'ESLint passes',
  check: async () => {
    try {
      execSync('npx eslint . --max-warnings 0', { stdio: 'pipe' })
      return true
    } catch {
      return 'Lint errors found'
    }
  }
})

checks.push({
  name: 'Next.js builds',
  check: async () => {
    try {
      execSync('npm run build', { stdio: 'pipe' })
      return true
    } catch {
      return 'Build failed'
    }
  }
})

// Env var checks
const requiredEnvVars = [
  'NEXT_PUBLIC_APP_URL',
  'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY',
  'CLERK_SECRET_KEY',
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'CRON_SECRET',
  'N8N_WEBHOOK_SECRET',
  'ANTHROPIC_API_KEY',
  'OPENAI_API_KEY',
  'STRIPE_SECRET_KEY',
  'RESEND_API_KEY',
  'APOLLO_API_KEY',
  'VERIFICATION_SECRET',
  'UNSUBSCRIBE_SECRET'
]

for (const envVar of requiredEnvVars) {
  checks.push({
    name: `Env var: ${envVar}`,
    check: async () => !!process.env[envVar]
  })
}

function getSupabaseAdminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

// Database checks
checks.push({
  name: 'Supabase connection',
  check: async () => {
    try {
      const supabase = getSupabaseAdminClient()
      const { error } = await supabase.from('users').select('id').limit(1)
      return !error || `Connection failed: ${error.message}`
    } catch {
      return 'Connection failed'
    }
  }
})

const requiredTables = ['users', 'autopilot_configs', 'autopilot_activity', 'connected_accounts', 'outreach_leads']

for (const table of requiredTables) {
  checks.push({
    name: `Table exists: ${table}`,
    check: async () => {
      try {
        const supabase = getSupabaseAdminClient()
        const { error } = await supabase.from(table).select('id').limit(1)
        return !error || error.message.includes('0 rows')
      } catch {
        return false
      }
    }
  })
}

// File checks
const requiredFiles = [
  'n8n-workflows/streb-autopilot-posting-simplified.json',
  'n8n-workflows/streb-autopilot-video-simplified.json',
  'n8n-workflows/streb-autopilot-outreach-simplified.json',
  'migrations/001_canonical_schema.sql'
]

for (const file of requiredFiles) {
  checks.push({
    name: `File exists: ${file}`,
    check: async () => existsSync(file)
  })
}

// Run all checks
async function main() {
  console.log('Running production readiness checks...\n')

  let passed = 0
  let failed = 0

  for (const check of checks) {
    const result = await check.check()

    if (result === true) {
      console.log(`PASS ${check.name}`)
      passed++
    } else {
      console.log(`FAIL ${check.name}${typeof result === 'string' ? `: ${result}` : ''}`)
      failed++
    }
  }

  console.log(`\nResults: ${passed} passed, ${failed} failed`)

  if (failed > 0) {
    console.log('\nFix errors before deploying!')
    process.exit(1)
  } else {
    console.log('\nAll checks passed! Ready for production.')
    process.exit(0)
  }
}

main()

