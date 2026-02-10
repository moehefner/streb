import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

type SearchMethod = 'csv' | 'api'

type UserRow = {
  id: string
  emails_used: number | null
  emails_limit: number | null
  plan_type: string | null
}

type RequestBody = {
  searchMethod?: SearchMethod
  jobTitles?: string
  companySize?: string
  industry?: string
  location?: string
  maxResults?: number
  csvData?: unknown
}

type CsvRow = {
  name?: unknown
  email?: unknown
  title?: unknown
  jobTitle?: unknown
  company?: unknown
  linkedinUrl?: unknown
  linkedin?: unknown
  bio?: unknown
}

type LinkedInLead = {
  id: string
  platform: 'linkedin'
  name: string
  email: string
  jobTitle: string
  company: string
  linkedinUrl: string | null
  profileUrl: string
  bio: string
  source: 'csv_upload'
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function asTrimmedString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function buildFallbackLinkedInUrl(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

  return `https://linkedin.com/in/${slug || 'unknown'}`
}

function normalizeMaxResults(value: number | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 50
  }
  const rounded = Math.floor(value)
  return Math.min(Math.max(rounded, 1), 500)
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
    const body = (await req.json()) as RequestBody
    const {
      searchMethod = 'csv',
      jobTitles,
      companySize,
      industry,
      location,
      maxResults,
      csvData
    } = body

    if (searchMethod !== 'csv' && searchMethod !== 'api') {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid searchMethod. Must be 'csv' or 'api'."
        },
        { status: 400 }
      )
    }

    const normalizedMaxResults = normalizeMaxResults(maxResults)

    console.log('LinkedIn lead search method:', searchMethod)
    console.log('LinkedIn filters:', {
      jobTitles: asTrimmedString(jobTitles),
      companySize: asTrimmedString(companySize),
      industry: asTrimmedString(industry),
      location: asTrimmedString(location),
      maxResults: normalizedMaxResults
    })

    // 3. Get user from database
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, emails_used, emails_limit, plan_type')
      .eq('clerk_user_id', userId)
      .single<UserRow>()

    if (userError || !userData) {
      console.error('User lookup error:', userError)
      return NextResponse.json(
        {
          success: false,
          error: 'User not found'
        },
        { status: 404 }
      )
    }

    // 4. Check limits
    const emailsUsed = userData.emails_used ?? 0
    const emailsLimit = userData.emails_limit ?? 0
    const remaining = Math.max(0, emailsLimit - emailsUsed)

    if (remaining <= 0) {
      return NextResponse.json(
        {
          success: false,
          error: `You've reached your outreach limit of ${emailsLimit} messages this month.`,
          upgradeRequired: true,
          currentPlan: userData.plan_type ?? 'free',
          emailsUsed,
          emailsLimit
        },
        { status: 403 }
      )
    }

    let leads: LinkedInLead[] = []

    // 5. Handle CSV upload method
    if (searchMethod === 'csv') {
      if (!Array.isArray(csvData) || csvData.length === 0) {
        return NextResponse.json(
          {
            success: false,
            error: 'CSV data is required for CSV upload method'
          },
          { status: 400 }
        )
      }

      const now = Date.now()
      leads = csvData
        .map((row, index) => {
          const data = row as CsvRow
          const name = asTrimmedString(data.name)
          const email = asTrimmedString(data.email).toLowerCase()

          // Basic validation
          if (!name || !email) {
            console.warn(`Row ${index} missing required fields (name, email)`)
            return null
          }

          if (!EMAIL_REGEX.test(email)) {
            console.warn(`Row ${index} has invalid email: ${email}`)
            return null
          }

          const jobTitle =
            asTrimmedString(data.title) ||
            asTrimmedString(data.jobTitle) ||
            'Unknown'
          const company = asTrimmedString(data.company) || 'Unknown'
          const linkedinUrl =
            asTrimmedString(data.linkedinUrl) || asTrimmedString(data.linkedin)
          const bio = asTrimmedString(data.bio) || `${jobTitle} at ${company}`
          const profileUrl = linkedinUrl || buildFallbackLinkedInUrl(name)

          return {
            id: `linkedin-${index}-${now}`,
            platform: 'linkedin',
            name,
            email,
            jobTitle,
            company,
            linkedinUrl: linkedinUrl || null,
            profileUrl,
            bio,
            source: 'csv_upload'
          } satisfies LinkedInLead
        })
        .filter((lead): lead is LinkedInLead => lead !== null)

      // Respect remaining outreach and requested max
      leads = leads.slice(0, Math.min(normalizedMaxResults, remaining))

      console.log(`Processed ${leads.length} valid leads from CSV`)
    } else {
      // 6. Handle API search method (future implementation)
      // LinkedIn official API is heavily restricted for lead search.
      // Planned integrations:
      // 1) PhantomBuster ($50-200/month) - best for scale
      // 2) Apify ($49/month) - good middle ground
      // 3) RapidAPI scrapers ($10-50/month) - cheaper, less reliable
      return NextResponse.json(
        {
          success: false,
          error: 'LinkedIn API search not yet implemented. Please use CSV upload for now.',
          suggestion: 'Export LinkedIn search results to CSV from Sales Navigator or LinkedIn Recruiter'
        },
        { status: 501 }
      )
    }

    // 7. Return leads with user's remaining outreach
    return NextResponse.json({
      success: true,
      leads,
      count: leads.length,
      searchMethod,
      userLimits: {
        emailsUsed,
        emailsLimit,
        remaining,
        planType: userData.plan_type ?? 'free'
      }
    })
  } catch (error) {
    console.error('LinkedIn search error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to search LinkedIn'
      },
      { status: 500 }
    )
  }
}
