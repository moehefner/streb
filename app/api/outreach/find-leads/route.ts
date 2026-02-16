import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'

type FindLeadsRequest = {
  keywords?: string | string[]
  industry?: string
  jobTitles?: string[]
  minEmployees?: number
  page?: number
  perPage?: number
}

type ApolloPerson = {
  first_name?: string
  last_name?: string
  email?: string
  title?: string
  linkedin_url?: string
  organization?: {
    name?: string
  }
}

type ApolloResponse = {
  people?: ApolloPerson[]
  error?: string
}

type Lead = {
  name: string
  email: string
  title: string
  company: string
  linkedinUrl: string
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

function toKeywordString(input: string | string[] | undefined): string {
  if (!input) {
    return ''
  }

  if (typeof input === 'string') {
    return input.trim()
  }

  return input
    .map((value) => value.trim())
    .filter((value) => value.length > 0)
    .join(' ')
}

function normalizeLead(person: ApolloPerson): Lead | null {
  const email = typeof person.email === 'string' ? person.email.trim() : ''
  if (!email) {
    return null
  }

  const firstName = typeof person.first_name === 'string' ? person.first_name.trim() : ''
  const lastName = typeof person.last_name === 'string' ? person.last_name.trim() : ''
  const fullName = `${firstName} ${lastName}`.trim() || 'Unknown'
  const title = typeof person.title === 'string' ? person.title.trim() : ''
  const company = typeof person.organization?.name === 'string' ? person.organization.name.trim() : ''
  const linkedinUrl = typeof person.linkedin_url === 'string' ? person.linkedin_url.trim() : ''

  return {
    name: fullName,
    email,
    title,
    company,
    linkedinUrl
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    const token = extractToken(req.headers.get('authorization'))
    const webhookSecret = process.env.N8N_WEBHOOK_SECRET

    // Allow either authenticated app user OR internal automation secret.
    if (!userId && (!token || !webhookSecret || token !== webhookSecret)) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const apolloApiKey = process.env.APOLLO_API_KEY
    if (!apolloApiKey) {
      return NextResponse.json(
        { success: false, error: 'APOLLO_API_KEY not configured' },
        { status: 500 }
      )
    }

    const body = (await req.json()) as FindLeadsRequest
    const keywords = toKeywordString(body.keywords)
    const jobTitles = Array.isArray(body.jobTitles)
      ? body.jobTitles.map((title) => title.trim()).filter((title) => title.length > 0)
      : []
    const minEmployees =
      typeof body.minEmployees === 'number' && Number.isFinite(body.minEmployees)
        ? Math.max(1, Math.floor(body.minEmployees))
        : 1
    const page = typeof body.page === 'number' && Number.isFinite(body.page) ? Math.max(1, Math.floor(body.page)) : 1
    const perPageRaw =
      typeof body.perPage === 'number' && Number.isFinite(body.perPage) ? Math.floor(body.perPage) : 25
    const perPage = Math.max(1, Math.min(perPageRaw, 100))

    if (!keywords) {
      return NextResponse.json({ success: false, error: 'keywords are required' }, { status: 400 })
    }

    const apolloResponse = await fetch('https://api.apollo.io/v1/mixed_people/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': apolloApiKey
      },
      body: JSON.stringify({
        q_keywords: keywords,
        q_organization_keyword_tags: body.industry ? [body.industry] : undefined,
        person_titles: jobTitles,
        organization_num_employees_ranges: [`${minEmployees},`],
        page,
        per_page: perPage
      })
    })

    const apolloData = (await apolloResponse.json().catch(() => ({}))) as ApolloResponse

    if (!apolloResponse.ok) {
      return NextResponse.json(
        {
          success: false,
          error: apolloData.error || `Apollo search failed with status ${apolloResponse.status}`
        },
        { status: 502 }
      )
    }

    const leads = (apolloData.people || [])
      .map(normalizeLead)
      .filter((lead): lead is Lead => Boolean(lead))

    return NextResponse.json({
      success: true,
      leads
    })
  } catch (error) {
    console.error('Find leads route error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to find leads'
      },
      { status: 500 }
    )
  }
}
