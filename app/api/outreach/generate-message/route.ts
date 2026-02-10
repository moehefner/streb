import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import Anthropic from '@anthropic-ai/sdk'

// Type definitions
type Lead = {
  name: string
  handle?: string
  email?: string
  bio?: string
  tweet?: string
  postContent?: string
  title?: string
  company?: string
  jobTitle?: string
  platform: string
}

type MessageType = 'dm' | 'email' | 'comment'
type Tone = 'casual' | 'professional' | 'friendly'

type RequestBody = {
  lead: Lead
  appName: string
  appDescription: string
  messageType: MessageType
  tone: Tone
  maxLength?: number
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

    // 2. Check for API key
    if (!process.env.ANTHROPIC_API_KEY) {
      console.error('ANTHROPIC_API_KEY not configured')
      return NextResponse.json({
        success: false,
        error: 'AI service not configured. Please contact support.'
      }, { status: 500 })
    }

    // 3. Parse request
    const requestData: RequestBody = await req.json()
    const {
      lead,
      appName,
      appDescription,
      messageType = 'dm',
      tone = 'friendly',
      maxLength
    } = requestData

    if (!lead || !appName || !appDescription) {
      return NextResponse.json({
        success: false,
        error: 'Lead data and app info are required'
      }, { status: 400 })
    }

    if (!lead.name || !lead.platform) {
      return NextResponse.json({
        success: false,
        error: 'Lead name and platform are required'
      }, { status: 400 })
    }

    console.log(`Generating ${messageType} for ${lead.name} on ${lead.platform}`)

    // 4. Initialize Anthropic client
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY
    })

    // 5. Determine max length based on platform if not specified
    const effectiveMaxLength = maxLength || getDefaultMaxLength(messageType, lead.platform)

    // 6. Build Claude prompt based on message type
    const prompt = buildPrompt(messageType, tone, lead, appName, appDescription, effectiveMaxLength)

    // 7. Call Claude API
    const message = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307', // Fast and cheap for message generation
      max_tokens: 500,
      messages: [{
        role: 'user',
        content: prompt
      }]
    })

    // 8. Extract response
    const generatedMessage = message.content[0].type === 'text'
      ? message.content[0].text.trim()
      : ''

    if (!generatedMessage) {
      return NextResponse.json({
        success: false,
        error: 'Failed to generate message - empty response from AI'
      }, { status: 500 })
    }

    // 9. Parse subject line if email
    let subject = ''
    let messageBody = generatedMessage

    if (messageType === 'email' && generatedMessage.toLowerCase().includes('subject:')) {
      const lines = generatedMessage.split('\n')
      const subjectLineIndex = lines.findIndex(line =>
        line.toLowerCase().startsWith('subject:')
      )

      if (subjectLineIndex !== -1) {
        subject = lines[subjectLineIndex].replace(/^subject:\s*/i, '').trim()
        messageBody = lines.slice(subjectLineIndex + 1).join('\n').trim()
        // Remove leading empty lines from body
        messageBody = messageBody.replace(/^\n+/, '')
      }
    }

    // 10. Replace merge fields
    messageBody = replaceMergeFields(messageBody, lead, appName, appDescription)
    if (subject) {
      subject = replaceMergeFields(subject, lead, appName, appDescription)
    }

    // 11. Validate and truncate length if needed
    if (effectiveMaxLength && messageBody.length > effectiveMaxLength) {
      console.warn(`Generated message too long: ${messageBody.length} > ${effectiveMaxLength}, truncating`)
      messageBody = truncateToLength(messageBody, effectiveMaxLength)
    }

    console.log(`Generated ${messageType} for ${lead.name}: ${messageBody.length} chars`)

    // 12. Return generated message
    return NextResponse.json({
      success: true,
      message: {
        subject: subject,
        body: messageBody,
        length: messageBody.length,
        platform: lead.platform,
        leadName: lead.name,
        messageType: messageType,
        tone: tone
      },
      tokensUsed: message.usage.input_tokens + message.usage.output_tokens
    })

  } catch (error) {
    console.error('Message generation error:', error)

    // Handle specific Anthropic errors
    if (error instanceof Anthropic.APIError) {
      if (error.status === 429) {
        return NextResponse.json({
          success: false,
          error: 'AI rate limit exceeded. Please try again in a moment.',
          retryAfter: 60
        }, { status: 429 })
      }
      if (error.status === 401) {
        return NextResponse.json({
          success: false,
          error: 'AI authentication failed. Please contact support.'
        }, { status: 500 })
      }
    }

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate message'
    }, { status: 500 })
  }
}

