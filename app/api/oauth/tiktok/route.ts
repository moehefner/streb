import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'

// TikTok OAuth 2.0 Configuration
const TIKTOK_CLIENT_KEY = process.env.TIKTOK_CLIENT_KEY!
const TIKTOK_REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL}/api/oauth/tiktok/callback`

// TikTok OAuth scopes for video posting
const SCOPES = [
  'user.info.basic',
  'video.upload',
  'video.publish'
].join(',')

export async function GET(req: NextRequest) {
  try {
    // 1. Authenticate user
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // 2. Generate CSRF state (includes userId for callback verification)
    const state = Buffer.from(JSON.stringify({
      userId,
      timestamp: Date.now(),
      nonce: Math.random().toString(36).substring(2)
    })).toString('base64')

    // 3. Build TikTok authorization URL
    const authUrl = new URL('https://www.tiktok.com/v2/auth/authorize/')
    authUrl.searchParams.set('client_key', TIKTOK_CLIENT_KEY)
    authUrl.searchParams.set('redirect_uri', TIKTOK_REDIRECT_URI)
    authUrl.searchParams.set('response_type', 'code')
    authUrl.searchParams.set('scope', SCOPES)
    authUrl.searchParams.set('state', state)

    console.log('TikTok OAuth initiated for user:', userId)

    return NextResponse.json({
      success: true,
      authUrl: authUrl.toString()
    })

  } catch (error) {
    console.error('TikTok OAuth initiation error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to initiate TikTok OAuth'
    }, { status: 500 })
  }
}
