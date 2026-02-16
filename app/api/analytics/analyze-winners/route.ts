import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!
})

type AnalyzeRequest = {
  campaignId?: string
}

type UserRow = {
  id: string
}

type ContentRow = {
  id: string
  text_content: string | null
}

type AnalyticsEventRow = {
  post_id: string | null
  event_type: string | null
  platform: string | null
}

type ScoredPost = {
  id: string
  text: string
  score: number
}

function getTextFromAnthropicResponse(content: Anthropic.Message['content']): string {
  for (const block of content) {
    if (block.type === 'text') {
      return block.text
    }
  }
  return ''
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = (await req.json()) as AnalyzeRequest
    const campaignId = typeof body.campaignId === 'string' ? body.campaignId.trim() : ''

    if (!campaignId) {
      return NextResponse.json({ success: false, error: 'campaignId is required' }, { status: 400 })
    }

    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('clerk_user_id', userId)
      .single<UserRow>()

    if (userError || !userData) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })
    }

    const sinceIso = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

    const { data: posts, error: postsError } = await supabase
      .from('content_library')
      .select('id, text_content')
      .eq('user_id', userData.id)
      .eq('campaign_id', campaignId)
      .eq('content_type', 'post')
      .gte('created_at', sinceIso)
      .order('created_at', { ascending: false })
      .limit(20)

    if (postsError) {
      console.error('Analyze winners posts query error:', postsError)
      return NextResponse.json({ success: false, error: 'Failed to fetch content library posts' }, { status: 500 })
    }

    const safePosts = ((posts || []) as ContentRow[]).filter(
      (post) => typeof post.text_content === 'string' && post.text_content.trim().length > 0
    )

    if (safePosts.length < 2) {
      return NextResponse.json({
        success: true,
        winners: 0,
        insights: 'Not enough post data yet. Create more posts before running winner analysis.'
      })
    }

    const postIds = safePosts.map((post) => post.id)
    const { data: events, error: eventsError } = await supabase
      .from('analytics_events')
      .select('post_id, event_type, platform')
      .eq('user_id', userData.id)
      .eq('campaign_id', campaignId)
      .in('post_id', postIds)

    if (eventsError) {
      console.error('Analyze winners events query error:', eventsError)
      return NextResponse.json({ success: false, error: 'Failed to fetch analytics events' }, { status: 500 })
    }

    const safeEvents = (events || []) as AnalyticsEventRow[]
    const eventsByPostId = new Map<string, AnalyticsEventRow[]>()

    for (const event of safeEvents) {
      if (!event.post_id) {
        continue
      }
      const list = eventsByPostId.get(event.post_id) || []
      list.push(event)
      eventsByPostId.set(event.post_id, list)
    }

    const scored = safePosts
      .map((post): ScoredPost => {
        const postEvents = eventsByPostId.get(post.id) || []
        const clicks = postEvents.filter((event) => event.event_type === 'click').length
        const signups = postEvents.filter((event) => event.event_type === 'signup').length
        const conversions = postEvents.filter((event) => event.event_type === 'conversion').length
        const score = clicks + signups * 10 + conversions * 100

        return {
          id: post.id,
          text: post.text_content || '',
          score
        }
      })
      .sort((a, b) => b.score - a.score)

    const bucketSize = Math.max(1, Math.floor(scored.length * 0.2))
    const winners = scored.slice(0, bucketSize)
    const underperformers = scored.slice(-bucketSize)

    const winnerIds = new Set(winners.map((post) => post.id))
    const underperformerIds = new Set(underperformers.map((post) => post.id))

    // Reset labels for this analysis batch, then set winner/underperformer labels.
    const { error: resetError } = await supabase
      .from('content_library')
      .update({ performance_label: 'average' })
      .eq('user_id', userData.id)
      .eq('campaign_id', campaignId)
      .in('id', postIds)

    if (resetError) {
      console.error('Analyze winners reset labels error:', resetError)
      return NextResponse.json({ success: false, error: 'Failed to update performance labels' }, { status: 500 })
    }

    if (winnerIds.size > 0) {
      const { error: winnerUpdateError } = await supabase
        .from('content_library')
        .update({ performance_label: 'winner' })
        .eq('user_id', userData.id)
        .eq('campaign_id', campaignId)
        .in('id', Array.from(winnerIds))

      if (winnerUpdateError) {
        console.error('Analyze winners winner label error:', winnerUpdateError)
        return NextResponse.json({ success: false, error: 'Failed to label winner posts' }, { status: 500 })
      }
    }

    if (underperformerIds.size > 0) {
      const { error: underperformerUpdateError } = await supabase
        .from('content_library')
        .update({ performance_label: 'underperformer' })
        .eq('user_id', userData.id)
        .eq('campaign_id', campaignId)
        .in('id', Array.from(underperformerIds))

      if (underperformerUpdateError) {
        console.error('Analyze winners underperformer label error:', underperformerUpdateError)
        return NextResponse.json({ success: false, error: 'Failed to label underperforming posts' }, { status: 500 })
      }
    }

    const winnerTexts = winners.map((post) => post.text).join('\n\n---\n\n')
    const loserTexts = underperformers.map((post) => post.text).join('\n\n---\n\n')

    const analysis = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      messages: [
        {
          role: 'user',
          content: `Analyze these social media posts and identify what makes the winners work:

WINNING POSTS (high engagement):
${winnerTexts}

UNDERPERFORMING POSTS (low engagement):
${loserTexts}

What patterns do you see? What should we do more of? What should we avoid?
Respond with actionable insights in 3-5 bullet points.`
        }
      ]
    })

    const insights = getTextFromAnthropicResponse(analysis.content)

    const { error: updateConfigError } = await supabase
      .from('autopilot_configs')
      .update({
        performance_insights: insights,
        last_analyzed_at: new Date().toISOString()
      })
      .eq('id', campaignId)
      .eq('user_id', userData.id)

    if (updateConfigError) {
      console.error('Analyze winners config update error:', updateConfigError)
      return NextResponse.json({ success: false, error: 'Failed to save performance insights' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      winners: winners.length,
      insights
    })
  } catch (error) {
    console.error('Analyze winners route error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to analyze winners'
      },
      { status: 500 }
    )
  }
}