// Helper: Get default max length based on message type and platform
function getDefaultMaxLength(messageType: MessageType, platform: string): number {
  if (messageType === 'dm') {
    switch (platform) {
      case 'twitter': return 10000 // Twitter DM limit
      case 'linkedin': return 300 // Keep LinkedIn DMs short
      case 'instagram': return 1000
      default: return 500
    }
  }
  if (messageType === 'comment') {
    switch (platform) {
      case 'twitter': return 280
      case 'reddit': return 10000
      case 'product_hunt': return 1000
      case 'linkedin': return 1250
      default: return 500
    }
  }
  // Email has no real limit but keep it short
  return 1500
}

// Helper: Truncate message to max length at word boundary
function truncateToLength(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text

  // Find the last space before maxLength
  const truncated = text.substring(0, maxLength - 3)
  const lastSpace = truncated.lastIndexOf(' ')

  if (lastSpace > maxLength * 0.8) {
    return truncated.substring(0, lastSpace) + '...'
  }
  return truncated + '...'
}

// Helper: Replace merge fields in message
function replaceMergeFields(
  text: string,
  lead: Lead,
  appName: string,
  appDescription: string
): string {
  return text
    .replace(/\{\{name\}\}/gi, lead.name)
    .replace(/\{\{first_name\}\}/gi, lead.name.split(' ')[0])
    .replace(/\{\{handle\}\}/gi, lead.handle || '')
    .replace(/\{\{email\}\}/gi, lead.email || '')
    .replace(/\{\{company\}\}/gi, lead.company || '')
    .replace(/\{\{job_title\}\}/gi, lead.jobTitle || '')
    .replace(/\{\{platform\}\}/gi, lead.platform)
    .replace(/\{\{app_name\}\}/gi, appName)
    .replace(/\{\{app_description\}\}/gi, appDescription)
}

