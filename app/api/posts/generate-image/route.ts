import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import OpenAI from 'openai'
import { createClient } from '@supabase/supabase-js'

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!
})

// Initialize Supabase client for storage
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // Use service role key for storage uploads
)

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

    // 2. Parse request body
    const body = await req.json()
    const { prompt, platform } = body

    // 3. Validate inputs
    if (!prompt) {
      return NextResponse.json(
        { success: false, error: 'Image prompt is required' },
        { status: 400 }
      )
    }

    console.log(`Generating image for ${platform}:`, prompt)

    // 4. Call DALL-E API
    const imageResponse = await openai.images.generate({
      model: 'dall-e-3',
      prompt: prompt,
      n: 1, // Generate 1 image
      size: '1024x1024', // Square format (works for all platforms)
      quality: 'standard', // Use 'standard' not 'hd' to save costs ($0.040 vs $0.080)
      style: 'vivid' // More vibrant and hyper-real (alternative: 'natural')
    })

    if (!imageResponse.data || imageResponse.data.length === 0) {
      throw new Error('DALL-E did not return any image data')
    }

    const dalleImageUrl = imageResponse.data[0]?.url
    
    if (!dalleImageUrl) {
      throw new Error('DALL-E did not return an image URL')
    }

    console.log('DALL-E generated image:', dalleImageUrl)

    // 5. Download image from DALL-E URL (IMPORTANT: DALL-E URLs expire after 1 hour!)
    const imageDownloadResponse = await fetch(dalleImageUrl)
    if (!imageDownloadResponse.ok) {
      throw new Error('Failed to download image from DALL-E')
    }
    
    const imageBlob = await imageDownloadResponse.blob()
    const imageBuffer = await imageBlob.arrayBuffer()
    const imageBytes = new Uint8Array(imageBuffer)

    // 6. Generate unique filename
    const timestamp = Date.now()
    const randomId = Math.random().toString(36).substring(7)
    const fileName = `${userId}-${platform}-${timestamp}-${randomId}.png`

    console.log('Uploading to Supabase storage:', fileName)

    // 7. Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('post-images') // Bucket name (must exist in Supabase)
      .upload(fileName, imageBytes, {
        contentType: 'image/png',
        cacheControl: '3600',
        upsert: false
      })

    if (uploadError) {
      console.error('Supabase upload error:', uploadError)
      throw new Error(`Failed to upload image to storage: ${uploadError.message}`)
    }

    console.log('Upload successful:', uploadData)

    // 8. Get public URL (permanent URL that doesn't expire)
    const { data: publicUrlData } = supabase.storage
      .from('post-images')
      .getPublicUrl(fileName)

    const permanentImageUrl = publicUrlData.publicUrl

    if (!permanentImageUrl) {
      throw new Error('Failed to get public URL for uploaded image')
    }

    console.log('Permanent image URL:', permanentImageUrl)

    // 9. Return permanent URL
    return NextResponse.json({
      success: true,
      imageUrl: permanentImageUrl,
      fileName: fileName,
      dalleImageUrl: dalleImageUrl // Include original for debugging (expires in 1 hour)
    })

  } catch (error) {
    console.error('Generate image error:', error)
    
    // Handle specific OpenAI errors
    if (error instanceof OpenAI.APIError) {
      return NextResponse.json(
        { 
          success: false, 
          error: `OpenAI API Error: ${error.message}`,
          type: error.type,
          code: error.code
        },
        { status: error.status || 500 }
      )
    }

    // Generic error
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to generate image'
      },
      { status: 500 }
    )
  }
}
