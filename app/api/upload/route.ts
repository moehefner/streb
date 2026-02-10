import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabaseAdmin } from '@/lib/supabase'

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

    // 2. Parse form data
    const formData = await req.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({
        success: false,
        error: 'No file provided'
      }, { status: 400 })
    }

    // 3. Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({
        success: false,
        error: 'File must be an image (jpg, png, webp, or gif)'
      }, { status: 400 })
    }

    // 4. Validate file size (10MB max)
    const maxSize = 10 * 1024 * 1024 // 10MB
    if (file.size > maxSize) {
      return NextResponse.json({
        success: false,
        error: 'File size must be under 10MB'
      }, { status: 400 })
    }

    // 5. Convert to buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = new Uint8Array(arrayBuffer)

    // 6. Generate filename with sanitization
    const timestamp = Date.now()
    const randomSuffix = Math.random().toString(36).substring(2, 8)
    const fileExt = file.name.split('.').pop()?.toLowerCase() || 'png'
    const sanitizedExt = ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(fileExt) ? fileExt : 'png'
    const fileName = `${userId}/screenshots/${timestamp}-${randomSuffix}.${sanitizedExt}`

    // 7. Upload to Supabase Storage
    const { error: uploadError } = await supabaseAdmin.storage
      .from('video-screenshots')
      .upload(fileName, buffer, {
        contentType: file.type,
        cacheControl: '3600',
        upsert: false
      })

    if (uploadError) {
      console.error('Upload error:', uploadError)
      return NextResponse.json({
        success: false,
        error: `Failed to upload file: ${uploadError.message}`
      }, { status: 500 })
    }

    // 8. Get public URL
    const { data: { publicUrl } } = supabaseAdmin.storage
      .from('video-screenshots')
      .getPublicUrl(fileName)

    console.log(`Uploaded screenshot: ${fileName} (${formatBytes(file.size)})`)

    // 9. Return success response
    return NextResponse.json({
      success: true,
      data: {
        url: publicUrl,
        fileName: fileName,
        fileSize: file.size,
        fileSizeFormatted: formatBytes(file.size),
        contentType: file.type
      }
    })

  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to upload file'
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
