import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import chromium from '@sparticuz/chromium'
import { chromium as playwrightChromium } from 'playwright-core'

export const maxDuration = 60 // 60 seconds timeout for screenshot capture

export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 2. Parse request
    const body = await req.json()
    const { url } = body

    if (!url) {
      return NextResponse.json({
        success: false,
        error: 'URL is required'
      }, { status: 400 })
    }

    // Validate URL format
    try {
      new URL(url)
    } catch {
      return NextResponse.json({
        success: false,
        error: 'Invalid URL format'
      }, { status: 400 })
    }

    console.log('[Screenshots] Capturing screenshots for:', url)

    // 3. Launch browser with @sparticuz/chromium
    const browser = await playwrightChromium.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: true
    })

    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 }
    })

    const page = await context.newPage()

    // 4. Navigate to URL
    try {
      await page.goto(url, {
        waitUntil: 'networkidle',
        timeout: 30000
      })
    } catch (navError) {
      console.error('[Screenshots] Navigation error:', navError)
      await browser.close()
      return NextResponse.json({
        success: false,
        error: 'Failed to load URL - please check if URL is accessible'
      }, { status: 400 })
    }

    // 5. Take screenshots (3 different sections)
    const screenshots: string[] = []

    try {
      // Screenshot 1: Top of page
      await page.evaluate(() => window.scrollTo(0, 0))
      await page.waitForTimeout(1000)
      const screenshot1 = await page.screenshot({ 
        type: 'png',
        fullPage: false
      })
      screenshots.push(`data:image/png;base64,${screenshot1.toString('base64')}`)
      console.log('[Screenshots] Captured screenshot 1/3')

      // Screenshot 2: Middle of page
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2))
      await page.waitForTimeout(1000)
      const screenshot2 = await page.screenshot({ 
        type: 'png',
        fullPage: false
      })
      screenshots.push(`data:image/png;base64,${screenshot2.toString('base64')}`)
      console.log('[Screenshots] Captured screenshot 2/3')

      // Screenshot 3: Bottom of page
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
      await page.waitForTimeout(1000)
      const screenshot3 = await page.screenshot({ 
        type: 'png',
        fullPage: false
      })
      screenshots.push(`data:image/png;base64,${screenshot3.toString('base64')}`)
      console.log('[Screenshots] Captured screenshot 3/3')

    } catch (screenshotError) {
      console.error('[Screenshots] Capture error:', screenshotError)
      await browser.close()
      return NextResponse.json({
        success: false,
        error: 'Failed to capture screenshots'
      }, { status: 500 })
    }

    // 6. Close browser
    await browser.close()

    console.log('[Screenshots] Successfully captured all screenshots')

    // 7. Return screenshots
    return NextResponse.json({
      success: true,
      screenshots: screenshots
    })

  } catch (error) {
    console.error('[Screenshots] Unexpected error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to capture screenshots'
    }, { status: 500 })
  }
}
