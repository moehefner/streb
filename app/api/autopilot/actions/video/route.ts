import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import chromium from '@sparticuz/chromium'
import { chromium as playwrightChromium } from 'playwright-core'
import { ensureValidTwitterAccessToken } from '@/lib/twitter-auth'
import { logger } from '@/lib/logger'
import path from 'path'
import fs from 'fs'
import os from 'os'

export const maxDuration = 300

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!
})

type WebhookActionRequest = {
  userId?: string
  campaignId?: string
  videoUrl?: string
}

type UserRow = {
  id: string
  clerk_user_id: string | null
  videos_used: number | null
  videos_limit: number | null
  plan_type: string | null
}

type ConfigRow = {
  id: string
  campaign_name: string | null
  app_name: string
  app_description: string
  target_audience: string
  app_url: string | null
  github_repo_url: string | null
  video_type: string | null
  video_length: number | null
  video_instructions: string | null
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

type RecentVideoRow = {
  video_url: string | null
  status: string | null
  created_at?: string | null
}

type ActivityRow = {
  details: Record<string, unknown> | null
}

type NormalizedScene = {
  id: number
  type: string
  duration: number
  screenshotIndex: number | null
  textOverlay: string[]
  voiceover: string
  transition: string
}

type NormalizedScript = {
  title: string
  totalDuration: number
  scenes: NormalizedScene[]
  callToAction: string
  voiceoverStyle: 'professional' | 'casual' | 'energetic'
  musicMood: 'upbeat' | 'inspiring' | 'calm' | 'tech'
  metadata: {
    appName: string
    appDescription: string
    videoType: string
    generatedAt: string
  }
}

const VIDEO_PLATFORMS = new Set([
  'twitter',
  'instagram',
  'facebook',
  'tiktok',
  'youtube',
  'youtube_shorts'
])

type TwitterMediaFinalizeResponse = {
  media_id_string?: string
  processing_info?: {
    state?: 'pending' | 'in_progress' | 'succeeded' | 'failed'
    check_after_secs?: number
    error?: { message?: string }
  }
  errors?: Array<{ message?: string }>
}

type GoogleTokenRefreshResponse = {
  access_token?: string
  expires_in?: number
  refresh_token?: string
  error?: string
  error_description?: string
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

function isHttpUrl(value: string | undefined | null): value is string {
  if (!value || typeof value !== 'string') {
    return false
  }

  try {
    const parsed = new URL(value)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function initializeTwitterVideoUpload(accessToken: string, totalBytes: number): Promise<string> {
  const initResponse = await fetch('https://upload.twitter.com/1.1/media/upload.json', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      command: 'INIT',
      total_bytes: totalBytes.toString(),
      media_type: 'video/mp4',
      media_category: 'tweet_video'
    })
  })

  const initData = (await initResponse.json().catch(() => ({}))) as {
    media_id_string?: string
    errors?: Array<{ message?: string }>
  }

  if (!initResponse.ok || !initData.media_id_string) {
    const errorMessage =
      initData.errors?.[0]?.message || `INIT failed with status ${initResponse.status}`
    throw new Error(`Twitter video INIT failed: ${errorMessage}`)
  }

  return initData.media_id_string
}

async function appendTwitterVideoChunks(
  accessToken: string,
  mediaId: string,
  videoBuffer: Buffer
): Promise<void> {
  const chunkSize = 5 * 1024 * 1024
  let segmentIndex = 0

  for (let offset = 0; offset < videoBuffer.length; offset += chunkSize) {
    const chunk = videoBuffer.subarray(offset, Math.min(offset + chunkSize, videoBuffer.length))

    const appendResponse = await fetch('https://upload.twitter.com/1.1/media/upload.json', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        command: 'APPEND',
        media_id: mediaId,
        segment_index: segmentIndex.toString(),
        media_data: chunk.toString('base64')
      })
    })

    if (!appendResponse.ok) {
      const appendText = await appendResponse.text().catch(() => 'unknown APPEND error')
      throw new Error(`Twitter video APPEND failed at segment ${segmentIndex}: ${appendText}`)
    }

    segmentIndex += 1
  }
}

async function finalizeAndWaitForTwitterVideo(
  accessToken: string,
  mediaId: string
): Promise<void> {
  const finalizeResponse = await fetch('https://upload.twitter.com/1.1/media/upload.json', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      command: 'FINALIZE',
      media_id: mediaId
    })
  })

  const finalizeData = (await finalizeResponse.json().catch(() => ({}))) as TwitterMediaFinalizeResponse

  if (!finalizeResponse.ok) {
    const finalizeError =
      finalizeData.errors?.[0]?.message || `FINALIZE failed with status ${finalizeResponse.status}`
    throw new Error(`Twitter video FINALIZE failed: ${finalizeError}`)
  }

  let processingInfo = finalizeData.processing_info
  let attempts = 0

  while (processingInfo && attempts < 20) {
    if (processingInfo.state === 'succeeded') {
      return
    }

    if (processingInfo.state === 'failed') {
      const processingError = processingInfo.error?.message || 'Twitter video processing failed'
      throw new Error(processingError)
    }

    const waitSeconds = Math.max(1, processingInfo.check_after_secs || 1)
    await sleep(waitSeconds * 1000)

    const statusUrl = `https://upload.twitter.com/1.1/media/upload.json?command=STATUS&media_id=${encodeURIComponent(mediaId)}`
    const statusResponse = await fetch(statusUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    })

    const statusData = (await statusResponse.json().catch(() => ({}))) as TwitterMediaFinalizeResponse

    if (!statusResponse.ok) {
      const statusError =
        statusData.errors?.[0]?.message || `STATUS failed with status ${statusResponse.status}`
      throw new Error(`Twitter video STATUS failed: ${statusError}`)
    }

    processingInfo = statusData.processing_info
    attempts += 1
  }

  if (processingInfo && processingInfo.state !== 'succeeded') {
    throw new Error('Twitter video processing timeout')
  }
}

