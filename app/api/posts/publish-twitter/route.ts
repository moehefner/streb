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

    // Twitter character limit is 280
    if (content.length > 280) {
      return NextResponse.json(
        {
          success: false,
          error: `Twitter content exceeds 280 characters (${content.length} characters)`
        },
        { status: 400 }
      )
    }

    console.log('Posting to Twitter:', { userId, contentLength: content.length, hasImage: !!imageUrl })

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

    // 5. Get Twitter OAuth tokens from database
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
      .eq('platform', 'twitter')
      .eq('is_active', true)
      .single<AccountRow>()

    if (accountError || !accountData) {
      console.error('Twitter account not found:', accountError)
      return NextResponse.json(
        {
          success: false,
          error: 'Twitter account not connected. Please connect your Twitter account in Settings.'
        },
        { status: 400 }
      )
    }

    if (!accountData.access_token) {
      return NextResponse.json(
        { success: false, error: 'Twitter token missing. Please reconnect in Settings.' },
        { status: 400 }
      )
    }

    // 6. Check if token is expired (and refresh if needed - simplified for now)
    const tokenExpiresAt = accountData.token_expires_at
      ? new Date(accountData.token_expires_at)
      : null
    const now = new Date()

    if (tokenExpiresAt && tokenExpiresAt <= now) {
      console.warn('Token expired, needs refresh')
      return NextResponse.json(
        {
          success: false,
          error: 'Twitter token expired. Please reconnect your Twitter account in Settings.'
        },
        { status: 401 }
      )
    }

    const accessToken = accountData.access_token

    // 7. Upload image to Twitter if provided
    let mediaId: string | undefined

    if (imageUrl && typeof imageUrl === 'string') {
      console.log('Uploading image to Twitter:', imageUrl)

      try {
        const imageResponse = await fetch(imageUrl)
        if (!imageResponse.ok) {
          throw new Error('Failed to download image')
        }

        const imageBuffer = await imageResponse.arrayBuffer()
        const imageBase64 = Buffer.from(imageBuffer).toString('base64')

        // Twitter v1.1 media upload (OAuth 2.0 access token as Bearer)
        const mediaUploadResponse = await fetch(
          'https://upload.twitter.com/1.1/media/upload.json',
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({
              media_data: imageBase64
            })
          }
        )

        if (!mediaUploadResponse.ok) {
          const errorText = await mediaUploadResponse.text()
          console.error('Twitter media upload failed:', errorText)
          throw new Error('Failed to upload image to Twitter')
        }

        const mediaData = (await mediaUploadResponse.json()) as { media_id_string?: string }
        mediaId = mediaData.media_id_string

        if (mediaId) {
          console.log('Image uploaded to Twitter, media ID:', mediaId)
        }
      } catch (error) {
        console.error('Image upload error:', error)
        console.warn('Posting without image due to upload error')
      }
    }

    // 8. Create tweet using Twitter API v2
    type TweetPayload = {
      text: string
      media?: { media_ids: string[] }
    }
    const tweetPayload: TweetPayload = {
      text: content
    }

    if (mediaId) {
      tweetPayload.media = { media_ids: [mediaId] }
    }

    console.log('Creating tweet with payload:', JSON.stringify({ ...tweetPayload, text: `${tweetPayload.text.slice(0, 50)}...` }))

    const tweetResponse = await fetch('https://api.twitter.com/2/tweets', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(tweetPayload)
    })

    if (!tweetResponse.ok) {
      const errorData = (await tweetResponse.json()) as { detail?: string; title?: string }
      console.error('Twitter API error:', errorData)

      return NextResponse.json(
        {
          success: false,
          error: `Twitter API error: ${errorData.detail || errorData.title || 'Unknown error'}`,
          twitterError: errorData
        },
        { status: tweetResponse.status }
      )
    }

    const tweetData = (await tweetResponse.json()) as { data?: { id: string } }
    const tweetId = tweetData.data?.id
    if (!tweetId) {
      console.error('Twitter response missing tweet id:', tweetData)
      return NextResponse.json(
        { success: false, error: 'Invalid response from Twitter' },
        { status: 500 }
      )
    }

    const username = accountData.account_username || 'i'
    const tweetUrl = `https://twitter.com/${username}/status/${tweetId}`

    console.log('Tweet created successfully:', tweetUrl)

    // 9. Return success with tweet URL
    return NextResponse.json({
      success: true,
      platform: 'twitter',
      postId: tweetId,
      postUrl: tweetUrl,
      username: accountData.account_username ?? undefined
    })
  } catch (error) {
    console.error('Twitter posting error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to post to Twitter'
      },
      { status: 500 }
    )
  }
}
