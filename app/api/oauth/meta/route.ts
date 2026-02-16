import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'

export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const appId = process.env.META_APP_ID
    const appUrl = process.env.NEXT_PUBLIC_APP_URL

    if (!appId || !appUrl) {
      return NextResponse.json({ error: 'Meta OAuth not configured' }, { status: 500 })
    }

    const redirectUri = `${appUrl}/api/oauth/meta/callback`
    const scope = [
      'instagram_basic',
      'instagram_content_publish',
      'pages_read_engagement',
      'pages_manage_posts'
    ].join(',')

    const authUrl = new URL('https://www.facebook.com/v18.0/dialog/oauth')
    authUrl.searchParams.append('client_id', appId)
    authUrl.searchParams.append('redirect_uri', redirectUri)
    authUrl.searchParams.append('state', userId)
    authUrl.searchParams.append('response_type', 'code')
    authUrl.searchParams.append('scope', scope)

    return NextResponse.json({
      success: true,
      authUrl: authUrl.toString()
    })
  } catch (error) {
    console.error('Meta OAuth init error:', error)
    return NextResponse.json({ error: 'Failed to initialize Meta OAuth' }, { status: 500 })
  }
}
