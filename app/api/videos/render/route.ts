import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabaseAdmin } from '@/lib/supabase'
import path from 'path'
import fs from 'fs'
import os from 'os'

export const runtime = 'nodejs'

// Type definitions
type UserRow = {
  id: string
  videos_used: number
  videos_limit: number
  plan_type: string
}

type SceneInput = {
  id: number
  type: string
  duration: number
  screenshotIndex: number | null
  textOverlay: string[]
  voiceover: string
  transition: string
}

type ScriptInput = {
  title: string
  totalDuration: number
  scenes: SceneInput[]
  callToAction: string
  voiceoverStyle?: string
  musicMood?: string
  metadata?: Record<string, unknown>
}

type RemotionComposition = {
  id: string
  width: number
  height: number
  durationInFrames: number
}

// Composition mapping based on video length
const COMPOSITION_MAP: Record<number, string> = {
  30: 'StrebVideo30',
  60: 'StrebVideo60',
  90: 'StrebVideo90'
}

export async function POST(req: NextRequest) {
  let outputPath: string | null = null
  let bundleLocation: string | null = null

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
    const { script, screenshots, format } = body as {
      script: ScriptInput
      screenshots: string[]
      format?: 'horizontal' | 'vertical' | 'square'
    }

    // 3. Validate script
    if (!script || !script.scenes || script.scenes.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Invalid script. Must have at least one scene.'
      }, { status: 400 })
    }

    console.log(`Rendering video: ${script.title} (${script.totalDuration}s)`)

    // 4. Get user from database
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

    // 5. Check video limits
    if (userData.videos_used >= userData.videos_limit) {
      return NextResponse.json({
        success: false,
        error: `You've reached your limit of ${userData.videos_limit} videos this month.`,
        upgradeRequired: true,
        currentPlan: userData.plan_type,
        videosUsed: userData.videos_used,
        videosLimit: userData.videos_limit
      }, { status: 403 })
    }

    // 6. Enrich script with screenshot URLs
    const enrichedScript = {
      ...script,
      scenes: script.scenes.map((scene) => ({
        ...scene,
        screenshotUrl: scene.screenshotIndex !== null && screenshots
          ? screenshots[scene.screenshotIndex] || screenshots[0] || null
          : null
      }))
    }

    // 7. Select composition based on duration and format
    let compositionId = COMPOSITION_MAP[script.totalDuration] || 'StrebVideo60'

    // Override for vertical/square formats
    if (format === 'vertical') {
      compositionId = 'StrebVideo30' // 30s is configured as vertical
    } else if (format === 'square') {
      compositionId = 'StrebVideoSquare'
    }

    console.log(`Using composition: ${compositionId}`)

    // Load Remotion at runtime to avoid Turbopack trying to bundle platform-specific binaries
    const { createRequire } = await import('module')
    const require = createRequire(import.meta.url)
    const bundlerModuleName = process.env.REMOTION_BUNDLER_MODULE ??
      String.fromCharCode(
        64, 114, 101, 109, 111, 116, 105, 111, 110, 47, 98, 117, 110, 100, 108, 101, 114
      )
    const rendererModuleName = process.env.REMOTION_RENDERER_MODULE ??
      String.fromCharCode(
        64, 114, 101, 109, 111, 116, 105, 111, 110, 47, 114, 101, 110, 100, 101, 114, 101, 114
      )
    const { bundle } = require(bundlerModuleName) as {
      bundle: (options: {
        entryPoint: string
        webpackOverride?: (config: unknown) => unknown
      }) => Promise<string>
    }
    const { renderMedia, selectComposition } = require(rendererModuleName) as {
      renderMedia: (options: {
        composition: RemotionComposition
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
      }) => Promise<RemotionComposition>
    }

    // 8. Bundle Remotion code
    console.log('Bundling Remotion code...')
    const startBundle = Date.now()

    bundleLocation = await bundle({
      entryPoint: path.join(process.cwd(), 'remotion', 'index.ts'),
      webpackOverride: (config) => config
    })

    console.log(`Bundle created in ${Date.now() - startBundle}ms`)

    // 9. Select composition
    const composition = await selectComposition({
      serveUrl: bundleLocation,
      id: compositionId,
      inputProps: {
        script: enrichedScript,
        screenshots: screenshots || []
      }
    })

    console.log(`Composition: ${composition.id} (${composition.width}x${composition.height}, ${composition.durationInFrames} frames)`)

    // 10. Prepare output path
    const timestamp = Date.now()
    const videoFileName = `${userId}-video-${timestamp}.mp4`
    outputPath = path.join(os.tmpdir(), videoFileName)

    // 11. Render video
    console.log('Starting render...')
    const startRender = Date.now()

    await renderMedia({
      composition,
      serveUrl: bundleLocation,
      codec: 'h264',
      outputLocation: outputPath,
      inputProps: {
        script: enrichedScript,
        screenshots: screenshots || []
      },
      onProgress: ({ progress }) => {
        const percent = Math.round(progress * 100)
        if (percent % 10 === 0) {
          console.log(`Render progress: ${percent}%`)
        }
      }
    })

    const renderTime = Math.round((Date.now() - startRender) / 1000)
    console.log(`Render complete in ${renderTime}s`)

    // 12. Read rendered video
    const videoBuffer = fs.readFileSync(outputPath)
    const fileSize = videoBuffer.length

    console.log(`Video size: ${formatBytes(fileSize)}`)

    // 13. Upload to Supabase Storage
    console.log('Uploading to Supabase Storage...')

    const { error: uploadError } = await supabaseAdmin.storage
      .from('rendered-videos')
      .upload(videoFileName, videoBuffer, {
        contentType: 'video/mp4',
        cacheControl: '3600',
        upsert: false
      })

    if (uploadError) {
      console.error('Upload error:', uploadError)
      throw new Error(`Failed to upload video: ${uploadError.message}`)
    }

    // 14. Get public URL
    const { data: { publicUrl } } = supabaseAdmin.storage
      .from('rendered-videos')
      .getPublicUrl(videoFileName)

    console.log('Video uploaded:', publicUrl)

    // 15. Clean up temp file
    if (outputPath && fs.existsSync(outputPath)) {
      fs.unlinkSync(outputPath)
      console.log('Temp file cleaned up')
    }

    // 16. Increment usage counter
    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({
        videos_used: userData.videos_used + 1,
        updated_at: new Date().toISOString()
      } as unknown as never)
      .eq('id', userData.id)

    if (updateError) {
      console.error('Failed to update usage counter:', updateError)
      // Don't fail the request, video is already rendered
    }

    // 17. Save video record to database
    const { error: insertError } = await supabaseAdmin
      .from('videos')
      .insert({
        user_id: userData.id,
        video_type: script.metadata?.videoType || 'demo',
        title: script.title,
        description: script.callToAction,
        input_source: 'api',
        input_data: { screenshots: screenshots || [] },
        script: enrichedScript,
        video_url: publicUrl,
        duration: script.totalDuration,
        resolution: `${composition.width}x${composition.height}`,
        status: 'ready',
        render_started_at: new Date(startRender).toISOString(),
        render_completed_at: new Date().toISOString(),
        has_watermark: userData.plan_type === 'free',
        is_autopilot: false
      } as unknown as never)

    if (insertError) {
      console.error('Failed to save video record:', insertError)
      // Don't fail the request, video is already uploaded
    }

    console.log('Video record saved to database')

    // 18. Return success response
    return NextResponse.json({
      success: true,
      data: {
        videoUrl: publicUrl,
        fileName: videoFileName,
        duration: script.totalDuration,
        resolution: `${composition.width}x${composition.height}`,
        fileSize: fileSize,
        fileSizeFormatted: formatBytes(fileSize),
        renderTimeSeconds: renderTime,
        videosUsed: userData.videos_used + 1,
        videosLimit: userData.videos_limit
      }
    })

  } catch (error) {
    console.error('Render error:', error)

    // Clean up temp file on error
    if (outputPath && fs.existsSync(outputPath)) {
      try {
        fs.unlinkSync(outputPath)
        console.log('Temp file cleaned up after error')
      } catch {
        // Ignore cleanup errors
      }
    }

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to render video'
    }, { status: 500 })
  }
}

// Helper function to format file size
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
}