async function postTwitterVideoTweet(
  accessToken: string,
  mediaId: string,
  text: string,
  username: string | null
): Promise<{ postId: string; postUrl: string }> {
  const tweetResponse = await fetch('https://api.twitter.com/2/tweets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      text,
      media: { media_ids: [mediaId] }
    })
  })

  const tweetData = (await tweetResponse.json().catch(() => ({}))) as {
    data?: { id?: string }
    detail?: string
    title?: string
    errors?: Array<{ message?: string }>
  }

  if (!tweetResponse.ok || !tweetData.data?.id) {
    const tweetError =
      tweetData.detail ||
      tweetData.title ||
      tweetData.errors?.[0]?.message ||
      `Tweet publish failed with status ${tweetResponse.status}`
    throw new Error(`Twitter video tweet failed: ${tweetError}`)
  }

  const postId = tweetData.data.id
  const cleanUsername = username?.trim() ? username.trim() : 'i'
  return {
    postId,
    postUrl: `https://x.com/${cleanUsername}/status/${postId}`
  }
}

async function publishInstagramReel(
  accessToken: string,
  instagramAccountId: string,
  videoUrl: string,
  caption: string
): Promise<{ postId: string }> {
  const containerResponse = await fetch(
    `https://graph.facebook.com/v18.0/${instagramAccountId}/media`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        video_url: videoUrl,
        caption: caption.slice(0, 2200),
        media_type: 'REELS',
        access_token: accessToken
      })
    }
  )

  const containerData = (await containerResponse.json().catch(() => ({}))) as {
    id?: string
    error?: { message?: string }
  }

  if (!containerResponse.ok || !containerData.id) {
    const createError =
      containerData.error?.message ||
      `Instagram reel container creation failed with status ${containerResponse.status}`
    throw new Error(createError)
  }

  const publishResponse = await fetch(
    `https://graph.facebook.com/v18.0/${instagramAccountId}/media_publish`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        creation_id: containerData.id,
        access_token: accessToken
      })
    }
  )

  const publishData = (await publishResponse.json().catch(() => ({}))) as {
    id?: string
    error?: { message?: string }
  }

  if (!publishResponse.ok || !publishData.id) {
    const publishError =
      publishData.error?.message ||
      `Instagram reel publish failed with status ${publishResponse.status}`
    throw new Error(publishError)
  }

  return { postId: publishData.id }
}

async function publishFacebookVideo(
  accessToken: string,
  pageId: string,
  videoUrl: string,
  description: string
): Promise<{ postId: string }> {
  const response = await fetch(`https://graph.facebook.com/v18.0/${pageId}/videos`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      file_url: videoUrl,
      description,
      access_token: accessToken
    })
  })

  const payload = (await response.json().catch(() => ({}))) as {
    id?: string
    error?: { message?: string }
  }

  if (!response.ok || !payload.id) {
    const postError =
      payload.error?.message ||
      `Facebook video publish failed with status ${response.status}`
    throw new Error(postError)
  }

  return { postId: payload.id }
}

async function refreshYouTubeAccessToken(refreshToken: string): Promise<{
  accessToken: string
  refreshToken: string | null
  expiresAt: string
}> {
  const clientId = process.env.YOUTUBE_CLIENT_ID
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    throw new Error('YOUTUBE_CLIENT_ID/YOUTUBE_CLIENT_SECRET not configured')
  }

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token'
    })
  })

  const tokenData = (await response.json().catch(() => ({}))) as GoogleTokenRefreshResponse

  if (!response.ok || !tokenData.access_token) {
    const errorMessage =
      tokenData.error_description ||
      tokenData.error ||
      `YouTube token refresh failed with status ${response.status}`
    throw new Error(errorMessage)
  }

  const expiresIn = typeof tokenData.expires_in === 'number' ? tokenData.expires_in : 3600
  const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString()

  return {
    accessToken: tokenData.access_token,
    refreshToken: tokenData.refresh_token || null,
    expiresAt
  }
}

async function ensureValidYouTubeAccessToken(options: {
  userId: string
  account: {
    access_token: string | null
    refresh_token: string | null
    token_expires_at: string | null
  }
}): Promise<string> {
  const { userId, account } = options

  if (!account.access_token) {
    throw new Error('YouTube access token missing')
  }

  const nowMs = Date.now()
  const expiresAtMs = account.token_expires_at ? new Date(account.token_expires_at).getTime() : null
  const refreshMarginMs = 5 * 60 * 1000
  const shouldRefresh =
    expiresAtMs !== null && Number.isFinite(expiresAtMs) && expiresAtMs <= nowMs + refreshMarginMs

  if (!shouldRefresh) {
    return account.access_token
  }

  if (!account.refresh_token) {
    throw new Error('YouTube token expired and no refresh token available')
  }

  const refreshed = await refreshYouTubeAccessToken(account.refresh_token)

  const updatePayload: Record<string, string> = {
    access_token: refreshed.accessToken,
    token_expires_at: refreshed.expiresAt,
    updated_at: new Date().toISOString()
  }
  if (refreshed.refreshToken) {
    updatePayload.refresh_token = refreshed.refreshToken
  }

  const { error: updateError } = await supabase
    .from('connected_accounts')
    .update(updatePayload)
    .eq('user_id', userId)
    .eq('platform', 'youtube')

  if (updateError) {
    throw new Error(`Failed to persist refreshed YouTube token: ${updateError.message}`)
  }

  return refreshed.accessToken
}

