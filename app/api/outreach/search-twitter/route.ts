import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabaseAdmin } from '@/lib/supabase'

// Type definitions
type UserRow = {
  id: string
  emails_used: number
  emails_limit: number
  plan_type: string
}

type TwitterUser = {
  id: string
  username: string
  name: string
  description?: string
  profile_image_url?: string
  verified?: boolean
  public_metrics?: {
    followers_count: number
    following_count: number
    tweet_count: number
  }
}

type TwitterTweet = {
  id: string
  text: string
  author_id: string
  created_at: string
  public_metrics?: {
    like_count: number
    retweet_count: number
    reply_count: number
  }
}

type TwitterSearchResponse = {
  data?: TwitterTweet[]
  includes?: {
    users?: TwitterUser[]
  }
  meta?: {
    result_count: number
    next_token?: string
  }
  errors?: Array<{ detail: string; title: string }>
}

type Lead = {
  id: string
  platform: string
  handle: string
  name: string
  bio: string
  followerCount: number
  verified: boolean
  profileUrl: string
  avatarUrl: string | null
  tweet: string
  tweetUrl: string
  tweetedAt: string
}

export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // 2. Parse request
    const body = await req.json()
    const {
      keywords,
      minFollowers = 100,
      maxFollowers = 100000,
      verifiedOnly = false,
      language = 'en',
      maxResults = 50
    } = body as {
      keywords: string
      minFollowers?: number
      maxFollowers?: number
      verifiedOnly?: boolean
      language?: string
      maxResults?: number
    }

    if (!keywords || keywords.trim().length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Keywords are required'
      }, { status: 400 })
    }

    console.log('Searching Twitter for:', keywords)

    // 3. Get user from database
    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .select('id, emails_used, emails_limit, plan_type')
      .eq('clerk_user_id', userId)
      .single<UserRow>()

    if (userError || !userData) {
      console.error('User lookup error:', userError)
      return NextResponse.json({
        success: false,
        error: 'User not found'
      }, { status: 404 })
    }

    // 4. Check limits - DON'T deduct yet (only deduct when actually sending)
    // But warn if they're searching for more leads than they can send
    const remaining = userData.emails_limit - userData.emails_used

    if (remaining <= 0) {
      return NextResponse.json({
        success: false,
        error: `You've reached your outreach limit of ${userData.emails_limit} messages this month.`,
        upgradeRequired: true,
        currentPlan: userData.plan_type,
        outreachUsed: userData.emails_used,
        outreachLimit: userData.emails_limit
      }, { status: 403 })
    }

    // Warn if searching for more than remaining
    if (maxResults > remaining) {
      console.warn(`User requested ${maxResults} leads but only has ${remaining} outreach remaining`)
    }

    // 5. Check for Twitter Bearer Token
    if (!process.env.TWITTER_BEARER_TOKEN) {
      console.error('TWITTER_BEARER_TOKEN not configured')
      return NextResponse.json({
        success: false,
        error: 'Twitter API not configured. Please contact support.'
      }, { status: 500 })
    }

    // 6. Build Twitter search query
    // Twitter query syntax: keywords -is:retweet -is:reply lang:en
    let query = keywords.trim()
    query += ' -is:retweet -is:reply' // Exclude retweets and replies
    if (language) {
      query += ` lang:${language}`
    }

    // 7. Search Twitter using Twitter API v2
    const searchUrl = new URL('https://api.twitter.com/2/tweets/search/recent')
    searchUrl.searchParams.set('query', query)
    searchUrl.searchParams.set('max_results', String(Math.min(maxResults, 100)))
    searchUrl.searchParams.set('tweet.fields', 'author_id,created_at,public_metrics')
    searchUrl.searchParams.set('expansions', 'author_id')
    searchUrl.searchParams.set('user.fields', 'username,name,description,public_metrics,verified,profile_image_url')

    const twitterResponse = await fetch(searchUrl.toString(), {
      headers: {
        'Authorization': `Bearer ${process.env.TWITTER_BEARER_TOKEN}`
      }
    })

    if (!twitterResponse.ok) {
      const errorData = await twitterResponse.json().catch(() => ({}))
      console.error('Twitter API error:', twitterResponse.status, errorData)

      if (twitterResponse.status === 429) {
        return NextResponse.json({
          success: false,
          error: 'Twitter rate limit exceeded. Please try again in 15 minutes.',
          retryAfter: 900 // 15 minutes in seconds
        }, { status: 429 })
      }

      if (twitterResponse.status === 401) {
        return NextResponse.json({
          success: false,
          error: 'Twitter API authentication failed. Please contact support.'
        }, { status: 500 })
      }

      return NextResponse.json({
        success: false,
        error: `Twitter API error: ${errorData.detail || errorData.title || 'Unknown error'}`
      }, { status: twitterResponse.status })
    }

    const twitterData: TwitterSearchResponse = await twitterResponse.json()

    // 8. Handle no results
    if (!twitterData.data || twitterData.data.length === 0) {
      return NextResponse.json({
        success: true,
        leads: [],
        count: 0,
        query: query,
        message: 'No tweets found matching your criteria. Try different keywords.',
        userLimits: {
          outreachUsed: userData.emails_used,
          outreachLimit: userData.emails_limit,
          remaining: remaining,
          planType: userData.plan_type
        }
      })
    }

    // 9. Process results
    // Twitter returns tweets + user data separately
    const tweets = twitterData.data
    const users = twitterData.includes?.users || []

    // Create a map of user_id -> user data
    const userMap = new Map<string, TwitterUser>()
    users.forEach((user) => {
      userMap.set(user.id, user)
    })

    // 10. Filter and format leads
    const leads: Lead[] = []
    const seenUsers = new Set<string>() // Deduplicate users

    for (const tweet of tweets) {
      const user = userMap.get(tweet.author_id)

      if (!user || seenUsers.has(user.id)) {
        continue // Skip if no user data or already added
      }

      // Apply filters
      const followerCount = user.public_metrics?.followers_count || 0

      if (followerCount < minFollowers || followerCount > maxFollowers) {
        continue
      }

      if (verifiedOnly && !user.verified) {
        continue
      }

      // Format lead
      leads.push({
        id: user.id,
        platform: 'twitter',
        handle: user.username,
        name: user.name,
        bio: user.description || '',
        followerCount: followerCount,
        verified: user.verified || false,
        profileUrl: `https://twitter.com/${user.username}`,
        avatarUrl: user.profile_image_url || null,
        tweet: tweet.text,
        tweetUrl: `https://twitter.com/${user.username}/status/${tweet.id}`,
        tweetedAt: tweet.created_at
      })

      seenUsers.add(user.id)

      // Stop if we have enough leads
      if (leads.length >= maxResults) {
        break
      }
    }

    console.log(`Found ${leads.length} leads on Twitter for user ${userData.id}`)

    // 11. Return leads with user's remaining outreach
    return NextResponse.json({
      success: true,
      leads: leads,
      count: leads.length,
      query: query,
      totalTweetsSearched: tweets.length,
      userLimits: {
        outreachUsed: userData.emails_used,
        outreachLimit: userData.emails_limit,
        remaining: remaining,
        planType: userData.plan_type
      }
    })

  } catch (error) {
    console.error('Twitter search error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to search Twitter'
    }, { status: 500 })
  }
}
