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

    // 3. Validate inputs — Instagram requires an image
    if (!imageUrl) {
      return NextResponse.json(
        {
          success: false,
          error: 'Instagram requires an image. Please use the "Text + AI-Generated Image" option.'
        },
        { status: 400 }
      )
    }

    if (content && content.length > 2200) {
      return NextResponse.json(
        { success: false, error: `Instagram caption exceeds 2200 characters (${content.length} characters)` },
        { status: 400 }
      )
    }

    console.log('Posting to Instagram:', { userId, hasImage: !!imageUrl, captionLength: content?.length ?? 0 })

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

    // 5. Get Instagram OAuth token from database
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
      .eq('platform', 'instagram')
      .eq('is_active', true)
      .single<AccountRow>()

    if (accountError || !accountData) {
      console.error('Instagram account not found:', accountError)
      return NextResponse.json(
        {
          success: false,
          error: 'Instagram account not connected. Please connect your Instagram account in Settings.'
        },
        { status: 400 }
      )
    }

    if (!accountData.access_token) {
      return NextResponse.json(
        { success: false, error: 'Instagram token missing. Please reconnect in Settings.' },
        { status: 400 }
      )
    }

    // 6. Check token expiration (long-lived tokens expire after ~60 days)
    if (accountData.token_expires_at) {
      const tokenExpiresAt = new Date(accountData.token_expires_at)
      if (tokenExpiresAt <= new Date()) {
        return NextResponse.json(
          { success: false, error: 'Instagram token expired. Please reconnect in Settings.' },
          { status: 401 }
        )
      }
    }

    // 7. Two-step publish: create media container, then publish it
    // Step 7a: Create media container
    console.log('Creating Instagram media container')

    const containerResponse = await fetch(
      `https://graph.instagram.com/v18.0/${accountData.platform_user_id}/media`,
      {
        method: 'POST',
        body: new URLSearchParams({
          image_url: imageUrl,
          caption: content || '',
          access_token: accountData.access_token
        })
      }
    )

    if (!containerResponse.ok) {
      const errorData = await containerResponse.json()
      console.error('Instagram container creation error:', errorData)
      return NextResponse.json(
        {
          success: false,
          error: `Instagram API error: ${errorData.error?.message || 'Failed to create media container'}`
        },
        { status: containerResponse.status }
      )
    }

    const containerData = await containerResponse.json()
    const creationId = containerData.id

    // Step 7b: Publish the media container
    console.log('Publishing Instagram media container:', creationId)

    const publishResponse = await fetch(
      `https://graph.instagram.com/v18.0/${accountData.platform_user_id}/media_publish`,
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
      console.error('Instagram publish error:', errorData)
      return NextResponse.json(
        {
          success: false,
          error: `Instagram publish error: ${errorData.error?.message || 'Failed to publish'}`
        },
        { status: publishResponse.status }
      )
    }

    const publishData = await publishResponse.json()
    const postId = publishData.id

    // 8. Fetch permalink for accurate post URL
    // Instagram media IDs are numeric — permalink must be queried separately
    let postUrl = `https://www.instagram.com/${accountData.account_username}/`

    const permalinkResponse = await fetch(
      `https://graph.instagram.com/v18.0/${postId}?fields=permalink`,
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

    console.log('Instagram post created successfully:', postUrl)

    // 9. Return success
    return NextResponse.json({
      success: true,
      platform: 'instagram',
      postId,
      postUrl,
      username: accountData.account_username ?? undefined
    })
  } catch (error) {
    console.error('Instagram posting error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to post to Instagram'
      },
      { status: 500 }
    )
  }
}