async function initializeYouTubeResumableUpload(options: {
  accessToken: string
  appName: string
  description: string
  tags: string[]
}): Promise<string> {
  const { accessToken, appName, description, tags } = options

  const response = await fetch(
    'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        snippet: {
          title: appName.slice(0, 90),
          description: description.slice(0, 5000),
          tags,
          categoryId: '22'
        },
        status: {
          privacyStatus: 'public',
          selfDeclaredMadeForKids: false
        }
      })
    }
  )

  const uploadUrl = response.headers.get('Location')
  if (!response.ok || !uploadUrl) {
    const responseText = await response.text().catch(() => 'unknown YouTube init error')
    throw new Error(`YouTube resumable init failed: ${responseText}`)
  }

  return uploadUrl
}

async function uploadYouTubeVideoBytes(uploadUrl: string, videoBuffer: Buffer): Promise<{
  postId: string
  postUrl: string
}> {
  const uploadResponse = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': 'video/mp4'
    },
    body: new Uint8Array(videoBuffer)
  })

  const uploadData = (await uploadResponse.json().catch(() => ({}))) as {
    id?: string
    error?: { message?: string }
  }

  if (!uploadResponse.ok || !uploadData.id) {
    const errorMessage =
      uploadData.error?.message || `YouTube upload failed with status ${uploadResponse.status}`
    throw new Error(errorMessage)
  }

  return {
    postId: uploadData.id,
    postUrl: `https://www.youtube.com/shorts/${uploadData.id}`
  }
}

async function initializeTikTokUpload(accessToken: string, videoSize: number): Promise<string> {
  const chunkSize = 10 * 1024 * 1024
  const totalChunks = Math.max(1, Math.ceil(videoSize / chunkSize))

  const initResponse = await fetch(
    'https://open.tiktokapis.com/v2/post/publish/inbox/video/init/',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        source_info: {
          source: 'FILE_UPLOAD',
          video_size: videoSize,
          chunk_size: chunkSize,
          total_chunk_count: totalChunks
        }
      })
    }
  )

  const initData = (await initResponse.json().catch(() => ({}))) as {
    data?: { upload_url?: string }
    error?: { message?: string }
    message?: string
  }

  const uploadUrl = initData.data?.upload_url

  if (!initResponse.ok || !uploadUrl) {
    const initError =
      initData.error?.message ||
      initData.message ||
      `TikTok upload init failed with status ${initResponse.status}`
    throw new Error(initError)
  }

  return uploadUrl
}

async function uploadTikTokVideoBuffer(uploadUrl: string, videoBuffer: Buffer): Promise<void> {
  const uploadResponse = await fetch(uploadUrl, {
    method: 'PUT',
    body: new Uint8Array(videoBuffer)
  })

  if (!uploadResponse.ok) {
    const uploadText = await uploadResponse.text().catch(() => 'unknown upload error')
    throw new Error(`TikTok upload failed: ${uploadText}`)
  }
}

async function publishTikTokVideo(
  accessToken: string,
  uploadUrl: string,
  title: string
): Promise<{ publishId?: string }> {
  const publishResponse = await fetch('https://open.tiktokapis.com/v2/post/publish/video/init/', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      post_info: {
        title: title.slice(0, 150),
        privacy_level: 'PUBLIC_TO_EVERYONE',
        disable_duet: false,
        disable_comment: false,
        disable_stitch: false,
        video_cover_timestamp_ms: 1000
      },
      source_info: {
        source: 'FILE_UPLOAD',
        video_url: uploadUrl
      }
    })
  })

  const publishData = (await publishResponse.json().catch(() => ({}))) as {
    data?: { publish_id?: string }
    error?: { message?: string }
    message?: string
  }

  if (!publishResponse.ok) {
    const publishError =
      publishData.error?.message ||
      publishData.message ||
      `TikTok publish failed with status ${publishResponse.status}`
    throw new Error(publishError)
  }

  return {
    publishId: publishData.data?.publish_id
  }
}

async function findUserByIdOrClerkId(userId: string): Promise<UserRow | null> {
  const byId = await supabase
    .from('users')
    .select('id, clerk_user_id, videos_used, videos_limit, plan_type')
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
    .select('id, clerk_user_id, videos_used, videos_limit, plan_type')
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

async function captureScreenshots(url: string): Promise<string[]> {
  const browser = await playwrightChromium.launch({
    args: chromium.args,
    executablePath: await chromium.executablePath(),
    headless: true
  })

  try {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } })
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 })

    const screenshots: string[] = []

    await page.evaluate(() => window.scrollTo(0, 0))
    await page.waitForTimeout(800)
    const topShot = await page.screenshot({ type: 'png', fullPage: false })
    screenshots.push(`data:image/png;base64,${topShot.toString('base64')}`)

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2))
    await page.waitForTimeout(800)
    const middleShot = await page.screenshot({ type: 'png', fullPage: false })
    screenshots.push(`data:image/png;base64,${middleShot.toString('base64')}`)

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    await page.waitForTimeout(800)
    const bottomShot = await page.screenshot({ type: 'png', fullPage: false })
    screenshots.push(`data:image/png;base64,${bottomShot.toString('base64')}`)

    return screenshots
  } finally {
    await browser.close()
  }
}

