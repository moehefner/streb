import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

type LogErrorBody = {
  context?: string
  error?: string
  metadata?: unknown
  timestamp?: string
}

function getClientIp(req: NextRequest): string | null {
  const forwardedFor = req.headers.get('x-forwarded-for')
  if (!forwardedFor) {
    return null
  }

  const firstIp = forwardedFor.split(',')[0]?.trim()
  return firstIp || null
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as LogErrorBody
    const context = typeof body.context === 'string' ? body.context.trim() : ''
    const errorMessage = typeof body.error === 'string' ? body.error.trim() : ''
    const timestamp =
      typeof body.timestamp === 'string' && !Number.isNaN(Date.parse(body.timestamp))
        ? new Date(body.timestamp).toISOString()
        : new Date().toISOString()

    if (!context || !errorMessage) {
      return NextResponse.json(
        {
          success: false,
          error: 'context and error are required'
        },
        { status: 400 }
      )
    }

    const { error } = await supabase.from('error_logs').insert({
      context,
      error_message: errorMessage,
      metadata: body.metadata ?? null,
      timestamp,
      user_agent: req.headers.get('user-agent'),
      ip_address: getClientIp(req)
    })

    if (error) {
      console.error('[Log Error API] Failed to insert error log', error)
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to store error log'
        },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Log Error API] Unexpected error', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to log error'
      },
      { status: 500 }
    )
  }
}

