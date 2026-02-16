import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'
import chromium from '@sparticuz/chromium'
import { chromium as playwrightChromium } from 'playwright-core'
import { ensureValidTwitterAccessToken } from '@/lib/twitter-auth'
import { logger } from '@/lib/logger'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!
})

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!
})

type WebhookActionRequest = {
  userId?: string
  campaignId?: string
}

type UserRow = {
  id: string
  clerk_user_id: string | null
  posts_used: number | null
  posts_limit: number | null
  plan_type: string | null
}

type ConfigRow = {
  id: string
  campaign_name: string | null
  app_name: string
  app_description: string
  app_url: string | null
  target_audience: string
  posting_tone: string | null
  posting_instructions: string | null
  performance_insights: string | null
  content_mix_image: number | null
  platforms: Record<string, boolean> | null
  is_active: boolean | null
  is_paused: boolean | null
}

type ConnectedAccountRow = {
  platform: string | null
  access_token: string | null
  refresh_token: string | null
  token_expires_at: string | null
  account_username: string | null
  platform_user_id?: string | null
}

const POST_PLATFORMS = new Set(['twitter', 'linkedin', 'reddit', 'producthunt', 'product_hunt', 'instagram', 'facebook', 'threads'])

type PublishResult = {
  success: boolean
  postId?: string
  postUrl?: string
  error?: string
  warning?: string
}

type ScreenshotStyleHints = {
  primaryColors: string[]
  accentColors: string[]
  uiElements: string[]
  styleSummary: string
  logoHint: string
}

function extractToken(authHeader: string | null): string | null {
  if (!authHeader) {
    return null
  }

  if (authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7).trim()
  }

  return authHeader.trim()
}

function isNoRowsError(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && 'code' in error && (error as { code?: string }).code === 'PGRST116')
}

function toNumber(value: number | null | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function normalizePlatform(value: string): string {
  return value.trim().toLowerCase()
}

function toBooleanRecord(value: unknown): Record<string, boolean> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {}
  }

  const result: Record<string, boolean> = {}
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    result[key] = Boolean(raw)
  }

  return result
}

async function publishTwitterPost(
  accessToken: string,
  text: string,
  username: string | null,
  imageUrl?: string | null
): Promise<PublishResult> {
  const trimmedText = text.trim()
  if (!trimmedText) {
    return { success: false, error: 'Post text is empty' }
  }

  let mediaId: string | null = null
  let warning: string | undefined

  if (imageUrl && typeof imageUrl === 'string') {
    try {
      const imageResponse = await fetch(imageUrl)
      if (!imageResponse.ok) {
        throw new Error(`Image download failed with status ${imageResponse.status}`)
      }

      const imageBuffer = await imageResponse.arrayBuffer()
      const imageBase64 = Buffer.from(imageBuffer).toString('base64')

      const mediaUploadResponse = await fetch('https://upload.twitter.com/1.1/media/upload.json', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          media_data: imageBase64
        })
      })

      const mediaPayload = (await mediaUploadResponse.json().catch(() => ({}))) as {
        media_id_string?: string
        error?: string
        errors?: Array<{ message?: string }>
      }

      if (!mediaUploadResponse.ok || !mediaPayload.media_id_string) {
        const mediaError =
          mediaPayload.error ||
          mediaPayload.errors?.[0]?.message ||
          `Twitter media upload failed with status ${mediaUploadResponse.status}`
        warning = `Image upload failed, posted text-only: ${mediaError}`
      } else {
        mediaId = mediaPayload.media_id_string
      }
    } catch (uploadError) {
      warning =
        uploadError instanceof Error
          ? `Image upload failed, posted text-only: ${uploadError.message}`
          : 'Image upload failed, posted text-only'
    }
  }

  const tweetPayload: { text: string; media?: { media_ids: string[] } } = {
    text: trimmedText
  }

  if (mediaId) {
    tweetPayload.media = {
      media_ids: [mediaId]
    }
  }

  const response = await fetch('https://api.twitter.com/2/tweets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(tweetPayload)
  })

  const payload = (await response.json().catch(() => ({}))) as {
    data?: { id?: string; text?: string }
    detail?: string
    title?: string
    errors?: Array<{ message?: string }>
  }

  if (!response.ok || !payload.data?.id) {
    const apiError =
      payload.detail ||
      payload.title ||
      payload.errors?.[0]?.message ||
      `Twitter publish failed with status ${response.status}`
    return { success: false, error: apiError }
  }

  const postId = payload.data.id
  const normalizedUsername = typeof username === 'string' && username.trim().length > 0 ? username.trim() : null
  const postUrl = normalizedUsername
    ? `https://x.com/${normalizedUsername}/status/${postId}`
    : `https://x.com/i/web/status/${postId}`

  return {
    success: true,
    postId,
    postUrl,
    warning
  }
}

