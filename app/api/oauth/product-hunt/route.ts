import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'

export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Product Hunt OAuth 2.0 authorization URL
    const clientId = process.env.PRODUCT_HUNT_CLIENT_ID!
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/oauth/product-hunt/callback`
    const state = userId // Use userId as state for security

    // Product Hunt scopes (space-separated)
    const scope = 'public private'

    // Build authorization URL
    const authUrl = new URL('https://api.producthunt.com/v2/oauth/authorize')
    authUrl.searchParams.append('client_id', clientId)
    authUrl.searchParams.append('redirect_uri', redirectUri)
    authUrl.searchParams.append('response_type', 'code')
    authUrl.searchParams.append('scope', scope)
    authUrl.searchParams.append('state', state)

    // Return authorization URL
    return NextResponse.json({
      success: true,
      authUrl: authUrl.toString()
    })

  } catch (error) {
    console.error('Product Hunt OAuth init error:', error)
    return NextResponse.json(
      { error: 'Failed to initialize Product Hunt OAuth' },
      { status: 500 }
    )
  }
}
