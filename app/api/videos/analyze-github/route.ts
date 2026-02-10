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

    // 2. Parse request
    const body = await req.json()
    const { githubUrl } = body

    if (!githubUrl || !githubUrl.startsWith('https://github.com/')) {
      return NextResponse.json({
        success: false,
        error: 'Invalid GitHub URL. Must start with https://github.com/'
      }, { status: 400 })
    }

    // 3. Extract owner and repo from URL
    // Example: https://github.com/vercel/next.js -> owner: vercel, repo: next.js
    const urlParts = githubUrl.replace('https://github.com/', '').split('/')
    const owner = urlParts[0]
    const repo = urlParts[1]?.replace('.git', '')

    if (!owner || !repo) {
      return NextResponse.json({
        success: false,
        error: 'Invalid GitHub URL format. Expected: https://github.com/owner/repo'
      }, { status: 400 })
    }

    console.log(`Analyzing GitHub repo: ${owner}/${repo}`)

    // 4. Get user's GitHub access token
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

    type AccountRow = { access_token: string }
    const { data: githubAccount } = await supabaseAdmin
      .from('connected_accounts')
      .select('access_token')
      .eq('user_id', userData.id)
      .eq('platform', 'github')
      .eq('is_active', true)
      .single<AccountRow>()

    // If no GitHub connected, try public API (no auth required for public repos)
    const headers: Record<string, string> = {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'Streb-Video-Generator'
    }

    if (githubAccount?.access_token) {
      headers['Authorization'] = `Bearer ${githubAccount.access_token}`
      console.log('Using authenticated GitHub API')
    } else {
      console.log('Using public GitHub API (no auth)')
    }

    // 5. Fetch repo details
    const repoResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
      headers: headers
    })

    if (!repoResponse.ok) {
      if (repoResponse.status === 404) {
        return NextResponse.json({
          success: false,
          error: 'Repository not found or is private. Connect your GitHub account to access private repos.'
        }, { status: 404 })
      }

      if (repoResponse.status === 403) {
        return NextResponse.json({
          success: false,
          error: 'Access denied. This may be a private repo. Please connect your GitHub account in Settings.'
        }, { status: 403 })
      }

      const errorData = await repoResponse.json()
      console.error('GitHub API error:', errorData)
      return NextResponse.json({
        success: false,
        error: `GitHub API error: ${errorData.message || 'Unknown error'}`
      }, { status: repoResponse.status })
    }

    const repoData = await repoResponse.json()

    // 6. Fetch README.md
    let readmeContent = ''
    let appDescription = repoData.description || ''
    let keyFeatures: string[] = []

    try {
      const readmeResponse = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/readme`,
        { headers: headers }
      )

      if (readmeResponse.ok) {
        const readmeData = await readmeResponse.json()

        // README content is base64 encoded
        readmeContent = Buffer.from(readmeData.content, 'base64').toString('utf-8')

        console.log('README fetched successfully, length:', readmeContent.length)

        // Extract description from README if repo description is empty
        if (!appDescription) {
          // Try to find description in README (usually first paragraph)
          const lines = readmeContent.split('\n')
          for (const line of lines) {
            const trimmed = line.trim()
            // Skip headers, images, badges, and short lines
            if (
              trimmed &&
              !trimmed.startsWith('#') &&
              !trimmed.startsWith('!') &&
              !trimmed.startsWith('[') &&
              !trimmed.startsWith('<') &&
              trimmed.length > 50
            ) {
              appDescription = trimmed
              break
            }
          }
        }

        // Extract features from README
        // Look for sections like "Features", "Key Features", "What it does", etc.
        const featureSectionMatch = readmeContent.match(
          /##?\s*(Features?|Key Features?|What (it|we) (does?|offers?)|Capabilities|Highlights)/i
        )

        if (featureSectionMatch) {
          const sectionIndex = readmeContent.indexOf(featureSectionMatch[0])
          const afterSection = readmeContent.substring(sectionIndex)
          const nextSectionMatch = afterSection.substring(featureSectionMatch[0].length).search(/\n##/)
          const featureText = nextSectionMatch > 0
            ? afterSection.substring(0, nextSectionMatch + featureSectionMatch[0].length)
            : afterSection.substring(0, 2000) // Limit to prevent huge parsing

          // Extract bullet points (- or * or numbered lists)
          const bulletMatches = featureText.match(/^[\s]*[-*]\s+(.+)$/gm) ||
            featureText.match(/^\d+\.\s+(.+)$/gm) ||
            []

          keyFeatures = bulletMatches
            .map(b => b.replace(/^[\s]*[-*]\s+/, '').replace(/^\d+\.\s+/, '').trim())
            .filter(f => f.length > 10 && f.length < 200)
            .filter(f => !f.startsWith('[') && !f.startsWith('!')) // Skip links and images
            .slice(0, 5) // Max 5 features
        }
      }
    } catch (error) {
      console.warn('Could not fetch README:', error)
      // Continue without README - not a fatal error
    }

    // 7. Fallback description if still empty
    if (!appDescription) {
      appDescription = `A software project called ${repoData.name}`
    }

    // 8. Get primary language
    const primaryLanguage = repoData.language || 'Unknown'

    // 9. Get tech stack from topics/tags
    const techStack: string[] = repoData.topics || []

    // 10. Return structured data
    return NextResponse.json({
      success: true,
      data: {
        repoName: repoData.name,
        repoFullName: repoData.full_name,
        appDescription: appDescription,
        keyFeatures: keyFeatures,
        primaryLanguage: primaryLanguage,
        techStack: techStack,
        stars: repoData.stargazers_count,
        forks: repoData.forks_count,
        homepage: repoData.homepage || null,
        defaultBranch: repoData.default_branch,
        hasReadme: readmeContent.length > 0,
        isPrivate: repoData.private
      }
    })

  } catch (error) {
    console.error('GitHub analysis error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to analyze GitHub repo'
    }, { status: 500 })
  }
}
