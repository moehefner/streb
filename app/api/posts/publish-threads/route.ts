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

    // 3. Validate inputs — Threads supports text-only or text + image
    if (!content || content.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Threads requires text content.' },
        { status: 400 }
      )
    }

    if (content.length > 500) {
      return NextResponse.json(
        { success: false, error: `Threads text exceeds 500 characters (${content.length} characters)` },
        { status: 400 }
      )
    }

    console.log('Posting to Threads:', { userId, hasImage: !!imageUrl, contentLength: content.length })

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

    // 5. Get Threads OAuth token from database
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
      .eq('platform', 'threads')
      .eq('is_active', true)
      .single<AccountRow>()

    if (accountError || !accountData) {
      console.error('Threads account not found:', accountError)
      return NextResponse.json(
        {
          success: false,
          error: 'Threads account not connected. Please connect your Threads account in Settings.'
        },
        { status: 400 }
      )
    }

    if (!accountData.access_token) {
      return NextResponse.json(
        { success: false, error: 'Threads token missing. Please reconnect in Settings.' },
        { status: 400 }
      )
    }

    // 6. Check token expiration (long-lived tokens expire after ~60 days)
    if (accountData.token_expires_at) {
      const tokenExpiresAt = new Date(accountData.token_expires_at)
      if (tokenExpiresAt <= new Date()) {
        return NextResponse.json(
          { success: false, error: 'Threads token expired. Please reconnect in Settings.' },
          { status: 401 }
        )
      }
    }

    // 7. Two-step publish: create thread container, then publish it
    // Step 7a: Create thread container
    // Threads uses 'text' param (NOT 'caption' like Instagram)
    console.log('Creating Threads media container')

    const containerParams = new URLSearchParams({
      text: content,
      access_token: accountData.access_token
    })

    if (imageUrl) {
      containerParams.append('image_url', imageUrl)
    }

    const containerResponse = await fetch(
      `https://graph.threads.net/v1.0/${accountData.platform_user_id}/threads`,
      {
        method: 'POST',
        body: containerParams
      }
    )

    if (!containerResponse.ok) {
      const errorData = await containerResponse.json()
      console.error('Threads container creation error:', errorData)
      return NextResponse.json(
        {
          success: false,
          error: `Threads API error: ${errorData.error?.message || 'Failed to create thread container'}`
        },
        { status: containerResponse.status }
      )
    }

    const containerData = await containerResponse.json()
    const creationId = containerData.id

    // Step 7b: Publish the thread container
    console.log('Publishing Threads container:', creationId)

    const publishResponse = await fetch(
      `https://graph.threads.net/v1.0/${accountData.platform_user_id}/threads_publish`,
      {
        method: 'POST',
        body: new URLSearchParams({
          creation_id: creationId,
          access_token: accountData.access_token
        })
      }
    )

    if (!publishResponse.ok) {
      const errorData = await publishResponse.json()
      console.error('Threads publish error:', errorData)
      return NextResponse.json(
        {
          success: false,
          error: `Threads publish error: ${errorData.error?.message || 'Failed to publish thread'}`
        },
        { status: publishResponse.status }
      )
    }

    const publishData = await publishResponse.json()
    const postId = publishData.id

    // 8. Fetch permalink for accurate post URL
    let postUrl = `https://www.threads.net/@${accountData.account_username}/`

    const permalinkResponse = await fetch(
      `https://graph.threads.net/v1.0/${postId}?fields=permalink`,
      {
        headers: {
          'Authorization': `Bearer ${accountData.access_token}`
        }
      }
    )

    if (permalinkResponse.ok) {
      const permalinkData = await permalinkResponse.json()
      if (permalinkData.permalink) {
        postUrl = permalinkData.permalink
      }
    }

    console.log('Threads post created successfully:', postUrl)

    // 9. Return success
    return NextResponse.json({
      success: true,
      platform: 'threads',
      postId,
      postUrl,
      username: accountData.account_username ?? undefined
    })
  } catch (error) {
    console.error('Threads posting error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to post to Threads'
      },
      { status: 500 }
    )
  }
}