// Helper: Build Claude prompt based on message type
function buildPrompt(
  messageType: MessageType,
  tone: Tone,
  lead: Lead,
  appName: string,
  appDescription: string,
  maxLength: number
): string {
  const toneDescriptions: Record<Tone, string> = {
    casual: 'casual and conversational, like texting a friend',
    professional: 'professional but warm, suitable for business communication',
    friendly: 'friendly and approachable, genuine without being too formal'
  }

  const toneDesc = toneDescriptions[tone]

  if (messageType === 'dm') {
    return `You are a marketing expert writing personalized DMs for outreach.

LEAD INFORMATION:
- Name: ${lead.name}
- Handle: @${lead.handle || 'unknown'}
- Bio: ${lead.bio || 'Not provided'}
- Recent activity: "${lead.tweet || lead.postContent || 'Not provided'}"
- Platform: ${lead.platform}

YOUR APP:
- Name: ${appName}
- Description: ${appDescription}

TASK:
Write a personalized DM to ${lead.name} about ${appName}.

TONE:
${toneDesc}

RULES:
1. Max ${maxLength} characters (must fit in DM)
2. Reference their recent activity or bio specifically - this is crucial for personalization
3. Be authentic and not salesy
4. Include clear value proposition in 1 sentence
5. End with soft CTA (not pushy)
6. NO emojis unless the lead uses them
7. NO hashtags
8. NO links (build rapport first)
9. Write as if you're a real person, not a bot
10. If you can't reference their activity, reference their industry/interests from bio

EXAMPLES OF GOOD DMs:
- "Hey Alex! Saw your tweet about struggling with task prioritization. We built TaskFlow to solve exactly that - AI auto-prioritizes your to-do list. Would love your feedback if you're interested!"
- "Sarah, loved your post about SaaS marketing challenges. We're building Streb to automate social media for indie hackers. Since you're in the space, curious if you'd find this useful?"

Write ONLY the DM text, nothing else.`
  }

  if (messageType === 'email') {
    return `You are a marketing expert writing personalized cold emails for outreach.

LEAD INFORMATION:
- Name: ${lead.name}
- Handle/Email: ${lead.handle || lead.email || 'Unknown'}
- Company: ${lead.company || 'Unknown'}
- Job Title: ${lead.jobTitle || 'Unknown'}
- Bio/Context: ${lead.bio || 'Not provided'}
- Recent activity: "${lead.tweet || lead.postContent || 'Not provided'}"
- Platform found on: ${lead.platform}

YOUR APP:
- Name: ${appName}
- Description: ${appDescription}

TASK:
Write a personalized cold email to ${lead.name} about ${appName}.

TONE:
${toneDesc}

EMAIL STRUCTURE:
Subject: [Create compelling subject line - 5-8 words]

[Body - 3-4 short paragraphs]

RULES:
1. Subject line: 5-8 words, intriguing but not clickbait, personalized if possible
2. Opening: Reference their role/company/recent activity - make it clear you researched them
3. Problem: Identify a pain point they likely have based on their context
4. Solution: How ${appName} solves it (1-2 sentences max)
5. CTA: Soft ask (feedback, demo, quick chat) - not aggressive
6. Keep total email under 150 words
7. NO buzzwords (revolutionary, game-changing, etc.)
8. NO aggressive sales language
9. NO multiple CTAs - just one clear ask
10. Sound human, not like a template

EXAMPLE FORMAT:
Subject: Quick question about [specific thing]

Hi ${lead.name.split(' ')[0]},

[Personal opening referencing their work/activity]

[Problem statement they might relate to]

[Brief solution - how ${appName} helps]

[Soft CTA]

Best,
[Sender]

Write the full email with "Subject:" on the first line.`
  }

  // Comment type
  return `You are a marketing expert writing helpful comments for Reddit/Product Hunt/social media.

CONTEXT:
- Author: ${lead.name}
- Post Title: ${lead.title || 'Unknown'}
- Post Content: "${lead.postContent || lead.tweet || 'Not provided'}"
- Platform: ${lead.platform}

YOUR APP:
- Name: ${appName}
- Description: ${appDescription}

TASK:
Write a helpful, genuine comment on their post that adds value.

TONE:
${toneDesc}

RULES:
1. Max ${maxLength} characters
2. Add genuine value FIRST (feedback, insight, question, tip)
3. Only mention ${appName} if it's naturally relevant to the conversation
4. If mentioning ${appName}, do it briefly and not as the main focus
5. Be conversational and authentic
6. NO generic "Great product!" or "Love this!" comments
7. NO direct sales pitch
8. NO "Check out our product" language
9. Ask a genuine question if appropriate
10. If ${appName} isn't relevant, just write a helpful comment without mentioning it

EXAMPLES OF GOOD COMMENTS:
- "Love the UI! One thing that helped us was adding keyboard shortcuts - increased engagement 2x. How are you handling accessibility?"
- "This is exactly what we needed 6 months ago. Curious how you're handling the multi-platform sync? We use ${appName} for a similar workflow."
- "Great point about automation. The key is finding the right balance - too much feels robotic, too little is inefficient. What's working for your team?"

Write ONLY the comment text, nothing else.`
}
