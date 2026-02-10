import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'

// YouTube OAuth 2.0 Configuration
const YOUTUBE_CLIENT_ID = process.env.YOUTUBE_CLIENT_ID!
const YOUTUBE_REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL}/api/oauth/youtube/callback`

// YouTube OAuth scopes for video uploading
const SCOPES = [
  'https://www.googleapis.com/auth/youtube.upload',
  'https://www.googleapis.com/auth/youtube.readonly',
  'https://www.googleapis.com/auth/userinfo.profile'
].join(' ')

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

    // 3. Build Google/YouTube authorization URL
    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
    authUrl.searchParams.set('client_id', YOUTUBE_CLIENT_ID)
    authUrl.searchParams.set('redirect_uri', YOUTUBE_REDIRECT_URI)
    authUrl.searchParams.set('response_type', 'code')
    authUrl.searchParams.set('scope', SCOPES)
    authUrl.searchParams.set('state', state)
    authUrl.searchParams.set('access_type', 'offline') // Get refresh token
    authUrl.searchParams.set('prompt', 'consent') // Force consent to get refresh token

    console.log('YouTube OAuth initiated for user:', userId)

    return NextResponse.json({
      success: true,
      authUrl: authUrl.toString()
    })

  } catch (error) {
    console.error('YouTube OAuth initiation error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to initiate YouTube OAuth'
    }, { status: 500 })
  }
}
