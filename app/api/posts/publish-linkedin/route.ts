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

    // LinkedIn character limit is 3000
    if (content.length > 3000) {
      return NextResponse.json(
        {
          success: false,
          error: `LinkedIn content exceeds 3000 characters (${content.length} characters)`
        },
        { status: 400 }
      )
    }

    console.log('Posting to LinkedIn:', { userId, contentLength: content.length, hasImage: !!imageUrl })

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

    // 5. Get LinkedIn OAuth tokens from database
    type AccountRow = {
      access_token: string
      token_expires_at: string | null
      platform_user_id: string | null
      account_username: string | null
    }
    const { data: accountData, error: accountError } = await supabaseAdmin
      .from('connected_accounts')
      .select('access_token, token_expires_at, platform_user_id, account_username')
      .eq('user_id', dbUserId)
      .eq('platform', 'linkedin')
      .eq('is_active', true)
      .single<AccountRow>()

    if (accountError || !accountData) {
      console.error('LinkedIn account not found:', accountError)
      return NextResponse.json(
        {
          success: false,
          error: 'LinkedIn account not connected. Please connect your LinkedIn account in Settings.'
        },
        { status: 400 }
      )
    }

    if (!accountData.access_token) {
      return NextResponse.json(
        { success: false, error: 'LinkedIn token missing. Please reconnect in Settings.' },
        { status: 400 }
      )
    }

    if (!accountData.platform_user_id) {
      return NextResponse.json(
        { success: false, error: 'LinkedIn user ID missing. Please reconnect in Settings.' },
        { status: 400 }
      )
    }

    // 6. Check if token is expired
    // LinkedIn tokens last ~60 days and cannot be refreshed — user must reconnect
    const tokenExpiresAt = accountData.token_expires_at
      ? new Date(accountData.token_expires_at)
      : null
    const now = new Date()

    if (tokenExpiresAt && tokenExpiresAt <= now) {
      console.warn('LinkedIn token expired, needs reconnection')
      return NextResponse.json(
        {
          success: false,
          error: 'LinkedIn token expired. Please reconnect your LinkedIn account in Settings.'
        },
        { status: 401 }
      )
    }

    const accessToken = accountData.access_token

    // 7. Build LinkedIn UGC post payload
    // Image upload via LinkedIn requires a multi-step media upload flow;
    // posting text-only for now. TODO: implement image upload when needed.
    if (imageUrl) {
      console.log('LinkedIn image upload not yet implemented, posting text only')
    }

    const postPayload = {
      author: `urn:li:person:${accountData.platform_user_id}`,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: {
            text: content
          },
          shareMediaCategory: 'NONE'
        }
      },
      visibility: {
        'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC'
      }
    }

    console.log('Posting to LinkedIn UGC API')

    // 8. Submit post to LinkedIn UGC Posts endpoint
    const linkedinResponse = await fetch('https://api.linkedin.com/v2/ugcPosts', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0'
      },
      body: JSON.stringify(postPayload)
    })

    if (!linkedinResponse.ok) {
      const errorData = (await linkedinResponse.json()) as { message?: string; status?: number }
      console.error('LinkedIn API error:', errorData)

      return NextResponse.json(
        {
          success: false,
          error: `LinkedIn API error: ${errorData.message || 'Unknown error'}`,
          linkedinError: errorData
        },
        { status: linkedinResponse.status }
      )
    }

    // LinkedIn UGC Posts returns 201 Created. The post URN is in the Location header.
    // Fall back to parsing the response body if available.
    const locationHeader = linkedinResponse.headers.get('Location') || ''
    let postId: string | null = null

    if (locationHeader.includes('/ugcPosts/')) {
      postId = decodeURIComponent(locationHeader.split('/ugcPosts/')[1])
    } else {
      // Some responses include the resource in the body
      try {
        const linkedinData = (await linkedinResponse.json()) as { id?: string }
        postId = linkedinData.id || null
      } catch {
        // 201 with empty body is valid — postId stays null
      }
    }

    if (!postId) {
      console.error('LinkedIn response missing post ID. Location:', locationHeader)
      return NextResponse.json(
        { success: false, error: 'Invalid response from LinkedIn' },
        { status: 500 }
      )
    }

    // LinkedIn doesn't expose direct post URLs via API; construct the feed update URL
    const postUrl = `https://www.linkedin.com/feed/update/${postId}`

    console.log('LinkedIn post created successfully:', postUrl)

    // 9. Return success with post URL
    return NextResponse.json({
      success: true,
      platform: 'linkedin',
      postId: postId,
      postUrl: postUrl,
      username: accountData.account_username ?? undefined
    })
  } catch (error) {
    console.error('LinkedIn posting error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to post to LinkedIn'
      },
      { status: 500 }
    )
  }
}
