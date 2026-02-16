import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

type UserRow = {
  id: string
}

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('clerk_user_id', userId)
      .single<UserRow>()

    if (userError || !userData) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })
    }

    const searchParams = req.nextUrl.searchParams
    const contentType = searchParams.get('type')
    const campaignId = searchParams.get('campaign')
    const startDate = searchParams.get('start')
    const endDate = searchParams.get('end')

    let query = supabase
      .from('content_library')
      .select('*')
      .eq('user_id', userData.id)
      .order('created_at', { ascending: false })

    if (contentType) {
      query = query.eq('content_type', contentType)
    }
    if (campaignId) {
      query = query.eq('campaign_id', campaignId)
    }
    if (startDate) {
      query = query.gte('created_at', startDate)
    }
    if (endDate) {
      query = query.lte('created_at', endDate)
    }

    const { data, error } = await query
    if (error) {
      console.error('Library fetch error:', error)
      return NextResponse.json({ success: false, error: 'Failed to fetch library content' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      content: data || []
    })
  } catch (error) {
    console.error('Library route error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch library content'
      },
      { status: 500 }
    )
  }
}

