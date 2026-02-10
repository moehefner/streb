import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate user
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // 2. Parse request body
    const body = await req.json()
    const { content, imageUrl } = body

    // 3. Validate inputs
    if (!content || typeof content !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Content is required' },
        { status: 400 }
      )
    }

    console.log('Posting to Facebook:', { userId, contentLength: content.length })

    // 4. Get user's database ID
    type UserRow = { id: string }
    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('clerk_user_id', userId)
      .single<UserRow>()

    if (userError || !userData) {
      console.error('User lookup error:', userError)
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      )
    }

    // 5. Get Facebook OAuth token from database
    type AccountRow = {
      access_token: string
      token_expires_at: string | null
      platform_user_id: string
      account_username: string | null
    }
    const { data: accountData, error: accountError } = await supabaseAdmin
      .from('connected_accounts')
      .select('access_token, token_expires_at, platform_user_id, account_username')
      .eq('user_id', userData.id)
      .eq('platform', 'facebook')
      .eq('is_active', true)
      .single<AccountRow>()

    if (accountError || !accountData) {
      console.error('Facebook account not found:', accountError)
      return NextResponse.json(
        {
          success: false,
          error: 'Facebook account not connected. Please connect your Facebook account in Settings.'
        },
        { status: 400 }
      )
    }

    if (!accountData.access_token) {
      return NextResponse.json(
        { success: false, error: 'Facebook token missing. Please reconnect in Settings.' },
        { status: 400 }
      )
    }

    // 6. Check token expiration (long-lived tokens expire after ~60 days)
    if (accountData.token_expires_at) {
      const tokenExpiresAt = new Date(accountData.token_expires_at)
      if (tokenExpiresAt <= new Date()) {
        return NextResponse.json(
          { success: false, error: 'Facebook token expired. Please reconnect in Settings.' },
          { status: 401 }
        )
      }
    }

    // 7. Post to Facebook timeline via Graph API
    // Note: Posts to user's personal timeline. Page posting requires PAGE_ID/feed endpoint.
    const postParams = new URLSearchParams({
      message: content,
      access_token: accountData.access_token
    })

    if (imageUrl) {
      postParams.append('link', imageUrl) // Facebook generates link preview from URL
    }

    console.log('Posting to Facebook Graph API')

    const fbResponse = await fetch(
      `https://graph.facebook.com/v18.0/${accountData.platform_user_id}/feed`,
      {
        method: 'POST',
        body: postParams
      }
    )

    // 8. Handle response
    if (!fbResponse.ok) {
      const errorData = await fbResponse.json()
      console.error('Facebook API error:', errorData)
      return NextResponse.json(
        {
          success: false,
          error: `Facebook API error: ${errorData.error?.message || 'Unknown error'}`
        },
        { status: fbResponse.status }
      )
    }

    const fbData = await fbResponse.json()
    const postId = fbData.id as string

    // Construct post URL (Facebook post IDs are USER_ID_POST_ID format)
    const postUrl = `https://www.facebook.com/${postId.replace('_', '/posts/')}`

    console.log('Facebook post created successfully:', postUrl)

    // 9. Return success
    return NextResponse.json({
      success: true,
      platform: 'facebook',
      postId,
      postUrl,
      username: accountData.account_username ?? undefined
    })
  } catch (error) {
    console.error('Facebook posting error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to post to Facebook'
      },
      { status: 500 }
    )
  }
}
