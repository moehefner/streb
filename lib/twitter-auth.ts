import type { SupabaseClient } from '@supabase/supabase-js'

type TwitterTokenPayload = {
  access_token?: string
  refresh_token?: string
  expires_in?: number
  error?: string
  error_description?: string
  detail?: string
  title?: string
}

type TwitterAccountToken = {
  access_token: string | null
  refresh_token: string | null
  token_expires_at: string | null
}

type EnsureTwitterAccessTokenOptions = {
  supabase: SupabaseClient
  userId: string
  account: TwitterAccountToken
  refreshLeewayMs?: number
}

const DEFAULT_REFRESH_LEEWAY_MS = 5 * 60 * 1000

function shouldRefreshToken(
  tokenExpiresAt: string | null,
  refreshLeewayMs: number
): boolean {
  if (!tokenExpiresAt) {
    return false
  }

  const expiryTime = new Date(tokenExpiresAt).getTime()
  if (!Number.isFinite(expiryTime)) {
    return false
  }

  return expiryTime <= Date.now() + refreshLeewayMs
}

function getTwitterClientCredentials() {
  const clientId = process.env.TWITTER_CLIENT_ID
  const clientSecret = process.env.TWITTER_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    throw new Error('Twitter OAuth client credentials are not configured')
  }

  return { clientId, clientSecret }
}

async function refreshTwitterToken(refreshToken: string) {
  const { clientId, clientSecret } = getTwitterClientCredentials()

  const response = await fetch('https://api.twitter.com/2/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId
    })
  })

  const payload = (await response.json().catch(() => ({}))) as TwitterTokenPayload

  if (!response.ok || !payload.access_token) {
    const reason =
      payload.error_description ||
      payload.error ||
      payload.detail ||
      payload.title ||
      `Token refresh failed with status ${response.status}`
    throw new Error(reason)
  }

  return payload
}

export async function ensureValidTwitterAccessToken({
  supabase,
  userId,
  account,
  refreshLeewayMs = DEFAULT_REFRESH_LEEWAY_MS
}: EnsureTwitterAccessTokenOptions): Promise<string> {
  const currentAccessToken = account.access_token?.trim()
  if (!currentAccessToken) {
    throw new Error('Twitter access token is missing')
  }

  if (!shouldRefreshToken(account.token_expires_at, refreshLeewayMs)) {
    return currentAccessToken
  }

  const refreshToken = account.refresh_token?.trim()
  if (!refreshToken) {
    throw new Error('Twitter token expired and no refresh token is available. Reconnect Twitter in Settings.')
  }

  const refreshed = await refreshTwitterToken(refreshToken)

  const nextAccessToken = refreshed.access_token!.trim()
  const nextRefreshToken = (refreshed.refresh_token || refreshToken).trim()
  const expiresIn = Number.isFinite(refreshed.expires_in) ? Number(refreshed.expires_in) : 7200
  const nextExpiresAt = new Date(Date.now() + expiresIn * 1000).toISOString()

  const { error: updateError } = await supabase
    .from('connected_accounts')
    .update({
      access_token: nextAccessToken,
      refresh_token: nextRefreshToken,
      token_expires_at: nextExpiresAt,
      updated_at: new Date().toISOString(),
      is_active: true
    } as never)
    .eq('user_id', userId)
    .eq('platform', 'twitter')

  if (updateError) {
    throw new Error(`Twitter token refresh succeeded but failed to persist tokens: ${updateError.message}`)
  }

  return nextAccessToken
}