function normalizeScriptForRemotion(options: {
  parsedScript: Record<string, unknown> | null
  appName: string
  appDescription: string
  videoType: string
  desiredLength: number
  screenshotCount: number
}): NormalizedScript {
  const { parsedScript, appName, appDescription, videoType, desiredLength, screenshotCount } = options

  const callToActionRaw = parsedScript?.callToAction
  const titleRaw = parsedScript?.title
  const rawScenes = Array.isArray(parsedScript?.scenes) ? parsedScript.scenes : []

  const fallbackDuration = Math.max(5, Math.floor(desiredLength / Math.max(1, rawScenes.length || 3)))

  const normalizedBaseScenes: NormalizedScene[] = rawScenes.length
    ? rawScenes.map((rawScene, index) => {
        const scene = typeof rawScene === 'object' && rawScene ? (rawScene as Record<string, unknown>) : {}
        const rawDuration = typeof scene.duration === 'number' ? scene.duration : fallbackDuration
        const safeDuration = Number.isFinite(rawDuration) && rawDuration > 0 ? rawDuration : fallbackDuration

        const rawTextOverlay = Array.isArray(scene.textOverlay)
          ? scene.textOverlay.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
          : typeof scene.textOverlay === 'string' && scene.textOverlay.trim().length > 0
            ? [scene.textOverlay.trim()]
            : []

        return {
          id: typeof scene.id === 'number' ? scene.id : index + 1,
          type: typeof scene.type === 'string' && scene.type.trim().length > 0 ? scene.type : 'demo',
          duration: safeDuration,
          screenshotIndex:
            screenshotCount > 0
              ? (typeof scene.screenshotIndex === 'number' && scene.screenshotIndex >= 0
                  ? Math.floor(scene.screenshotIndex) % screenshotCount
                  : index % screenshotCount)
              : null,
          textOverlay: rawTextOverlay.length > 0 ? rawTextOverlay : [`${appName}`],
          voiceover:
            typeof scene.voiceover === 'string' && scene.voiceover.trim().length > 0
              ? scene.voiceover.trim()
              : `${appName} helps ${appDescription}`.slice(0, 180),
          transition:
            typeof scene.transition === 'string' && scene.transition.trim().length > 0
              ? scene.transition
              : 'fade'
        }
      })
    : [
        {
          id: 1,
          type: 'intro',
          duration: Math.max(5, Math.floor(desiredLength / 2)),
          screenshotIndex: screenshotCount > 0 ? 0 : null,
          textOverlay: [`Discover ${appName}`],
          voiceover: appDescription.slice(0, 180),
          transition: 'fade'
        },
        {
          id: 2,
          type: 'cta',
          duration: Math.max(5, desiredLength - Math.max(5, Math.floor(desiredLength / 2))),
          screenshotIndex: screenshotCount > 0 ? Math.min(1, screenshotCount - 1) : null,
          textOverlay: ['Try it today'],
          voiceover: `Start using ${appName} now.`,
          transition: 'slide'
        }
      ]

  const baseTotal = normalizedBaseScenes.reduce((total, scene) => total + scene.duration, 0)
  const targetTotal = Math.max(30, Math.min(90, desiredLength))
  const scale = baseTotal > 0 ? targetTotal / baseTotal : 1

  const normalizedScenes = normalizedBaseScenes.map((scene, index) => {
    const scaled = Math.max(2, Math.round(scene.duration * scale))
    if (index === normalizedBaseScenes.length - 1) {
      const beforeTotal = normalizedBaseScenes
        .slice(0, index)
        .map((s) => Math.max(2, Math.round(s.duration * scale)))
        .reduce((sum, value) => sum + value, 0)
      return {
        ...scene,
        duration: Math.max(2, targetTotal - beforeTotal)
      }
    }
    return {
      ...scene,
      duration: scaled
    }
  })

  return {
    title: typeof titleRaw === 'string' && titleRaw.trim().length > 0 ? titleRaw : `${appName} Demo`,
    totalDuration: targetTotal,
    scenes: normalizedScenes,
    callToAction:
      typeof callToActionRaw === 'string' && callToActionRaw.trim().length > 0
        ? callToActionRaw
        : `Try ${appName} today`,
    voiceoverStyle: 'professional',
    musicMood: 'upbeat',
    metadata: {
      appName,
      appDescription,
      videoType,
      generatedAt: new Date().toISOString()
    }
  }
}

function getCompositionIdByDuration(durationSeconds: number): string {
  if (durationSeconds <= 30) return 'StrebVideo30'
  if (durationSeconds <= 60) return 'StrebVideo60'
  return 'StrebVideo90'
}

