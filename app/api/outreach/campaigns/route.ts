import { NextResponse } from 'next/server'

/**
 * @deprecated This endpoint is deprecated as of Phase 4 cleanup.
 * Use POST /api/autopilot/actions/outreach instead.
 * This file remains for backward compatibility only.
 * Will be removed in future version.
 */
export async function POST() {
  console.warn('[DEPRECATED] This endpoint is deprecated. Use /api/autopilot/actions/outreach')

  return NextResponse.json(
    {
      deprecated: true,
      message: 'This endpoint is deprecated. Use /api/autopilot/actions/outreach',
      migration_guide: 'https://docs.streb.ai/migration'
    },
    { status: 410 }
  )
}

export async function GET() {
  console.warn('[DEPRECATED] This endpoint is deprecated. Use /api/autopilot/actions/outreach')

  return NextResponse.json(
    {
      deprecated: true,
      message: 'This endpoint is deprecated. Use /api/autopilot/actions/outreach',
      migration_guide: 'https://docs.streb.ai/migration'
    },
    { status: 410 }
  )
}
