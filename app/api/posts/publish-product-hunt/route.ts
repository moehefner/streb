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
    const { content } = body

    // 3. Validate inputs
    if (!content || typeof content !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Content is required' },
        { status: 400 }
      )
    }

    console.log('Posting to Product Hunt:', { userId, contentLength: content.length })

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

    // 5. Get Product Hunt OAuth token from database
    type AccountRow = {
      access_token: string
      account_username: string | null
    }
    const { data: accountData, error: accountError } = await supabaseAdmin
      .from('connected_accounts')
      .select('access_token, account_username')
      .eq('user_id', dbUserId)
      .eq('platform', 'product_hunt')
      .eq('is_active', true)
      .single<AccountRow>()

    if (accountError || !accountData) {
      console.error('Product Hunt account not found:', accountError)
      return NextResponse.json(
        {
          success: false,
          error: 'Product Hunt account not connected. Please connect your Product Hunt account in Settings.'
        },
        { status: 400 }
      )
    }

    if (!accountData.access_token) {
      return NextResponse.json(
        { success: false, error: 'Product Hunt token missing. Please reconnect in Settings.' },
        { status: 400 }
      )
    }

    // 6. Submit comment via Product Hunt GraphQL API
    // NOTE: subject_id is a placeholder — replace with the target product's ID
    // when implementing product-specific launches. The daily discussion endpoint
    // requires the actual discussion post ID retrieved via a prior query.
    const mutation = `
      mutation($body: String!) {
        createComment(input: { body: $body, subject_id: "DAILY_DISCUSSION_ID" }) {
          comment {
            id
            url
          }
        }
      }
    `

    console.log('Posting to Product Hunt GraphQL API')

    const phResponse = await fetch('https://api.producthunt.com/v2/api/graphql', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accountData.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query: mutation,
        variables: { body: content }
      })
    })

    // 7. Handle response — GraphQL returns HTTP 200 even on errors;
    //    check both HTTP status and response body for errors.
    if (!phResponse.ok) {
      const errorText = await phResponse.text()
      console.error('Product Hunt API HTTP error:', errorText)
      return NextResponse.json(
        {
          success: false,
          error: `Product Hunt API error (HTTP ${phResponse.status})`
        },
        { status: phResponse.status }
      )
    }

    const phData = (await phResponse.json()) as {
      data?: { createComment?: { comment?: { id: string; url: string } } }
      errors?: { message: string }[]
    }

    if (phData.errors && phData.errors.length > 0) {
      console.error('Product Hunt GraphQL errors:', phData.errors)
      return NextResponse.json(
        {
          success: false,
          error: `Product Hunt API error: ${phData.errors[0].message}`
        },
        { status: 400 }
      )
    }

    const comment = phData.data?.createComment?.comment

    if (!comment) {
      console.error('Product Hunt response missing comment data:', phData)
      return NextResponse.json(
        { success: false, error: 'Invalid response from Product Hunt' },
        { status: 500 }
      )
    }

    console.log('Product Hunt comment created successfully:', comment.url)

    // 8. Return success with post URL
    return NextResponse.json({
      success: true,
      platform: 'product_hunt',
      postId: comment.id,
      postUrl: comment.url,
      username: accountData.account_username ?? undefined
    })
  } catch (error) {
    console.error('Product Hunt posting error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to post to Product Hunt'
      },
      { status: 500 }
    )
  }
}
