import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

async function checkDatabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRole) {
    return { status: 'missing_config' }
  }

  try {
    const supabase = createClient(supabaseUrl, serviceRole)
    const { error } = await supabase.from('users').select('id').limit(1)
    if (error) {
      return { status: 'error', message: error.message }
    }
    return { status: 'ok' }
  } catch (error) {
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'Database check failed'
    }
  }
}

async function checkStripe() {
  const secretKey = process.env.STRIPE_SECRET_KEY
  if (!secretKey) {
    return { status: 'missing_config' }
  }

  try {
    const stripe = new Stripe(secretKey, { apiVersion: '2026-01-28.clover' })
    await stripe.balance.retrieve()
    return { status: 'ok' }
  } catch (error) {
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'Stripe check failed'
    }
  }
}

async function checkAI() {
  const anthropic = !!process.env.ANTHROPIC_API_KEY
  const openai = !!process.env.OPENAI_API_KEY

  if (anthropic && openai) {
    return { status: 'ok' }
  }

  return {
    status: 'missing_config',
    anthropic,
    openai
  }
}

export async function GET() {
  const [database, stripe, ai] = await Promise.all([
    checkDatabase(),
    checkStripe(),
    checkAI()
  ])

  const allOk = [database.status, stripe.status, ai.status].every((status) => status === 'ok')

  return NextResponse.json({
    status: allOk ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    services: {
      database,
      stripe,
      ai
    }
  })
}
