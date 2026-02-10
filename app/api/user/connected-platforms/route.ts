import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

type UserRow = {
  id: string
}

type ConnectedAccountRow = {
  platform: string | null
  is_active: boolean | null
  account_username: string | null
}

export async function GET() {
  try {
    // 1. Authenticate
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 2. Get user
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('clerk_user_id', userId)
      .single<UserRow>()

    if (userError || !userData) {
      return NextResponse.json(
        {
          success: false,
          error: 'User not found'
        },
        { status: 404 }
      )
    }

    // 3. Fetch all connected active accounts
    const { data: accounts, error: accountsError } = await supabase
      .from('connected_accounts')
      .select('platform, is_active, account_username')
      .eq('user_id', userData.id)
      .eq('is_active', true)

    if (accountsError) {
      console.error('Accounts fetch error:', accountsError)
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to fetch connected platforms'
        },
        { status: 500 }
      )
    }

    const normalizedAccounts = ((accounts || []) as ConnectedAccountRow[])
      .filter((account) => account.platform && account.platform.trim().length > 0)
      .map((account) => ({
        platform: String(account.platform).trim().toLowerCase(),
        username: account.account_username ?? null
      }))

    // 4. Extract platform names (deduped)
    const platforms = Array.from(new Set(normalizedAccounts.map((account) => account.platform)))

    // 5. Also return detailed info for UI
    const details = normalizedAccounts

    // 6. Return platforms
    return NextResponse.json({
      success: true,
      platforms,
      details
    })
  } catch (error) {
    console.error('Get connected platforms error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch platforms'
      },
      { status: 500 }
    )
  }
}