async function publishLinkedInPost(
  accessToken: string,
  text: string
): Promise<PublishResult> {
  const trimmedText = text.trim()
  if (!trimmedText) {
    return { success: false, error: 'Post text is empty' }
  }

  const linkedInText = trimmedText.slice(0, 1300)

  const meResponse = await fetch('https://api.linkedin.com/v2/me', {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  })

  const mePayload = (await meResponse.json().catch(() => ({}))) as {
    id?: string
    message?: string
    serviceErrorCode?: number
  }

  if (!meResponse.ok || !mePayload.id) {
    const meError =
      mePayload.message ||
      `LinkedIn profile lookup failed with status ${meResponse.status}`
    return { success: false, error: meError }
  }

  const personUrn = `urn:li:person:${mePayload.id}`

  const linkedInResponse = await fetch('https://api.linkedin.com/v2/ugcPosts', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'X-Restli-Protocol-Version': '2.0.0'
    },
    body: JSON.stringify({
      author: personUrn,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: {
            text: linkedInText
          },
          shareMediaCategory: 'NONE'
        }
      },
      visibility: {
        'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC'
      }
    })
  })

  const linkedInPayload = (await linkedInResponse.json().catch(() => ({}))) as {
    id?: string
    message?: string
    serviceErrorCode?: number
  }

  if (!linkedInResponse.ok) {
    const linkedInError =
      linkedInPayload.message ||
      `LinkedIn publish failed with status ${linkedInResponse.status}`
    return { success: false, error: linkedInError }
  }

  const postId = linkedInResponse.headers.get('x-restli-id') || linkedInPayload.id || undefined
  const postUrl = postId
    ? `https://www.linkedin.com/feed/update/${encodeURIComponent(postId)}/`
    : undefined

  return {
    success: true,
    postId,
    postUrl
  }
}

async function publishFacebookPost(
  accessToken: string,
  pageId: string,
  text: string,
  imageUrl?: string | null
): Promise<PublishResult> {
  const message = text.trim()
  if (!message) {
    return { success: false, error: 'Post text is empty' }
  }

  if (imageUrl && typeof imageUrl === 'string') {
    const photoResponse = await fetch(`https://graph.facebook.com/v18.0/${pageId}/photos`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        url: imageUrl,
        caption: message,
        access_token: accessToken
      })
    })

    const photoPayload = (await photoResponse.json().catch(() => ({}))) as {
      id?: string
      post_id?: string
      error?: { message?: string }
    }

    if (!photoResponse.ok || !photoPayload.id) {
      const photoError =
        photoPayload.error?.message || `Facebook photo post failed with status ${photoResponse.status}`
      return { success: false, error: photoError }
    }

    const postId = photoPayload.post_id || photoPayload.id
    return {
      success: true,
      postId,
      postUrl: `https://www.facebook.com/${postId}`
    }
  }

  const feedResponse = await fetch(`https://graph.facebook.com/v18.0/${pageId}/feed`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      message,
      access_token: accessToken
    })
  })

  const feedPayload = (await feedResponse.json().catch(() => ({}))) as {
    id?: string
    error?: { message?: string }
  }

  if (!feedResponse.ok || !feedPayload.id) {
    const feedError =
      feedPayload.error?.message || `Facebook post failed with status ${feedResponse.status}`
    return { success: false, error: feedError }
  }

  return {
    success: true,
    postId: feedPayload.id,
    postUrl: `https://www.facebook.com/${feedPayload.id}`
  }
}

