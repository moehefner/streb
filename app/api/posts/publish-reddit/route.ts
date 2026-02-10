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
    const { content, imageUrl, subreddit } = body

    // 3. Validate inputs
    if (!content || typeof content !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Content is required' },
        { status: 400 }
      )
    }

    // Reddit titles max 300 characters
    if (content.length > 300) {
      return NextResponse.json(
        {
          success: false,
          error: `Reddit title exceeds 300 characters (${content.length} characters)`
        },
        { status: 400 }
      )
    }

    const targetSubreddit = subreddit || 'SideProject'

    console.log('Posting to Reddit:', { userId, subreddit: targetSubreddit, contentLength: content.length, hasImage: !!imageUrl })

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

    const dbUserId = userData.id

    // 5. Get Reddit OAuth tokens from database
    type AccountRow = {
      access_token: string
      refresh_token: string | null
      token_expires_at: string | null
      account_username: string | null
    }
    const { data: accountData, error: accountError } = await supabaseAdmin
      .from('connected_accounts')
      .select('access_token, refresh_token, token_expires_at, account_username')
      .eq('user_id', dbUserId)
      .eq('platform', 'reddit')
      .eq('is_active', true)
      .single<AccountRow>()

    if (accountError || !accountData) {
      console.error('Reddit account not found:', accountError)
      return NextResponse.json(
        {
          success: false,
          error: 'Reddit account not connected. Please connect your Reddit account in Settings.'
        },
        { status: 400 }
      )
    }

    if (!accountData.access_token) {
      return NextResponse.json(
        { success: false, error: 'Reddit token missing. Please reconnect in Settings.' },
        { status: 400 }
      )
    }

    // 6. Check if token is expired
    // Reddit access tokens expire (typically 1 hr). A permanent refresh_token is stored
    // and can be used to obtain new access tokens when this fires.
    const tokenExpiresAt = accountData.token_expires_at
      ? new Date(accountData.token_expires_at)
      : null
    const now = new Date()

    if (tokenExpiresAt && tokenExpiresAt <= now) {
      console.warn('Reddit token expired, needs refresh')
      return NextResponse.json(
        {
          success: false,
          error: 'Reddit token expired. Please reconnect your Reddit account in Settings.'
        },
        { status: 401 }
      )
    }

    const accessToken = accountData.access_token

    // 7. Build and submit Reddit post
    // Reddit uses form-encoded body. kind='self' for text posts, kind='link' for image/URL posts.
    const postParams = new URLSearchParams()
    postParams.append('sr', targetSubreddit)
    postParams.append('kind', imageUrl ? 'link' : 'self')
    postParams.append('title', content)
    postParams.append('resubmit', 'true') // Allow reposting same URL
    postParams.append('nsfw', 'false')
    postParams.append('spoiler', 'false')

    if (imageUrl) {
      postParams.append('url', imageUrl)
    } else {
      postParams.append('text', content)
    }

    console.log('Posting to r/' + targetSubreddit)

    const redditResponse = await fetch('https://oauth.reddit.com/api/submit', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Streb/1.0' // Reddit requires User-Agent on all requests
      },
      body: postParams.toString()
    })

    if (!redditResponse.ok) {
      const errorData = (await redditResponse.json()) as { message?: string; errors?: string[][] }
      console.error('Reddit API error:', errorData)

      return NextResponse.json(
        {
          success: false,
          error: `Reddit API error: ${errorData.message || 'Unknown error'}`,
          redditError: errorData
        },
        { status: redditResponse.status }
      )
    }

    const redditData = (await redditResponse.json()) as {
      json: {
        errors?: string[][]
        data?: { url?: string; id?: string }
      }
    }

    // Reddit can return HTTP 200 but include errors in the response body
    if (redditData.json?.errors && redditData.json.errors.length > 0) {
      const errorMsg = redditData.json.errors[0][1] || 'Unknown Reddit error'
      console.error('Reddit post error:', redditData.json.errors)
      return NextResponse.json(
        {
          success: false,
          error: `Reddit error: ${errorMsg}`,
          redditError: redditData.json.errors
        },
        { status: 400 }
      )
    }

    const postUrl = redditData.json?.data?.url
    const postId = redditData.json?.data?.id

    if (!postId) {
      console.error('Reddit response missing post data:', redditData)
      return NextResponse.json(
        { success: false, error: 'Invalid response from Reddit' },
        { status: 500 }
      )
    }

    console.log('Reddit post created successfully:', postUrl)

    // 8. Return success with post URL
    return NextResponse.json({
      success: true,
      platform: 'reddit',
      postId: postId,
      postUrl: postUrl,
      subreddit: targetSubreddit,
      username: accountData.account_username ?? undefined
    })
  } catch (error) {
    console.error('Reddit posting error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to post to Reddit'
      },
      { status: 500 }
    )
  }
}