async function renderVideoWithRemotion(options: {
  userId: string
  script: NormalizedScript
  screenshots: string[]
}): Promise<string> {
  const { userId, script, screenshots } = options

  const { createRequire } = await import('module')
  const require = createRequire(import.meta.url)
  const bundlerModuleName =
    process.env.REMOTION_BUNDLER_MODULE ??
    String.fromCharCode(64, 114, 101, 109, 111, 116, 105, 111, 110, 47, 98, 117, 110, 100, 108, 101, 114)
  const rendererModuleName =
    process.env.REMOTION_RENDERER_MODULE ??
    String.fromCharCode(
      64,
      114,
      101,
      109,
      111,
      116,
      105,
      111,
      110,
      47,
      114,
      101,
      110,
      100,
      101,
      114,
      101,
      114
    )

  const { bundle } = require(bundlerModuleName) as {
    bundle: (options: { entryPoint: string; webpackOverride?: (config: unknown) => unknown }) => Promise<string>
  }
  const { renderMedia, selectComposition } = require(rendererModuleName) as {
    renderMedia: (options: {
      composition: {
        id: string
        width: number
        height: number
        durationInFrames: number
      }
      serveUrl: string
      codec: string
      outputLocation: string
      inputProps: Record<string, unknown>
      onProgress?: (payload: { progress: number }) => void
    }) => Promise<void>
    selectComposition: (options: {
      serveUrl: string
      id: string
      inputProps: Record<string, unknown>
    }) => Promise<{
      id: string
      width: number
      height: number
      durationInFrames: number
    }>
  }

  const bundleLocation = await bundle({
    entryPoint: path.join(process.cwd(), 'remotion', 'index.ts'),
    webpackOverride: (config) => config
  })

  const compositionId = getCompositionIdByDuration(script.totalDuration)

  const composition = await selectComposition({
    serveUrl: bundleLocation,
    id: compositionId,
    inputProps: {
      script,
      screenshots
    }
  })

  const outputFileName = `${userId}-video-${Date.now()}.mp4`
  const outputPath = path.join(os.tmpdir(), outputFileName)

  await renderMedia({
    composition,
    serveUrl: bundleLocation,
    codec: 'h264',
    outputLocation: outputPath,
    inputProps: {
      script,
      screenshots
    }
  })

  try {
    const videoBuffer = fs.readFileSync(outputPath)
    const storagePath = outputFileName

    const { error: uploadError } = await supabase.storage
      .from('rendered-videos')
      .upload(storagePath, videoBuffer, {
        contentType: 'video/mp4',
        cacheControl: '3600',
        upsert: false
      })

    if (uploadError) {
      throw new Error(`Failed to upload rendered video: ${uploadError.message}`)
    }

    const { data: publicData } = supabase.storage.from('rendered-videos').getPublicUrl(storagePath)
    if (!isHttpUrl(publicData?.publicUrl)) {
      throw new Error('Failed to resolve public video URL after render upload')
    }

    return publicData.publicUrl
  } finally {
    if (fs.existsSync(outputPath)) {
      try {
        fs.unlinkSync(outputPath)
      } catch {
        // Ignore cleanup errors
      }
    }
  }
}