async function publishInstagramImagePost(
  accessToken: string,
  instagramAccountId: string,
  caption: string,
  imageUrl: string | null
): Promise<PublishResult> {
  if (!imageUrl) {
    return { success: false, error: 'Instagram posting requires an image URL' }
  }

  const createResponse = await fetch(`https://graph.facebook.com/v18.0/${instagramAccountId}/media`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      image_url: imageUrl,
      caption: caption.slice(0, 2200),
      access_token: accessToken
    })
  })

  const createPayload = (await createResponse.json().catch(() => ({}))) as {
    id?: string
    error?: { message?: string }
  }

  if (!createResponse.ok || !createPayload.id) {
    const createError =
      createPayload.error?.message || `Instagram media creation failed with status ${createResponse.status}`
    return { success: false, error: createError }
  }

  const publishResponse = await fetch(
    `https://graph.facebook.com/v18.0/${instagramAccountId}/media_publish`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        creation_id: createPayload.id,
        access_token: accessToken
      })
    }
  )

  const publishPayload = (await publishResponse.json().catch(() => ({}))) as {
    id?: string
    error?: { message?: string }
  }

  if (!publishResponse.ok || !publishPayload.id) {
    const publishError =
      publishPayload.error?.message ||
      `Instagram media publish failed with status ${publishResponse.status}`
    return { success: false, error: publishError }
  }

  return {
    success: true,
    postId: publishPayload.id,
    postUrl: `https://www.instagram.com/p/${publishPayload.id}/`
  }
}

function isValidAbsoluteUrl(value: string | null | undefined): value is string {
  if (!value || typeof value !== 'string') {
    return false
  }

  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

async function captureAppScreenshotDataUri(appUrl: string): Promise<string | null> {
  let browser: Awaited<ReturnType<typeof playwrightChromium.launch>> | null = null

  try {
    browser = await playwrightChromium.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: true
    })

    const context = await browser.newContext({
      viewport: { width: 1400, height: 900 }
    })

    const page = await context.newPage()
    await page.goto(appUrl, {
      waitUntil: 'networkidle',
      timeout: 30000
    })

    await page.waitForTimeout(1200)
    const screenshot = await page.screenshot({
      type: 'png',
      fullPage: false
    })

    return `data:image/png;base64,${screenshot.toString('base64')}`
  } catch (error) {
    console.warn('[AutoPilot Post] App screenshot capture failed', error)
    return null
  } finally {
    if (browser) {
      await browser.close()
    }
  }
}

async function analyzeAppVisualStyle(
  screenshotDataUri: string
): Promise<ScreenshotStyleHints | null> {
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text:
                'Analyze this app screenshot and return strict JSON with keys: primaryColors (string[]), accentColors (string[]), uiElements (string[]), styleSummary (string), logoHint (string). Keep each value concise.'
            },
            {
              type: 'image_url',
              image_url: {
                url: screenshotDataUri
              }
            }
          ]
        }
      ],
      max_tokens: 300
    })

    const raw = completion.choices?.[0]?.message?.content || '{}'
    const parsed = JSON.parse(raw) as Partial<ScreenshotStyleHints>

    return {
      primaryColors: Array.isArray(parsed.primaryColors)
        ? parsed.primaryColors.filter((color): color is string => typeof color === 'string').slice(0, 5)
        : [],
      accentColors: Array.isArray(parsed.accentColors)
        ? parsed.accentColors.filter((color): color is string => typeof color === 'string').slice(0, 5)
        : [],
      uiElements: Array.isArray(parsed.uiElements)
        ? parsed.uiElements.filter((item): item is string => typeof item === 'string').slice(0, 8)
        : [],
      styleSummary: typeof parsed.styleSummary === 'string' ? parsed.styleSummary : '',
      logoHint: typeof parsed.logoHint === 'string' ? parsed.logoHint : ''
    }
  } catch (error) {
    console.warn('[AutoPilot Post] App visual analysis failed', error)
    return null
  }
}

async function findUserByIdOrClerkId(userId: string): Promise<UserRow | null> {
  const byId = await supabase
    .from('users')
    .select('id, clerk_user_id, posts_used, posts_limit, plan_type')
    .eq('id', userId)
    .maybeSingle<UserRow>()

  if (byId.data) {
    return byId.data
  }

  if (byId.error && !isNoRowsError(byId.error)) {
    throw byId.error
  }

  const byClerkId = await supabase
    .from('users')
    .select('id, clerk_user_id, posts_used, posts_limit, plan_type')
    .eq('clerk_user_id', userId)
    .maybeSingle<UserRow>()

  if (byClerkId.error && !isNoRowsError(byClerkId.error)) {
    throw byClerkId.error
  }

  return byClerkId.data || null
}

