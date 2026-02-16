import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import Anthropic from '@anthropic-ai/sdk'
import { supabaseAdmin } from '@/lib/supabase'

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!
})

// Platform character limits and guidelines
const PLATFORM_SPECS = {
  twitter: {
    maxChars: 280,
    tone: 'casual and engaging',
    format: 'Short, punchy, use emojis strategically',
    cta: 'Include clear call-to-action'
  },
  reddit: {
    maxChars: null,
    tone: 'informative and community-focused',
    format: '300-500 words, paragraph form, authentic',
    cta: 'Encourage discussion, be genuine'
  },
  product_hunt: {
    maxChars: null,
    tone: 'exciting and professional',
    format: '100-150 words, highlight key features',
    cta: 'Ask for upvotes and feedback'
  },
  linkedin: {
    maxChars: 3000,
    tone: 'professional and value-focused',
    format: '200-300 words, business benefits, use line breaks',
    cta: 'Professional call-to-action'
  },
  hackernews: {
    maxChars: null,
    tone: 'technical and straightforward',
    format: '150-200 words, focus on implementation',
    cta: 'Invite technical discussion'
  }
}

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
    const { appName, appDescription, targetAudience, platforms, includeImage } = body

    // 3. Validate inputs
    if (!appName || !appDescription) {
      return NextResponse.json(
        { success: false, error: 'App name and description are required' },
        { status: 400 }
      )
    }

    if (!platforms || platforms.length === 0) {
      return NextResponse.json(
        { success: false, error: 'At least one platform must be selected' },
        { status: 400 }
      )
    }

    // 4. Check user's usage limits
    type UserLimitRow = {
      posts_used: number | null;
      posts_limit: number | null;
      plan_type: string | null;
    };

    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .select('posts_used, posts_limit, plan_type')
      .eq('clerk_user_id', userId)
      .single<UserLimitRow>()

    if (userError) {
      console.error('Database error:', userError)
      return NextResponse.json(
        { success: false, error: 'Failed to check usage limits' },
        { status: 500 }
      )
    }

    if (!userData) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      )
    }

    const postsUsed = userData.posts_used ?? 0
    const postsLimit = userData.posts_limit ?? 0

    if (postsUsed >= postsLimit) {
      return NextResponse.json(
        { 
          success: false, 
          error: `You've reached your limit of ${postsLimit} posts this month. Upgrade to get more!`,
          upgradeRequired: true
        },
        { status: 403 }
      )
    }

    // 5. Build Claude prompt
    const platformList = platforms.map((p: string) => {
      const specs = PLATFORM_SPECS[p as keyof typeof PLATFORM_SPECS]
      return `- ${p.replace('_', ' ').toUpperCase()}: ${specs.format}. ${specs.cta}. ${specs.maxChars ? `MAX ${specs.maxChars} characters.` : ''}`
    }).join('\n')

    const prompt = `You are an expert social media marketer. Generate highly engaging, platform-optimized posts for a product launch.

PRODUCT DETAILS:
- Name: ${appName}
- Description: ${appDescription}
- Target Audience: ${targetAudience || 'general users'}

PLATFORMS TO CREATE POSTS FOR:
${platformList}

REQUIREMENTS:
1. Each post must be tailored to the platform's audience and format
2. Use appropriate tone for each platform
3. Include relevant emojis where appropriate (especially Twitter)
4. Highlight the key value proposition
5. Include a clear call-to-action
6. Stay within character limits where specified
${includeImage ? '7. For each post, also create a DALL-E image prompt (describe a simple, modern, eye-catching image that represents the app - keep under 100 words)' : ''}

Return ONLY valid JSON (no markdown, no code blocks) in this exact format:
{
  "twitter": {
    "content": "your tweet here...",
    ${includeImage ? '"imagePrompt": "DALL-E prompt here..."' : ''}
  },
  "reddit": {
    "content": "your reddit post here...",
    ${includeImage ? '"imagePrompt": "DALL-E prompt here..."' : ''}
  }
  // ... etc for each requested platform
}

CRITICAL: Return ONLY the JSON object. No other text before or after.`

    // 6. Call Claude API
    console.log('Calling Claude API...')
    const message = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 2048,
      messages: [{
        role: 'user',
        content: prompt
      }]
    })

    // 7. Extract and parse response
    const responseText = message.content[0].type === 'text' 
      ? message.content[0].text 
      : ''

    console.log('Claude response:', responseText)

    // Remove markdown code blocks if present
    const cleanedResponse = responseText
      .replace(/```json\n/g, '')
      .replace(/```\n/g, '')
      .replace(/```/g, '')
      .trim()

    // Parse JSON
    let generatedPosts
    try {
      generatedPosts = JSON.parse(cleanedResponse)
    } catch (parseError) {
      console.error('JSON parse error:', parseError)
      console.error('Response was:', cleanedResponse)
      return NextResponse.json(
        { success: false, error: 'Failed to parse AI response. Please try again.' },
        { status: 500 }
      )
    }

    // 8. Validate character limits
    for (const platform of platforms) {
      const specs = PLATFORM_SPECS[platform as keyof typeof PLATFORM_SPECS]
      if (specs.maxChars && generatedPosts[platform]?.content) {
        const contentLength = generatedPosts[platform].content.length
        if (contentLength > specs.maxChars) {
          // Truncate if over limit
          generatedPosts[platform].content = 
            generatedPosts[platform].content.substring(0, specs.maxChars - 3) + '...'
        }
      }
    }

    // 9. Return generated posts
    return NextResponse.json({
      success: true,
      posts: generatedPosts,
      tokensUsed: message.usage.input_tokens + message.usage.output_tokens
    })

  } catch (error) {
    console.error('Generate post error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to generate posts'
      },
      { status: 500 }
    )
  }
}