async function resolveRenderedVideoUrl(options: {
  userDbId: string
  clerkUserId: string | null
  requestUserId: string
  providedVideoUrl: string
  campaignId?: string
}): Promise<{ videoUrl: string | null; source: 'request' | 'videos_table' | 'activity' | 'storage' | 'none' }> {
  const { userDbId, clerkUserId, requestUserId, providedVideoUrl, campaignId } = options

  if (isHttpUrl(providedVideoUrl)) {
    return { videoUrl: providedVideoUrl, source: 'request' }
  }

  // 1) Primary source: latest rendered video record in videos table
  const latestVideo = await supabase
    .from('videos')
    .select('video_url, status, created_at')
    .eq('user_id', userDbId)
    .not('video_url', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle<RecentVideoRow>()

  if (latestVideo.data?.video_url && isHttpUrl(latestVideo.data.video_url)) {
    return { videoUrl: latestVideo.data.video_url, source: 'videos_table' }
  }

  // 2) Secondary source: last autopilot video activity details.renderedVideoUrl
  let activityQuery = supabase
    .from('autopilot_activity')
    .select('details')
    .eq('user_id', userDbId)
    .eq('action_type', 'video')
    .order('created_at', { ascending: false })
    .limit(5)

  if (campaignId) {
    activityQuery = activityQuery.eq('campaign_id', campaignId)
  }

  const latestActivities = await activityQuery

  if (Array.isArray(latestActivities.data)) {
    for (const item of latestActivities.data as ActivityRow[]) {
      const candidate = item?.details?.renderedVideoUrl
      if (typeof candidate === 'string' && isHttpUrl(candidate)) {
        return { videoUrl: candidate, source: 'activity' }
      }
    }
  }

  // 3) Tertiary source: latest object in rendered-videos storage bucket
  const possiblePrefixes = [requestUserId, clerkUserId || ''].filter((value) => value.trim().length > 0)
  for (const prefix of possiblePrefixes) {
    const listResult = await supabase.storage
      .from('rendered-videos')
      .list('', {
        limit: 20,
        sortBy: { column: 'name', order: 'desc' },
        search: `${prefix}-video-`
      })

    if (!listResult.error && Array.isArray(listResult.data) && listResult.data.length > 0) {
      const file = listResult.data.find((entry) => typeof entry.name === 'string' && entry.name.endsWith('.mp4'))
      if (file?.name) {
        const { data: publicData } = supabase.storage.from('rendered-videos').getPublicUrl(file.name)
        if (isHttpUrl(publicData?.publicUrl)) {
          return { videoUrl: publicData.publicUrl, source: 'storage' }
        }
      }
    }
  }

  return { videoUrl: null, source: 'none' }
}

export async function POST(req: NextRequest) {
  let requestUserId = ''
  let requestCampaignId = ''
  let attemptedPlatforms: string[] = []

  try {
    console.log('[AutoPilot Video] Starting video action...')

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

    console.log('[AutoPilot Video] Authentication successful')

    // 2. Parse request
    const body = (await req.json()) as WebhookActionRequest
    const userId = typeof body.userId === 'string' ? body.userId.trim() : ''
    const campaignId = typeof body.campaignId === 'string' ? body.campaignId.trim() : ''
    const providedVideoUrl = typeof body.videoUrl === 'string' ? body.videoUrl.trim() : ''
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

    // 3. Get user
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
    const videosUsed = toNumber(userData.videos_used, 0)
    const videosLimit = toNumber(userData.videos_limit, 3)

    if (videosUsed >= videosLimit) {
      console.log('[AutoPilot Video] Monthly limit reached')

      const { error: skipLogError } = await supabase
        .from('autopilot_activity')
        .insert({
          user_id: userData.id,
          campaign_id: config.id,
          action_type: 'video',
          action_description: 'Skipped - monthly limit reached',
          result: 'skipped',
          details: {
            videos_used: videosUsed,
            videos_limit: videosLimit,
            plan: userData.plan_type || 'free'
          }
        })

      if (skipLogError) {
        console.warn('[AutoPilot Video] Failed to log limit skip event:', skipLogError)
      }

      return NextResponse.json(
        {
          success: false,
          error: 'Monthly video limit reached',
          skipAction: true,
          upgrade_url: `${process.env.NEXT_PUBLIC_APP_URL || ''}/pricing`,
          videos_used: videosUsed,
          videos_limit: videosLimit
        },
        { status: 200 }
      )
    }

    // 6. Get connected video platforms
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

    const configuredPlatforms = Object.entries(toBooleanRecord(config.platforms))
      .filter(([, enabled]) => enabled)
      .map(([platform]) => normalizePlatform(platform))
      .filter((platform) => VIDEO_PLATFORMS.has(platform))
      .map((platform) => (platform === 'youtube_shorts' ? 'youtube' : platform))

    const selectedPlatforms = configuredPlatforms.filter((platform) => connectedPlatforms.includes(platform))
    attemptedPlatforms = selectedPlatforms

    if (selectedPlatforms.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'No connected video platforms for this campaign',
          skipAction: true
        },
        { status: 200 }
      )
    }

    // 7. Capture screenshots when app URL is available
    let screenshots: string[] = []
    const appUrl = config.app_url?.trim()

    if (appUrl) {
      try {
        new URL(appUrl)
        screenshots = await captureScreenshots(appUrl)
      } catch (screenshotError) {
        console.warn('[AutoPilot Video] Screenshot capture failed; continuing without screenshots', screenshotError)
      }
    }

    // 8. Generate script
    const desiredLength = Math.max(30, Math.min(90, toNumber(config.video_length, 60)))
    const videoType = config.video_type || 'demo'

    const prompt = `Create a short ${videoType} marketing video script for ${config.app_name}.

App description: ${config.app_description}
Target audience: ${config.target_audience}
Custom instructions: ${config.video_instructions || 'None'}
Requested length: ${desiredLength} seconds
Screenshots available: ${screenshots.length}
GitHub URL: ${config.github_repo_url || 'Not provided'}

Return ONLY valid JSON in this format:
{
  "title": "...",
  "callToAction": "...",
  "scenes": [
    { "id": 1, "textOverlay": ["..."], "voiceover": "...", "duration": 10 }
  ]
}`

    const claudeResponse = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    })

    const rawScript = claudeResponse.content[0]?.type === 'text' ? claudeResponse.content[0].text : ''
    let parsedScript: Record<string, unknown> | null = null

    try {
      parsedScript = JSON.parse(rawScript.replace(/```json/g, '').replace(/```/g, '').trim()) as Record<string, unknown>
    } catch {
      parsedScript = {
        title: `${config.app_name} Demo`,
        callToAction: `Try ${config.app_name} today`,
        scenes: [
          {
            id: 1,
            textOverlay: [`Discover ${config.app_name}`],
            voiceover: `${config.app_description}`,
            duration: desiredLength
          }
        ]
      }
    }

    // 9. Simulated render + publish metadata
    const videoPreviewUrl = screenshots[0] || null
    let autoRenderedVideoUrl: string | null = null
    const shouldAutoRender = !isHttpUrl(providedVideoUrl)

    if (shouldAutoRender) {
      try {
        const normalizedScript = normalizeScriptForRemotion({
          parsedScript,
          appName: config.app_name,
          appDescription: config.app_description,
          videoType,
          desiredLength,
          screenshotCount: screenshots.length
        })
        autoRenderedVideoUrl = await renderVideoWithRemotion({
          userId: userData.id,
          script: normalizedScript,
          screenshots
        })
        console.log('[AutoPilot Video] Auto-render completed')
      } catch (renderError) {
        logger.error('AutoPilot Video Auto-render', renderError, {
          userId,
          campaignId
        })
      }
    }

    const resolvedVideo = await resolveRenderedVideoUrl({
      userDbId: userData.id,
      clerkUserId: userData.clerk_user_id,
      requestUserId: userId,
      providedVideoUrl: autoRenderedVideoUrl || providedVideoUrl,
      campaignId: campaignId || undefined
    })
    const videoUrl = resolvedVideo.videoUrl
    let cachedVideoBuffer: Buffer | null = null

    const getVideoBuffer = async (): Promise<Buffer> => {
      if (cachedVideoBuffer) {
        return cachedVideoBuffer
      }

      if (!videoUrl) {
        throw new Error('No rendered video URL provided')
      }

      const videoResponse = await fetch(videoUrl)
      if (!videoResponse.ok) {
        throw new Error(`Failed to download rendered video (${videoResponse.status})`)
      }

      cachedVideoBuffer = Buffer.from(await videoResponse.arrayBuffer())
      return cachedVideoBuffer
    }

    const publishedPlatforms: string[] = []
    const platformResults: Record<string, unknown> = {}

    // Upload video to Twitter (chunked upload) when a rendered MP4 URL is available
    if (selectedPlatforms.includes('twitter')) {
      try {
        const twitterAccount = ((connectedAccounts || []) as ConnectedAccountRow[]).find(
          (account) => normalizePlatform(account.platform || '') === 'twitter'
        )

        if (!twitterAccount?.access_token) {
          platformResults.twitter = { success: false, error: 'Twitter account token not found' }
        } else if (!videoUrl) {
          platformResults.twitter = {
            success: false,
            error: 'No rendered video URL provided for Twitter upload'
          }
        } else {
          const validAccessToken = await ensureValidTwitterAccessToken({
            supabase,
            userId: userData.id,
            account: {
              access_token: twitterAccount.access_token,
              refresh_token: twitterAccount.refresh_token,
              token_expires_at: twitterAccount.token_expires_at
            }
          })

          const videoBuffer = await getVideoBuffer()

          const mediaId = await initializeTwitterVideoUpload(validAccessToken, videoBuffer.byteLength)
          await appendTwitterVideoChunks(validAccessToken, mediaId, videoBuffer)
          await finalizeAndWaitForTwitterVideo(validAccessToken, mediaId)

          const tweetText = `${config.app_name} demo: ${(parsedScript?.callToAction as string) || 'Try it now'}`
            .slice(0, 250)
            .trim()

          const tweetResult = await postTwitterVideoTweet(
            validAccessToken,
            mediaId,
            tweetText,
            twitterAccount.account_username
          )

          publishedPlatforms.push('twitter')
          platformResults.twitter = {
            success: true,
            mediaId,
            ...tweetResult
          }
          console.log('[AutoPilot Video] Posted to Twitter')
        }
      } catch (twitterError) {
        logger.error('AutoPilot Video Twitter upload', twitterError, {
          userId,
          campaignId
        })
        platformResults.twitter = {
          success: false,
          error:
            twitterError instanceof Error
              ? twitterError.message
              : 'Twitter video upload failed'
        }
      }
    }

    if (selectedPlatforms.includes('instagram')) {
      try {
        const instagramAccount = ((connectedAccounts || []) as ConnectedAccountRow[]).find(
          (account) => normalizePlatform(account.platform || '') === 'instagram'
        )

        if (!instagramAccount?.access_token || !instagramAccount.platform_user_id) {
          platformResults.instagram = {
            success: false,
            error: 'Instagram account token or account ID not found'
          }
        } else if (!videoUrl) {
          platformResults.instagram = {
            success: false,
            error: 'No rendered video URL provided for Instagram'
          }
        } else {
          const caption = `${config.app_name} • ${(parsedScript?.callToAction as string) || 'Try it now'}`
          const result = await publishInstagramReel(
            instagramAccount.access_token,
            instagramAccount.platform_user_id,
            videoUrl,
            caption
          )

          publishedPlatforms.push('instagram')
          platformResults.instagram = {
            success: true,
            ...result
          }
        }
      } catch (instagramError) {
        logger.error('AutoPilot Video Instagram upload', instagramError, {
          userId,
          campaignId
        })
        platformResults.instagram = {
          success: false,
          error:
            instagramError instanceof Error
              ? instagramError.message
              : 'Instagram reel upload failed'
        }
      }
    }

    if (selectedPlatforms.includes('facebook')) {
      try {
        const facebookAccount = ((connectedAccounts || []) as ConnectedAccountRow[]).find(
          (account) => normalizePlatform(account.platform || '') === 'facebook'
        )

        if (!facebookAccount?.access_token || !facebookAccount.platform_user_id) {
          platformResults.facebook = {
            success: false,
            error: 'Facebook account token or page ID not found'
          }
        } else if (!videoUrl) {
          platformResults.facebook = {
            success: false,
            error: 'No rendered video URL provided for Facebook'
          }
        } else {
          const description = `${config.app_name} demo: ${(parsedScript?.callToAction as string) || 'Try it now'}`.slice(0, 500)
          const result = await publishFacebookVideo(
            facebookAccount.access_token,
            facebookAccount.platform_user_id,
            videoUrl,
            description
          )

          publishedPlatforms.push('facebook')
          platformResults.facebook = {
            success: true,
            ...result
          }
        }
      } catch (facebookError) {
        logger.error('AutoPilot Video Facebook upload', facebookError, {
          userId,
          campaignId
        })
        platformResults.facebook = {
          success: false,
          error:
            facebookError instanceof Error
              ? facebookError.message
              : 'Facebook video upload failed'
        }
      }
    }

    if (selectedPlatforms.includes('tiktok')) {
      try {
        const tiktokAccount = ((connectedAccounts || []) as ConnectedAccountRow[]).find(
          (account) => normalizePlatform(account.platform || '') === 'tiktok'
        )

        if (!tiktokAccount?.access_token) {
          platformResults.tiktok = {
            success: false,
            error: 'TikTok account token not found'
          }
        } else if (!videoUrl) {
          platformResults.tiktok = {
            success: false,
            error: 'No rendered video URL provided for TikTok'
          }
        } else {
          const videoBuffer = await getVideoBuffer()
          const uploadUrl = await initializeTikTokUpload(
            tiktokAccount.access_token,
            videoBuffer.byteLength
          )
          await uploadTikTokVideoBuffer(uploadUrl, videoBuffer)
          const publishResult = await publishTikTokVideo(
            tiktokAccount.access_token,
            uploadUrl,
            `${config.app_name} demo`
          )

          publishedPlatforms.push('tiktok')
          platformResults.tiktok = {
            success: true,
            uploadUrl,
            ...publishResult
          }
        }
      } catch (tiktokError) {
        logger.error('AutoPilot Video TikTok upload', tiktokError, {
          userId,
          campaignId
        })
        platformResults.tiktok = {
          success: false,
          error:
            tiktokError instanceof Error ? tiktokError.message : 'TikTok video upload failed'
        }
      }
    }

    if (selectedPlatforms.includes('youtube')) {
      try {
        const youtubeAccount = ((connectedAccounts || []) as ConnectedAccountRow[]).find(
          (account) => normalizePlatform(account.platform || '') === 'youtube'
        )

        if (!youtubeAccount?.access_token) {
          platformResults.youtube = {
            success: false,
            error: 'YouTube account token not found'
          }
        } else if (!videoUrl) {
          platformResults.youtube = {
            success: false,
            error: 'No rendered video URL provided for YouTube upload'
          }
        } else {
          const validAccessToken = await ensureValidYouTubeAccessToken({
            userId: userData.id,
            account: {
              access_token: youtubeAccount.access_token,
              refresh_token: youtubeAccount.refresh_token,
              token_expires_at: youtubeAccount.token_expires_at
            }
          })

          const videoBuffer = await getVideoBuffer()
          const scriptSummary =
            (parsedScript?.callToAction as string) ||
            (parsedScript?.title as string) ||
            `${config.app_name} demo`

          const uploadUrl = await initializeYouTubeResumableUpload({
            accessToken: validAccessToken,
            appName: `${config.app_name} - ${scriptSummary}`.slice(0, 100),
            description: `${scriptSummary}\n\n#shorts #${config.app_name.toLowerCase().replace(/\s+/g, '')}`,
            tags: ['shorts', config.app_name.toLowerCase().replace(/\s+/g, '')]
          })

          const uploadResult = await uploadYouTubeVideoBytes(uploadUrl, videoBuffer)

          publishedPlatforms.push('youtube')
          platformResults.youtube = {
            success: true,
            ...uploadResult
          }
        }
      } catch (youtubeError) {
        logger.error('AutoPilot Video YouTube upload', youtubeError, {
          userId,
          campaignId
        })
        platformResults.youtube = {
          success: false,
          error:
            youtubeError instanceof Error ? youtubeError.message : 'YouTube video upload failed'
        }
      }
    }

    for (const platform of selectedPlatforms) {
      if (
        platform === 'twitter' ||
        platform === 'instagram' ||
        platform === 'facebook' ||
        platform === 'tiktok' ||
        platform === 'youtube'
      ) {
        continue
      }

      platformResults[platform] = {
        success: false,
        error: `AutoPilot video publishing for ${platform} is not implemented yet`
      }
    }

    // 10. Log activity
    const actionDescription =
      publishedPlatforms.length > 0
        ? `Created and posted video to ${publishedPlatforms.join(', ')}`
        : `Created video for ${selectedPlatforms.join(', ')}`

    const { error: activityError } = await supabase.from('autopilot_activity').insert({
      user_id: userData.id,
      campaign_id: config.id,
      action_type: 'video',
      action_description: actionDescription,
      platforms: publishedPlatforms.length > 0 ? publishedPlatforms : selectedPlatforms,
      result: publishedPlatforms.length > 0 ? 'success' : 'partial',
      details: {
        videoTitle: parsedScript?.title || `${config.app_name} Video`,
        screenshotCount: screenshots.length,
        renderStatus: videoUrl ? 'resolved' : 'missing_video_url',
        videoUrlSource: resolvedVideo.source,
        previewAvailable: Boolean(videoPreviewUrl),
        renderedVideoUrl: videoUrl,
        selectedPlatforms,
        publishedPlatforms,
        platformResults
      }
    })

    if (activityError) {
      throw activityError
    }

    // 11. Update usage
    const newVideosUsed = videosUsed + 1
    const { error: usageError } = await supabase
      .from('users')
      .update({
        videos_used: newVideosUsed,
        updated_at: new Date().toISOString()
      })
      .eq('id', userData.id)

    if (usageError) {
      throw usageError
    }

    // 12. Save generated video to content library (non-blocking)
    const { error: libraryError } = await supabase
      .from('content_library')
      .insert({
        user_id: userData.id,
        campaign_id: config.id,
        content_type: 'video',
        text_content: JSON.stringify(parsedScript),
        video_url: videoUrl,
        platforms: publishedPlatforms,
        posted_at: new Date().toISOString()
      })

    if (libraryError) {
      console.warn('[AutoPilot Video] Failed to save content library entry:', libraryError)
    }

    const { error: timestampError } = await supabase
      .from('autopilot_configs')
      .update({ last_video_at: new Date().toISOString() })
      .eq('id', config.id)

    if (timestampError) {
      throw timestampError
    }

    // 13. Return success
    return NextResponse.json({
      success: true,
      video: {
        title: (parsedScript?.title as string) || `${config.app_name} Video`,
        script: parsedScript,
        previewUrl: videoPreviewUrl,
        renderedVideoUrl: videoUrl,
        screenshotsCaptured: screenshots.length
      },
      platforms: selectedPlatforms,
      publishedPlatforms,
      platformResults,
      videosUsed: newVideosUsed,
      videosLimit
    })
  } catch (error) {
    logger.error('AutoPilot Video', error, {
      userId: requestUserId || null,
      campaignId: requestCampaignId || null,
      platforms: attemptedPlatforms
    })
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create video'
      },
      { status: 500 }
    )
  }
}