async function findCampaign(userDbId: string, campaignId?: string): Promise<ConfigRow | null> {
  let query = supabase
    .from('autopilot_configs')
    .select('*')
    .eq('user_id', userDbId)
    .eq('is_active', true)

  if (campaignId) {
    query = query.eq('id', campaignId)
  } else {
    query = query.order('created_at', { ascending: false }).limit(1)
  }

  const { data, error } = await query.maybeSingle<ConfigRow>()

  if (error && !isNoRowsError(error)) {
    throw error
  }

  return data || null
}

export async function POST(req: NextRequest) {
  let requestUserId = ''
  let requestCampaignId = ''
  let attemptedPlatforms: string[] = []

  try {
    console.log('[AutoPilot Post] Starting post action...')

    // 1. Authenticate with N8N_WEBHOOK_SECRET
    const authHeader = req.headers.get('authorization')
    const webhookSecret = process.env.N8N_WEBHOOK_SECRET

    if (!webhookSecret) {
      return NextResponse.json(
        {
          success: false,
          error: 'N8N_WEBHOOK_SECRET not configured'
        },
        { status: 500 }
      )
    }

    const token = extractToken(authHeader)
    if (!token) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing Authorization header'
        },
        { status: 401 }
      )
    }

    if (token !== webhookSecret) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid webhook secret'
        },
        { status: 401 }
      )
    }

    console.log('[AutoPilot Post] Authentication successful')

    // 2. Parse request
    const body = (await req.json()) as WebhookActionRequest
    const userId = typeof body.userId === 'string' ? body.userId.trim() : ''
    const campaignId = typeof body.campaignId === 'string' ? body.campaignId.trim() : ''
    requestUserId = userId
    requestCampaignId = campaignId

    if (!userId) {
      return NextResponse.json(
        {
          success: false,
          error: 'userId is required'
        },
        { status: 400 }
      )
    }

    // 3. Get user from database
    const userData = await findUserByIdOrClerkId(userId)

    if (!userData) {
      return NextResponse.json(
        {
          success: false,
          error: 'User not found'
        },
        { status: 404 }
      )
    }

    // 4. Get campaign config
    const config = await findCampaign(userData.id, campaignId || undefined)

    if (!config) {
      return NextResponse.json(
        {
          success: false,
          error: 'No active campaign config found',
          skipAction: true
        },
        { status: 200 }
      )
    }

    if (config.is_paused) {
      return NextResponse.json(
        {
          success: false,
          error: 'Campaign is paused',
          skipAction: true
        },
        { status: 200 }
      )
    }

    // 5. Check limits BEFORE processing
    const postsUsed = toNumber(userData.posts_used, 0)
    const postsLimit = toNumber(userData.posts_limit, 5)

    if (postsUsed >= postsLimit) {
      console.log('[AutoPilot Post] Monthly limit reached')

      const { error: skipLogError } = await supabase
        .from('autopilot_activity')
        .insert({
          user_id: userData.id,
          campaign_id: config.id,
          action_type: 'post',
          action_description: 'Skipped - monthly limit reached',
          result: 'skipped',
          details: {
            posts_used: postsUsed,
            posts_limit: postsLimit,
            plan: userData.plan_type || 'free'
          }
        })

      if (skipLogError) {
        console.warn('[AutoPilot Post] Failed to log limit skip event:', skipLogError)
      }

      return NextResponse.json(
        {
          success: false,
          error: 'Monthly post limit reached',
          skipAction: true,
          upgrade_url: `${process.env.NEXT_PUBLIC_APP_URL || ''}/pricing`,
          posts_used: postsUsed,
          posts_limit: postsLimit
        },
        { status: 200 }
      )
    }

    console.log('[AutoPilot Post] Using campaign:', config.campaign_name || config.app_name)

    // 6. Get connected platforms
    const { data: connectedAccounts, error: connectedError } = await supabase
      .from('connected_accounts')
      .select('platform, access_token, refresh_token, token_expires_at, account_username, platform_user_id')
      .eq('user_id', userData.id)
      .eq('is_active', true)

    if (connectedError) {
      throw connectedError
    }

    const connectedPlatforms = ((connectedAccounts || []) as ConnectedAccountRow[])
      .map((account) => account.platform)
      .filter((platform): platform is string => typeof platform === 'string' && platform.trim().length > 0)
      .map(normalizePlatform)

    const configPlatforms = Object.entries(toBooleanRecord(config.platforms))
      .filter(([, enabled]) => enabled)
      .map(([platform]) => normalizePlatform(platform))
      .filter((platform) => POST_PLATFORMS.has(platform))

    const selectedPlatforms = configPlatforms.filter((platform) => connectedPlatforms.includes(platform))
    attemptedPlatforms = selectedPlatforms

    if (selectedPlatforms.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'No connected post platforms for this campaign',
          skipAction: true
        },
        { status: 200 }
      )
    }

    // 7. Generate post content with anti-repetition context
    const { data: recentPosts } = await supabase
      .from('autopilot_activity')
      .select('details')
      .eq('user_id', userData.id)
      .eq('action_type', 'post')
      .order('created_at', { ascending: false })
      .limit(5)

    const recentTexts =
      (recentPosts || [])
        .map((post) => {
          const details = post.details as { postText?: string } | null
          return details?.postText
        })
        .filter((text): text is string => typeof text === 'string' && text.trim().length > 0) || []

    const promptStyles = [
      'Create a problem-solution post',
      'Share a surprising fact or statistic',
      'Ask an engaging question',
      'Share a customer success story',
      'Highlight a unique feature',
      'Create a humorous/fun post',
      'Share a tip or hack',
      'Create urgency with a time-sensitive offer'
    ]
    const randomStyle = promptStyles[Math.floor(Math.random() * promptStyles.length)]
    const performanceInsights =
      typeof config.performance_insights === 'string' && config.performance_insights.trim().length > 0
        ? config.performance_insights.trim()
        : 'No insights yet - this is your first batch!'
    const primaryPlatform = selectedPlatforms[0] || 'social'
    const campaignSlug = (config.campaign_name || config.app_name || 'campaign')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 64)
    let trackedUrl: string | null = null

    if (isValidAbsoluteUrl(config.app_url)) {
      const url = new URL(config.app_url)
      url.searchParams.set('utm_source', primaryPlatform)
      url.searchParams.set('utm_medium', 'social')
      url.searchParams.set('utm_campaign', campaignSlug || 'campaign')
      url.searchParams.set('utm_content', `autopilot_${Date.now()}`)
      trackedUrl = url.toString()
    }

    const prompt = `You are a social media expert. ${randomStyle} for ${config.app_name}.

App: ${config.app_description}
Audience: ${config.target_audience}
Tone: ${config.posting_tone || 'casual'}
Custom instructions: ${config.posting_instructions || 'None'}
PERFORMANCE INSIGHTS (do more of this):
${performanceInsights}
Tracked link (use if referencing website): ${trackedUrl || 'No app URL available'}

AVOID these recent posts (be different):
${recentTexts.length > 0 ? recentTexts.map((text, index) => `${index + 1}. ${text}`).join('\n') : 'No recent posts.'}

Create a UNIQUE post (max 280 chars) that:
- Uses a different angle than recent posts
- ${randomStyle.toLowerCase()}
- Matches ${config.posting_tone || 'casual'} tone
- Includes emojis (1-2 max)
- If mentioning the website, use this tracked link exactly once: ${trackedUrl || 'N/A'}

Return ONLY the post text.`

    const claudeResponse = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 512,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    })

    const postText = claudeResponse.content[0]?.type === 'text' ? claudeResponse.content[0].text.trim() : ''

    if (!postText) {
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to generate post content'
        },
        { status: 500 }
      )
    }

    // 8. Generate image (probability-based via campaign content mix)
    let imageUrl: string | null = null
    const imageChance = Math.max(0, Math.min(100, toNumber(config.content_mix_image, 35)))
    const shouldGenerateImage = Math.random() * 100 < imageChance

    if (shouldGenerateImage && process.env.OPENAI_API_KEY) {
      try {
        let screenshotDataUri: string | null = null
        let styleHints: ScreenshotStyleHints | null = null

        const appUrl = config.app_url
        if (isValidAbsoluteUrl(appUrl)) {
          screenshotDataUri = await captureAppScreenshotDataUri(appUrl)
          if (screenshotDataUri) {
            styleHints = await analyzeAppVisualStyle(screenshotDataUri)
          }
        }

        const styleSection = styleHints
          ? `
Visual cues from the app screenshot:
- Primary colors: ${styleHints.primaryColors.join(', ') || 'N/A'}
- Accent colors: ${styleHints.accentColors.join(', ') || 'N/A'}
- UI elements: ${styleHints.uiElements.join(', ') || 'N/A'}
- Style summary: ${styleHints.styleSummary || 'N/A'}
- Logo hint: ${styleHints.logoHint || 'N/A'}`
          : '\nVisual cues from screenshot: unavailable, infer from app description.'

        const imagePrompt = `Create a clean social media marketing graphic for this exact post:
"${postText}"

Brand/app: ${config.app_name}
What the app does: ${config.app_description}
Target audience: ${config.target_audience}${styleSection}

Design requirements:
- Reflect the app's visual theme and color palette
- Focus on one central concept from the post text
- Use modern SaaS graphic style with clean composition
- No random unrelated symbols
- No gibberish text, no fake logos, no watermark
- Square composition optimized for social posting`

        const imageResponse = await openai.images.generate({
          model: 'dall-e-3',
          prompt: imagePrompt,
          n: 1,
          size: '1024x1024'
        })

        imageUrl = imageResponse.data?.[0]?.url || null
      } catch (imageError) {
        console.warn('[AutoPilot Post] Image generation failed; continuing text-only', imageError)
      }
    }

    // 9. Publish to selected platforms
    const platformResults: Record<string, PublishResult> = {}
    const successfulPlatforms: string[] = []
    const failedPlatforms: string[] = []

    for (const platform of selectedPlatforms) {
      if (platform === 'twitter') {
        const twitterAccount = ((connectedAccounts || []) as ConnectedAccountRow[]).find(
          (account) => normalizePlatform(account.platform || '') === 'twitter'
        )

        if (!twitterAccount?.access_token) {
          platformResults.twitter = {
            success: false,
            error: 'Twitter account token not found'
          }
          failedPlatforms.push('twitter')
          continue
        }

        let validAccessToken = twitterAccount.access_token
        try {
          validAccessToken = await ensureValidTwitterAccessToken({
            supabase,
            userId: userData.id,
            account: {
              access_token: twitterAccount.access_token,
              refresh_token: twitterAccount.refresh_token,
              token_expires_at: twitterAccount.token_expires_at
            }
          })
        } catch (tokenError) {
          platformResults.twitter = {
            success: false,
            error:
              tokenError instanceof Error
                ? tokenError.message
                : 'Twitter token refresh failed'
          }
          failedPlatforms.push('twitter')
          continue
        }

        const result = await publishTwitterPost(
          validAccessToken,
          postText,
          twitterAccount.account_username,
          imageUrl
        )
        platformResults.twitter = result

        if (result.success) {
          successfulPlatforms.push('twitter')
        } else {
          failedPlatforms.push('twitter')
        }
        continue
      }

      if (platform === 'linkedin') {
        const linkedInAccount = ((connectedAccounts || []) as ConnectedAccountRow[]).find(
          (account) => normalizePlatform(account.platform || '') === 'linkedin'
        )

        if (!linkedInAccount?.access_token) {
          platformResults.linkedin = {
            success: false,
            error: 'LinkedIn account token not found'
          }
          failedPlatforms.push('linkedin')
          continue
        }

        const result = await publishLinkedInPost(linkedInAccount.access_token, postText)
        platformResults.linkedin = result

        if (result.success) {
          successfulPlatforms.push('linkedin')
        } else {
          failedPlatforms.push('linkedin')
        }
        continue
      }

      if (platform === 'facebook') {
        const facebookAccount = ((connectedAccounts || []) as ConnectedAccountRow[]).find(
          (account) => normalizePlatform(account.platform || '') === 'facebook'
        )

        if (!facebookAccount?.access_token || !facebookAccount.platform_user_id) {
          platformResults.facebook = {
            success: false,
            error: 'Facebook account token or page ID not found'
          }
          failedPlatforms.push('facebook')
          continue
        }

        const result = await publishFacebookPost(
          facebookAccount.access_token,
          facebookAccount.platform_user_id,
          postText,
          imageUrl
        )
        platformResults.facebook = result

        if (result.success) {
          successfulPlatforms.push('facebook')
        } else {
          failedPlatforms.push('facebook')
        }
        continue
      }

      if (platform === 'instagram') {
        const instagramAccount = ((connectedAccounts || []) as ConnectedAccountRow[]).find(
          (account) => normalizePlatform(account.platform || '') === 'instagram'
        )

        if (!instagramAccount?.access_token || !instagramAccount.platform_user_id) {
          platformResults.instagram = {
            success: false,
            error: 'Instagram account token or account ID not found'
          }
          failedPlatforms.push('instagram')
          continue
        }

        const result = await publishInstagramImagePost(
          instagramAccount.access_token,
          instagramAccount.platform_user_id,
          postText,
          imageUrl
        )
        platformResults.instagram = result

        if (result.success) {
          successfulPlatforms.push('instagram')
        } else {
          failedPlatforms.push('instagram')
        }
        continue
      }

      platformResults[platform] = {
        success: false,
        error: `AutoPilot publish for ${platform} is not implemented yet`
      }
      failedPlatforms.push(platform)
    }

    // 10. Log activity
    const actionDescription =
      successfulPlatforms.length > 0
        ? `Posted to ${successfulPlatforms.join(', ')}`
        : `Failed to publish post to ${selectedPlatforms.join(', ')}`

    const { error: activityError } = await supabase.from('autopilot_activity').insert({
      user_id: userData.id,
      campaign_id: config.id,
      action_type: 'post',
      action_description: actionDescription,
      platforms: successfulPlatforms.length > 0 ? successfulPlatforms : selectedPlatforms,
      result: successfulPlatforms.length > 0 ? 'success' : 'failed',
      details: {
        postText: postText.substring(0, 280),
        imageGenerated: Boolean(imageUrl),
        publishStatus: successfulPlatforms.length > 0 ? 'published' : 'failed',
        attemptedPlatforms: selectedPlatforms,
        successfulPlatforms,
        failedPlatforms,
        platformResults
      }
    })

    if (activityError) {
      throw activityError
    }

    // 11. Update usage counter only when at least one publish succeeded
    let newPostsUsed = postsUsed
    if (successfulPlatforms.length > 0) {
      newPostsUsed = postsUsed + 1
      const { error: usageError } = await supabase
        .from('users')
        .update({
          posts_used: newPostsUsed,
          updated_at: new Date().toISOString()
        })
        .eq('id', userData.id)

      if (usageError) {
        throw usageError
      }
    }

    if (successfulPlatforms.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to publish post to any platform',
          platforms: selectedPlatforms,
          platformResults,
          postsUsed: newPostsUsed,
          postsLimit
        },
        { status: 500 }
      )
    }

    // 12. Save published content to content library (non-blocking)
    const { error: libraryError } = await supabase
      .from('content_library')
      .insert({
        user_id: userData.id,
        campaign_id: config.id,
        content_type: imageUrl ? 'image' : 'post',
        text_content: postText,
        image_url: imageUrl,
        platforms: successfulPlatforms,
        posted_at: new Date().toISOString()
      })

    if (libraryError) {
      console.warn('[AutoPilot Post] Failed to save content library entry:', libraryError)
    }

    const { error: timestampError } = await supabase
      .from('autopilot_configs')
      .update({ last_post_at: new Date().toISOString() })
      .eq('id', config.id)

    if (timestampError) {
      throw timestampError
    }

    // 13. Return success
    return NextResponse.json({
      success: true,
      postText,
      imageUrl,
      platforms: successfulPlatforms,
      platformResults,
      postsUsed: newPostsUsed,
      postsLimit
    })
  } catch (error) {
    logger.error('AutoPilot Post', error, {
      userId: requestUserId || null,
      campaignId: requestCampaignId || null,
      platforms: attemptedPlatforms
    })
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create post'
      },
      { status: 500 }
    )
  }
}
