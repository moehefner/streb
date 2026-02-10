import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import Anthropic from '@anthropic-ai/sdk'
import { supabaseAdmin } from '@/lib/supabase'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!
})

// Video type instructions for Claude
const VIDEO_TYPE_INSTRUCTIONS = {
  demo: 'Create a DEMO video showing the app in action. Focus on main features and user workflow. Show how the app works step-by-step.',
  feature: 'Create a FEATURE HIGHLIGHT video focusing on ONE key feature. Deep dive into this feature and show its value.',
  tutorial: 'Create a TUTORIAL video teaching "How to use [app] in 60 seconds". Make it instructional and easy to follow.',
  ad: 'Create an AD-STYLE video following Problem → Solution format. Start with pain point, introduce app as solution, show results.'
} as const

type VideoType = keyof typeof VIDEO_TYPE_INSTRUCTIONS

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

    // 2. Parse request
    const body = await req.json()
    const {
      appName,
      appDescription,
      keyFeatures,
      videoType,
      videoLength,
      screenshots,
      primaryLanguage,
      techStack
    } = body

    // 3. Validate required fields
    if (!appName || !appDescription) {
      return NextResponse.json({
        success: false,
        error: 'App name and description are required'
      }, { status: 400 })
    }

    // 4. Validate video type
    const validVideoTypes: VideoType[] = ['demo', 'feature', 'tutorial', 'ad']
    if (!validVideoTypes.includes(videoType)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid video type. Must be: demo, feature, tutorial, or ad'
      }, { status: 400 })
    }

    // 5. Validate video length
    const validLengths = [30, 60, 90]
    if (!validLengths.includes(videoLength)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid video length. Must be: 30, 60, or 90 seconds'
      }, { status: 400 })
    }

    // 6. Check user limits
    type UserRow = {
      id: string
      videos_used: number
      videos_limit: number
      plan_type: string
    }

    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .select('id, videos_used, videos_limit, plan_type')
      .eq('clerk_user_id', userId)
      .single<UserRow>()

    if (userError || !userData) {
      console.error('User lookup error:', userError)
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      )
    }

    if (userData.videos_used >= userData.videos_limit) {
      return NextResponse.json({
        success: false,
        error: `You've reached your limit of ${userData.videos_limit} videos this month. Upgrade to create more!`,
        upgradeRequired: true,
        currentPlan: userData.plan_type,
        videosUsed: userData.videos_used,
        videosLimit: userData.videos_limit
      }, { status: 403 })
    }

    console.log(`Generating ${videoType} script for ${appName} (${videoLength}s)`)

    // 7. Calculate scene count based on video length
    const sceneCount = Math.floor(videoLength / 10) // ~10 seconds per scene
    const screenshotCount = screenshots?.length || 0

    // 8. Build Claude prompt
    const prompt = `You are a professional video scriptwriter creating marketing videos for software products.

APP INFORMATION:
- Name: ${appName}
- Description: ${appDescription}
- Key Features: ${keyFeatures?.join(', ') || 'Not provided'}
- Tech Stack: ${techStack?.join(', ') || primaryLanguage || 'Not provided'}
- Screenshots Available: ${screenshotCount}

VIDEO REQUIREMENTS:
- Type: ${videoType.toUpperCase()}
- Length: ${videoLength} seconds
- Number of Scenes: ${sceneCount}-${sceneCount + 2}
- ${VIDEO_TYPE_INSTRUCTIONS[videoType as VideoType]}

INSTRUCTIONS:
1. Create ${sceneCount} to ${sceneCount + 2} scenes that total exactly ${videoLength} seconds
2. Each scene should be 8-12 seconds long
3. Assign screenshot numbers (0-${Math.max(0, screenshotCount - 1)}) to scenes where visuals are needed
4. Write compelling text overlays (short, punchy, max 8 words per line)
5. Write voiceover script (conversational tone, natural delivery)
6. Include smooth transitions between scenes
7. Start strong with a hook, end with clear call-to-action

SCENE TYPES TO USE:
- "intro" - Opening hook, grab attention
- "problem" - Show the pain point (for ad/demo types)
- "solution" - Introduce the app as the answer
- "feature" - Highlight a specific feature
- "demo" - Show the app in action
- "testimonial" - Social proof (if applicable)
- "cta" - Call to action, closing

OUTPUT FORMAT (JSON ONLY, NO OTHER TEXT):
{
  "title": "Video title here",
  "totalDuration": ${videoLength},
  "scenes": [
    {
      "id": 1,
      "type": "intro",
      "duration": 10,
      "screenshotIndex": 0,
      "textOverlay": ["Short text", "Max 8 words"],
      "voiceover": "Natural voiceover script for this scene. Conversational tone.",
      "transition": "fade"
    }
  ],
  "callToAction": "Try ${appName} free today",
  "voiceoverStyle": "professional|casual|energetic",
  "musicMood": "upbeat|inspiring|calm|tech"
}

CRITICAL: Return ONLY valid JSON. No markdown, no code blocks, no explanation. Just the JSON object.`

    // 9. Call Claude API
    const message = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307', // Fast and cost-effective for scripts
      max_tokens: 2048,
      messages: [{
        role: 'user',
        content: prompt
      }]
    })

    // 10. Extract response text
    const responseText = message.content[0].type === 'text'
      ? message.content[0].text
      : ''

    console.log('Claude response length:', responseText.length)

    // 11. Clean response (remove markdown code blocks if present)
    let cleanedResponse = responseText
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim()

    // 12. Parse JSON
    let script
    try {
      script = JSON.parse(cleanedResponse)
    } catch (parseError) {
      console.error('JSON parse error:', parseError)
      console.error('Response was:', cleanedResponse.substring(0, 500))
      return NextResponse.json({
        success: false,
        error: 'Failed to parse AI response. Please try again.'
      }, { status: 500 })
    }

    // 13. Validate script structure
    if (!script.scenes || !Array.isArray(script.scenes)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid script format from AI. Missing scenes array.'
      }, { status: 500 })
    }

    // 14. Validate and fix scene screenshot indices
    script.scenes = script.scenes.map((scene: {
      id: number
      type: string
      duration: number
      screenshotIndex: number
      textOverlay: string[]
      voiceover: string
      transition: string
    }, index: number) => ({
      ...scene,
      id: index + 1,
      // Ensure screenshotIndex is within bounds
      screenshotIndex: screenshotCount > 0
        ? Math.min(Math.max(0, scene.screenshotIndex || 0), screenshotCount - 1)
        : null,
      // Ensure duration is reasonable
      duration: Math.min(Math.max(5, scene.duration || 10), 15)
    }))

    // 15. Calculate actual total duration
    const actualDuration = script.scenes.reduce(
      (sum: number, scene: { duration: number }) => sum + scene.duration,
      0
    )

    // 16. Add metadata
    script.metadata = {
      appName,
      appDescription,
      videoType,
      requestedLength: videoLength,
      actualLength: actualDuration,
      sceneCount: script.scenes.length,
      screenshotsAvailable: screenshotCount,
      generatedAt: new Date().toISOString(),
      tokensUsed: message.usage.input_tokens + message.usage.output_tokens
    }

    // 17. Add screenshots array to script if provided
    if (screenshots && screenshots.length > 0) {
      script.screenshots = screenshots
    }

    console.log(`Script generated: ${script.scenes.length} scenes, ${actualDuration}s total`)

    // 18. Return script
    return NextResponse.json({
      success: true,
      data: {
        script: script,
        tokensUsed: message.usage.input_tokens + message.usage.output_tokens,
        estimatedRenderTime: Math.ceil(videoLength * 2) // ~2 seconds render per second of video
      }
    })

  } catch (error) {
    console.error('Script generation error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate script'
    }, { status: 500 })
  }
}
