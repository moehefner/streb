"use client"

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Facebook,
  Instagram,
  Linkedin,
  Loader2,
  MessageSquare,
  Plus,
  Sparkles,
  Twitter,
  Video as VideoIcon,
  Youtube,
  Zap
} from 'lucide-react'

type PlatformId =
  | 'twitter'
  | 'linkedin'
  | 'tiktok'
  | 'youtube'
  | 'reddit'
  | 'instagram'
  | 'facebook'

interface OnboardingData {
  connectedPlatforms: string[]
  appName: string
  appDescription: string
  targetAudience: string
  keyFeatures: string
  appUrl: string
  githubRepoUrl: string
  samplePost: {
    text: string
    imageUrl?: string
    platform: string
  } | null
  sampleVideoUrl: string | null
  postingTone: string
  contentMixText: number
  contentMixImage: number
  postingInstructions: string
  videoType: string
  videoLength: number
  videoInstructions: string
  outreachKeywords: string
  outreachChannels: {
    twitter: boolean
    reddit: boolean
  }
  minFollowers: number
  maxResultsPerDay: number
  postFrequency: number
  videoFrequency: number
  outreachFrequency: number
}

const SUPPORTED_POST_PLATFORMS = ['twitter', 'linkedin', 'reddit', 'product_hunt'] as const
const OAUTH_PLATFORMS: Array<{ id: PlatformId; name: string; icon: typeof Twitter }> = [
  { id: 'twitter', name: 'Twitter/X', icon: Twitter },
  { id: 'linkedin', name: 'LinkedIn', icon: Linkedin },
  { id: 'tiktok', name: 'TikTok', icon: VideoIcon },
  { id: 'youtube', name: 'YouTube', icon: Youtube },
  { id: 'reddit', name: 'Reddit', icon: MessageSquare },
  { id: 'instagram', name: 'Instagram', icon: Instagram },
  { id: 'facebook', name: 'Facebook', icon: Facebook }
]

const DEFAULT_STATE: OnboardingData = {
  connectedPlatforms: [],
  appName: '',
  appDescription: '',
  targetAudience: '',
  keyFeatures: '',
  appUrl: '',
  githubRepoUrl: '',
  samplePost: null,
  sampleVideoUrl: null,
  postingTone: 'casual',
  contentMixText: 65,
  contentMixImage: 35,
  postingInstructions: '',
  videoType: 'demo',
  videoLength: 60,
  videoInstructions: '',
  outreachKeywords: '',
  outreachChannels: {
    twitter: true,
    reddit: true
  },
  minFollowers: 100,
  maxResultsPerDay: 25,
  postFrequency: 6,
  videoFrequency: 48,
  outreachFrequency: 24
}

function normalizePositiveNumber(value: string, fallback: number, min: number): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) {
    return fallback
  }
  const rounded = Math.floor(parsed)
  return rounded < min ? min : rounded
}

export default function OnboardingPage() {
  const router = useRouter()
  const [currentScreen, setCurrentScreen] = useState(1)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isGeneratingSamples, setIsGeneratingSamples] = useState(false)
  const [isCheckingPlatforms, setIsCheckingPlatforms] = useState(false)
  const [error, setError] = useState('')
  const [data, setData] = useState<OnboardingData>(DEFAULT_STATE)

  const isLoading = isSubmitting || isGeneratingSamples || isCheckingPlatforms

  const selectedPostPlatform = useMemo(() => {
    const fromConnected = data.connectedPlatforms.find((platform) =>
      SUPPORTED_POST_PLATFORMS.includes(platform as (typeof SUPPORTED_POST_PLATFORMS)[number])
    )
    return fromConnected || 'twitter'
  }, [data.connectedPlatforms])

  const checkConnectedPlatforms = useCallback(async () => {
    setIsCheckingPlatforms(true)
    try {
      const response = await fetch('/api/user/connected-platforms', {
        cache: 'no-store'
      })

      const result = await response.json()
      if (!result.success) {
        return
      }

      const normalized = Array.isArray(result.platforms)
        ? result.platforms
            .filter((platform: unknown): platform is string => typeof platform === 'string')
            .map((platform: string) => platform.toLowerCase())
        : []

      setData((prev) => ({
        ...prev,
        connectedPlatforms: normalized
      }))
    } catch (err) {
      console.error('Failed to check connected platforms:', err)
    } finally {
      setIsCheckingPlatforms(false)
    }
  }, [])

  useEffect(() => {
    checkConnectedPlatforms()
  }, [checkConnectedPlatforms])

  const generateSamples = useCallback(async () => {
    setIsGeneratingSamples(true)
    setError('')

    try {
      const postResponse = await fetch('/api/posts/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appName: data.appName,
          appDescription: data.appDescription,
          targetAudience: data.targetAudience,
          platforms: [selectedPostPlatform],
          includeImage: Math.random() > 0.5
        })
      })

      const postData = await postResponse.json()
      if (!postResponse.ok || !postData.success) {
        throw new Error(postData.error || 'Failed to generate sample post')
      }

      const platformPost = postData.posts?.[selectedPostPlatform]
      const samplePostText =
        typeof platformPost?.content === 'string' && platformPost.content.trim()
          ? platformPost.content.trim()
          : 'Sample post generated successfully.'

      let generatedImageUrl: string | undefined
      const imagePrompt =
        typeof platformPost?.imagePrompt === 'string' ? platformPost.imagePrompt.trim() : ''

      if (imagePrompt) {
        try {
          const imageResponse = await fetch('/api/posts/generate-image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              prompt: imagePrompt,
              platform: selectedPostPlatform
            })
          })

          const imageData = await imageResponse.json()
          if (imageResponse.ok && imageData.success && typeof imageData.imageUrl === 'string') {
            generatedImageUrl = imageData.imageUrl
          }
        } catch (imageError) {
          console.error('Sample image generation failed:', imageError)
        }
      }

      let sampleVideoUrl: string | null = null
      const validUrl = data.appUrl.trim()

      if (validUrl && (validUrl.startsWith('http://') || validUrl.startsWith('https://'))) {
        try {
          const videoResponse = await fetch('/api/videos/capture-screenshots', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: validUrl })
          })

          const videoData = await videoResponse.json()
          if (videoResponse.ok && videoData.success) {
            const screenshots = Array.isArray(videoData?.data?.screenshots)
              ? videoData.data.screenshots
              : []
            const first = screenshots[0]
            if (first && typeof first.url === 'string') {
              sampleVideoUrl = first.url
            }
          }
        } catch (videoError) {
          console.error('Video preview generation failed:', videoError)
        }
      }

      setData((prev) => ({
        ...prev,
        samplePost: {
          text: samplePostText,
          imageUrl: generatedImageUrl,
          platform: selectedPostPlatform
        },
        sampleVideoUrl
      }))
    } catch (err) {
      console.error('Sample generation error:', err)
      setError('Failed to generate samples. Please try again.')
    } finally {
      setIsGeneratingSamples(false)
    }
  }, [data.appDescription, data.appName, data.appUrl, data.targetAudience, selectedPostPlatform])

  useEffect(() => {
    if (currentScreen !== 3) {
      return
    }

    if (data.samplePost || data.sampleVideoUrl || isGeneratingSamples) {
      return
    }

    generateSamples()
  }, [
    currentScreen,
    data.samplePost,
    data.sampleVideoUrl,
    generateSamples,
    isGeneratingSamples
  ])

  async function handleRegenerateSamples() {
    setData((prev) => ({
      ...prev,
      samplePost: null,
      sampleVideoUrl: null
    }))
    await generateSamples()
  }

  function validateScreen(screen: number): boolean {
    switch (screen) {
      case 1:
        if (data.connectedPlatforms.length === 0) {
          setError('Please connect at least one platform')
          return false
        }
        return true
      case 2:
        if (!data.appName.trim()) {
          setError('App name is required')
          return false
        }
        if (!data.appDescription.trim() || data.appDescription.trim().length < 100) {
          setError('App description must be at least 100 characters')
          return false
        }
        if (!data.targetAudience.trim()) {
          setError('Target audience is required')
          return false
        }
        return true
      case 3:
        if (isGeneratingSamples) {
          setError('Samples are still generating, please wait')
          return false
        }
        if (!data.samplePost) {
          setError('Unable to continue without a sample post')
          return false
        }
        return true
      case 4:
        if (!data.outreachKeywords.trim()) {
          setError('Please add at least one target keyword for outreach')
          return false
        }
        if (!data.outreachChannels.twitter && !data.outreachChannels.reddit) {
          setError('Please select at least one outreach channel')
          return false
        }
        return true
      default:
        return true
    }
  }

  function handleNext() {
    setError('')
    if (!validateScreen(currentScreen)) {
      return
    }

    if (currentScreen < 5) {
      setCurrentScreen((prev) => prev + 1)
      return
    }

    handleSubmit()
  }

  function handleBack() {
    setError('')
    if (currentScreen > 1) {
      setCurrentScreen((prev) => prev - 1)
    }
  }

  async function submitConfig(endpoint: string, payload: Record<string, unknown>) {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })

    let parsed: unknown = null
    try {
      parsed = await response.json()
    } catch {
      parsed = null
    }

    return { response, parsed }
  }

  async function handleSubmit() {
    setIsSubmitting(true)
    setError('')

    try {
      const platformMap = data.connectedPlatforms.reduce((acc, platform) => {
        acc[platform] = true
        return acc
      }, {} as Record<string, boolean>)

      const payload = {
        campaignName: data.appName,
        appName: data.appName,
        appDescription: data.appDescription,
        targetAudience: data.targetAudience,
        keyFeatures: data.keyFeatures,
        appUrl: data.appUrl,
        githubRepoUrl: data.githubRepoUrl,
        postFrequency: data.postFrequency,
        videoFrequency: data.videoFrequency,
        outreachFrequency: data.outreachFrequency,
        postingTone: data.postingTone,
        contentMixText: data.contentMixText,
        contentMixImage: data.contentMixImage,
        postingInstructions: data.postingInstructions,
        videoType: data.videoType,
        videoLength: data.videoLength,
        videoInstructions: data.videoInstructions,
        outreachKeywords: data.outreachKeywords,
        outreachChannels: data.outreachChannels,
        minFollowers: data.minFollowers,
        maxResultsPerDay: data.maxResultsPerDay,
        platforms: platformMap,
        outreachPlatforms: {
          twitterDm: data.outreachChannels.twitter,
          linkedinMessage: data.connectedPlatforms.includes('linkedin'),
          email: true
        }
      }

      const primaryAttempt = await submitConfig('/api/autopilot/start', payload)
      const primaryData =
        primaryAttempt.parsed && typeof primaryAttempt.parsed === 'object'
          ? (primaryAttempt.parsed as Record<string, unknown>)
          : {}

      if (!primaryAttempt.response.ok || primaryData.success !== true) {
        const fallbackAttempt = await submitConfig('/api/autopilot/config', payload)
        const fallbackData =
          fallbackAttempt.parsed && typeof fallbackAttempt.parsed === 'object'
            ? (fallbackAttempt.parsed as Record<string, unknown>)
            : {}

        if (!fallbackAttempt.response.ok || fallbackData.success !== true) {
          const message =
            (fallbackData.error as string) ||
            (primaryData.error as string) ||
            'Failed to activate AutoPilot'
          throw new Error(message)
        }
      }

      router.push('/dashboard?onboarding=complete')
    } catch (err) {
      console.error('Submit error:', err)
      setError(err instanceof Error ? err.message : 'Failed to activate AutoPilot')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleConnectPlatform(platform: PlatformId) {
    try {
      setError('')

      const initResponse = await fetch(`/api/oauth/${platform}`, {
        method: 'GET',
        credentials: 'same-origin'
      })

      const initData = await initResponse.json().catch(() => null)
      const authUrl =
        initData && typeof initData === 'object' && 'authUrl' in initData
          ? String((initData as { authUrl?: unknown }).authUrl || '')
          : ''

      if (!authUrl) {
        throw new Error(
          (initData &&
            typeof initData === 'object' &&
            'error' in initData &&
            String((initData as { error?: unknown }).error)) ||
            `Failed to initialize ${platform} OAuth`
        )
      }

      const width = 600
      const height = 700
      const left = window.screenX + (window.outerWidth - width) / 2
      const top = window.screenY + (window.outerHeight - height) / 2

      const popup = window.open(
        authUrl,
        'Connect Platform',
        `width=${width},height=${height},left=${left},top=${top}`
      )

      if (!popup) {
        setError('Popup blocked. Please allow popups and try again.')
        return
      }

      const checkPopup = window.setInterval(() => {
        if (popup.closed) {
          window.clearInterval(checkPopup)
          checkConnectedPlatforms()
        }
      }, 500)
    } catch (oauthError) {
      console.error(`Failed to connect ${platform}:`, oauthError)
      setError(oauthError instanceof Error ? oauthError.message : `Failed to connect ${platform}`)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0A0A0A] p-8">
      <div className="w-full max-w-3xl">
        {/* Progress Bar */}
        <div className="mb-8">
          <div className="mb-4 flex items-center justify-between">
            {[1, 2, 3, 4, 5].map((step) => (
              <div
                key={step}
                className={`flex h-10 w-10 items-center justify-center rounded-full border-2 ${
                  step <= currentScreen
                    ? 'border-[#FF3D71] bg-[#FF3D71] text-white'
                    : 'border-[#404040] bg-[#141414] text-gray-500'
                }`}
              >
                {step < currentScreen ? <Check className="h-5 w-5" /> : <span>{step}</span>}
              </div>
            ))}
          </div>
          <div className="h-2 rounded-full bg-[#141414]">
            <div
              className="h-2 rounded-full bg-[#FF3D71] transition-all duration-300"
              style={{ width: `${(currentScreen / 5) * 100}%` }}
            />
          </div>
        </div>

        {/* Content */}
        <Card className="border-[#404040] bg-[#141414]">
          <CardHeader>
            <CardTitle className="text-2xl text-white">
              {currentScreen === 1 && 'Connect Your Platforms'}
              {currentScreen === 2 && 'Tell Us About Your App'}
              {currentScreen === 3 && 'Preview Your Content'}
              {currentScreen === 4 && 'Customize Your Style'}
              {currentScreen === 5 && 'Set Your Schedule'}
            </CardTitle>
            <p className="text-gray-400">
              {currentScreen === 1 && 'Which platforms should AutoPilot post to?'}
              {currentScreen === 2 && 'Help AutoPilot create amazing content'}
              {currentScreen === 3 && "Here's what AutoPilot will create for you"}
              {currentScreen === 4 && 'Make AutoPilot match your brand'}
              {currentScreen === 5 && 'How often should we run?'}
            </p>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* SCREEN 1: Connect Platforms */}
            {currentScreen === 1 && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {OAUTH_PLATFORMS.map((platform) => {
                    const Icon = platform.icon
                    const isConnected = data.connectedPlatforms.includes(platform.id)

                    return (
                      <button
                        key={platform.id}
                        onClick={() => !isConnected && handleConnectPlatform(platform.id)}
                        className={`flex items-center gap-3 rounded-lg border-2 p-6 transition-all ${
                          isConnected
                            ? 'cursor-default border-[#FF3D71] bg-[#FF3D71]/10'
                            : 'cursor-pointer border-[#404040] bg-[#1A1A1A] hover:border-[#FF3D71]'
                        }`}
                        type="button"
                      >
                        <Icon className={`h-6 w-6 ${isConnected ? 'text-[#FF3D71]' : 'text-gray-400'}`} />
                        <div className="flex-1 text-left">
                          <p className="font-medium text-white">{platform.name}</p>
                          <p className="text-sm text-gray-400">
                            {isConnected ? 'Connected' : 'Click to connect'}
                          </p>
                        </div>
                        {isConnected && <Check className="h-5 w-5 text-[#FF3D71]" />}
                      </button>
                    )
                  })}
                </div>

                <p className="text-center text-sm text-gray-500">
                  Connect at least one platform to continue
                </p>
              </div>
            )}

            {/* SCREEN 2: App Details */}
            {currentScreen === 2 && (
              <div className="space-y-4">
                <div>
                  <Label className="text-white">App Name *</Label>
                  <Input
                    value={data.appName}
                    onChange={(e) => setData((prev) => ({ ...prev, appName: e.target.value }))}
                    className="border-[#404040] bg-[#1A1A1A] text-white"
                    placeholder="TaskMaster"
                  />
                </div>

                <div>
                  <Label className="text-white">App Description * (min 100 characters)</Label>
                  <Textarea
                    value={data.appDescription}
                    onChange={(e) =>
                      setData((prev) => ({
                        ...prev,
                        appDescription: e.target.value
                      }))
                    }
                    className="min-h-[120px] border-[#404040] bg-[#1A1A1A] text-white"
                    placeholder="AI-powered to-do list that helps busy professionals prioritize tasks and boost productivity..."
                  />
                  <p className="mt-1 text-sm text-gray-500">{data.appDescription.length} / 100 characters</p>
                </div>

                <div>
                  <Label className="text-white">Target Audience *</Label>
                  <Input
                    value={data.targetAudience}
                    onChange={(e) =>
                      setData((prev) => ({
                        ...prev,
                        targetAudience: e.target.value
                      }))
                    }
                    className="border-[#404040] bg-[#1A1A1A] text-white"
                    placeholder="Freelancers, entrepreneurs, remote workers"
                  />
                </div>

                <div>
                  <Label className="text-white">Key Features (comma-separated)</Label>
                  <Textarea
                    value={data.keyFeatures}
                    onChange={(e) => setData((prev) => ({ ...prev, keyFeatures: e.target.value }))}
                    className="border-[#404040] bg-[#1A1A1A] text-white"
                    placeholder="AI prioritization, Calendar sync, Mobile app"
                  />
                </div>

                <div>
                  <Label className="text-white">App Website URL</Label>
                  <Input
                    value={data.appUrl}
                    onChange={(e) => setData((prev) => ({ ...prev, appUrl: e.target.value }))}
                    className="border-[#404040] bg-[#1A1A1A] text-white"
                    placeholder="https://taskmaster.com"
                  />
                  <p className="mt-1 text-sm text-gray-500">We&apos;ll screenshot this for video creation</p>
                </div>

                <div>
                  <Label className="text-white">GitHub Repo URL (optional)</Label>
                  <Input
                    value={data.githubRepoUrl}
                    onChange={(e) =>
                      setData((prev) => ({
                        ...prev,
                        githubRepoUrl: e.target.value
                      }))
                    }
                    className="border-[#404040] bg-[#1A1A1A] text-white"
                    placeholder="https://github.com/you/taskmaster"
                  />
                  <p className="mt-1 text-sm text-gray-500">
                    We can analyze your code for video content
                  </p>
                </div>
              </div>
            )}

            {/* SCREEN 3: Sample Preview */}
            {currentScreen === 3 && (
              <div className="space-y-6">
                {isGeneratingSamples ? (
                  <div className="py-12 text-center">
                    <Loader2 className="mx-auto mb-4 h-12 w-12 animate-spin text-[#FF3D71]" />
                    <p className="mb-2 text-lg text-white">Generating your samples...</p>
                    <p className="text-gray-400">Creating sample post</p>
                    <p className="text-gray-400">Capturing app preview</p>
                  </div>
                ) : (
                  <>
                    {data.samplePost && (
                      <div>
                        <h3 className="mb-3 flex items-center gap-2 font-semibold text-white">
                          <Sparkles className="h-5 w-5 text-[#FF3D71]" />
                          Sample Post ({data.samplePost.platform})
                        </h3>
                        <div className="rounded-lg border border-[#404040] bg-[#1A1A1A] p-4">
                          <p className="mb-3 whitespace-pre-wrap text-white">{data.samplePost.text}</p>
                          {data.samplePost.imageUrl && (
                            <img
                              src={data.samplePost.imageUrl}
                              alt="Sample post image"
                              className="w-full max-w-md rounded-lg"
                            />
                          )}
                          <p className="mt-3 text-sm text-gray-500">
                            Platforms: {data.connectedPlatforms.join(', ')}
                          </p>
                        </div>
                      </div>
                    )}

                    {data.sampleVideoUrl ? (
                      <div>
                        <h3 className="mb-3 flex items-center gap-2 font-semibold text-white">
                          <VideoIcon className="h-5 w-5 text-[#FF3D71]" />
                          Sample Video Preview
                        </h3>
                        <div className="rounded-lg border border-[#404040] bg-[#1A1A1A] p-4">
                          <img src={data.sampleVideoUrl} alt="Video preview" className="w-full rounded-lg" />
                          <p className="mt-3 text-sm text-gray-500">
                            Video platforms: TikTok, YouTube Shorts
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-lg border border-[#404040] bg-[#1A1A1A] p-4">
                        <p className="text-sm text-gray-400">
                          No video preview generated. Add a valid app URL on Screen 2 to enable video sample previews.
                        </p>
                      </div>
                    )}

                    <Button
                      onClick={handleRegenerateSamples}
                      variant="outline"
                      className="w-full border-[#404040] text-white hover:bg-white/10"
                      disabled={isGeneratingSamples}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Regenerate Samples
                    </Button>
                  </>
                )}
              </div>
            )}

            {/* SCREEN 4: Customize Style */}
            {currentScreen === 4 && (
              <div className="space-y-6">
                <div>
                  <h3 className="mb-4 font-semibold text-white">Posting Preferences</h3>

                  <div className="space-y-4">
                    <div>
                      <Label className="text-white">Tone</Label>
                      <select
                        value={data.postingTone}
                        onChange={(e) => setData((prev) => ({ ...prev, postingTone: e.target.value }))}
                        className="w-full rounded-md border border-[#404040] bg-[#1A1A1A] px-3 py-2 text-white"
                      >
                        <option value="casual">Casual &amp; Fun</option>
                        <option value="professional">Professional</option>
                        <option value="technical">Technical</option>
                        <option value="inspirational">Inspirational</option>
                      </select>
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div>
                        <Label className="text-white">
                          Text Content Mix: {data.contentMixText}%
                        </Label>
                        <input
                          type="range"
                          min={0}
                          max={100}
                          value={data.contentMixText}
                          onChange={(e) => {
                            const value = normalizePositiveNumber(e.target.value, 65, 0)
                            const bounded = Math.min(100, value)
                            setData((prev) => ({
                              ...prev,
                              contentMixText: bounded,
                              contentMixImage: 100 - bounded
                            }))
                          }}
                          className="mt-2 w-full accent-[#FF3D71]"
                        />
                      </div>

                      <div>
                        <Label className="text-white">
                          Image Content Mix: {data.contentMixImage}%
                        </Label>
                        <input
                          type="range"
                          min={0}
                          max={100}
                          value={data.contentMixImage}
                          onChange={(e) => {
                            const value = normalizePositiveNumber(e.target.value, 35, 0)
                            const bounded = Math.min(100, value)
                            setData((prev) => ({
                              ...prev,
                              contentMixImage: bounded,
                              contentMixText: 100 - bounded
                            }))
                          }}
                          className="mt-2 w-full accent-[#FF3D71]"
                        />
                      </div>
                    </div>

                    <div>
                      <Label className="text-white">Custom Instructions (optional)</Label>
                      <Textarea
                        value={data.postingInstructions}
                        onChange={(e) =>
                          setData((prev) => ({
                            ...prev,
                            postingInstructions: e.target.value
                          }))
                        }
                        className="border-[#404040] bg-[#1A1A1A] text-white"
                        placeholder="Example: Always include a question at the end."
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="mb-4 font-semibold text-white">Video Preferences</h3>

                  <div className="space-y-4">
                    <div>
                      <Label className="text-white">Video Type</Label>
                      <select
                        value={data.videoType}
                        onChange={(e) => setData((prev) => ({ ...prev, videoType: e.target.value }))}
                        className="w-full rounded-md border border-[#404040] bg-[#1A1A1A] px-3 py-2 text-white"
                      >
                        <option value="demo">Demo walkthrough</option>
                        <option value="tutorial">Tutorial</option>
                        <option value="behind-the-scenes">Behind-the-scenes</option>
                      </select>
                    </div>

                    <div>
                      <Label className="text-white">Video Length</Label>
                      <select
                        value={data.videoLength}
                        onChange={(e) =>
                          setData((prev) => ({
                            ...prev,
                            videoLength: normalizePositiveNumber(e.target.value, 60, 30)
                          }))
                        }
                        className="w-full rounded-md border border-[#404040] bg-[#1A1A1A] px-3 py-2 text-white"
                      >
                        <option value={30}>30 seconds</option>
                        <option value={60}>60 seconds</option>
                        <option value={90}>90 seconds</option>
                      </select>
                    </div>

                    <div>
                      <Label className="text-white">Custom Instructions (optional)</Label>
                      <Textarea
                        value={data.videoInstructions}
                        onChange={(e) =>
                          setData((prev) => ({
                            ...prev,
                            videoInstructions: e.target.value
                          }))
                        }
                        className="border-[#404040] bg-[#1A1A1A] text-white"
                        placeholder="Example: Open with mobile app, then show desktop flow."
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="mb-4 font-semibold text-white">Outreach Preferences</h3>

                  <div className="space-y-4">
                    <div>
                      <Label className="text-white">Target Keywords (one per line) *</Label>
                      <Textarea
                        value={data.outreachKeywords}
                        onChange={(e) =>
                          setData((prev) => ({
                            ...prev,
                            outreachKeywords: e.target.value
                          }))
                        }
                        className="min-h-[100px] border-[#404040] bg-[#1A1A1A] text-white"
                        placeholder={'looking for task manager\nneed productivity app\ntodo list recommendations'}
                      />
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          checked={data.outreachChannels.twitter}
                          onCheckedChange={(checked) =>
                            setData((prev) => ({
                              ...prev,
                              outreachChannels: {
                                ...prev.outreachChannels,
                                twitter: Boolean(checked)
                              }
                            }))
                          }
                        />
                        <Label className="text-white">Twitter DMs</Label>
                      </div>

                      <div className="flex items-center gap-2">
                        <Checkbox
                          checked={data.outreachChannels.reddit}
                          onCheckedChange={(checked) =>
                            setData((prev) => ({
                              ...prev,
                              outreachChannels: {
                                ...prev.outreachChannels,
                                reddit: Boolean(checked)
                              }
                            }))
                          }
                        />
                        <Label className="text-white">Reddit Comments</Label>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div>
                        <Label className="text-white">Min Followers (Twitter)</Label>
                        <Input
                          type="number"
                          value={data.minFollowers}
                          onChange={(e) =>
                            setData((prev) => ({
                              ...prev,
                              minFollowers: normalizePositiveNumber(e.target.value, prev.minFollowers, 0)
                            }))
                          }
                          className="border-[#404040] bg-[#1A1A1A] text-white"
                        />
                      </div>

                      <div>
                        <Label className="text-white">Max Daily Outreach</Label>
                        <Input
                          type="number"
                          value={data.maxResultsPerDay}
                          onChange={(e) =>
                            setData((prev) => ({
                              ...prev,
                              maxResultsPerDay: normalizePositiveNumber(
                                e.target.value,
                                prev.maxResultsPerDay,
                                1
                              )
                            }))
                          }
                          className="border-[#404040] bg-[#1A1A1A] text-white"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* SCREEN 5: Schedule */}
            {currentScreen === 5 && (
              <div className="space-y-6">
                <div>
                  <Label className="mb-3 block text-white">Posting Frequency</Label>
                  <div className="space-y-2">
                    {[
                      { value: 6, label: 'Every 6 hours (4 posts/day)', recommended: true },
                      { value: 12, label: 'Every 12 hours (2 posts/day)' },
                      { value: 24, label: 'Daily (1 post/day)' }
                    ].map((option) => (
                      <button
                        key={option.value}
                        onClick={() => setData((prev) => ({ ...prev, postFrequency: option.value }))}
                        className={`w-full rounded-lg border-2 p-4 text-left transition-all ${
                          data.postFrequency === option.value
                            ? 'border-[#FF3D71] bg-[#FF3D71]/10'
                            : 'border-[#404040] bg-[#1A1A1A] hover:border-[#FF3D71]'
                        }`}
                        type="button"
                      >
                        <span className="text-white">{option.label}</span>
                        {option.recommended && (
                          <span className="ml-2 text-xs text-[#FF3D71]">Recommended</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <Label className="mb-3 block text-white">Video Frequency</Label>
                  <div className="space-y-2">
                    {[
                      { value: 48, label: 'Every 2 days', recommended: true },
                      { value: 72, label: 'Every 3 days' },
                      { value: 168, label: 'Weekly' }
                    ].map((option) => (
                      <button
                        key={option.value}
                        onClick={() =>
                          setData((prev) => ({
                            ...prev,
                            videoFrequency: option.value
                          }))
                        }
                        className={`w-full rounded-lg border-2 p-4 text-left transition-all ${
                          data.videoFrequency === option.value
                            ? 'border-[#FF3D71] bg-[#FF3D71]/10'
                            : 'border-[#404040] bg-[#1A1A1A] hover:border-[#FF3D71]'
                        }`}
                        type="button"
                      >
                        <span className="text-white">{option.label}</span>
                        {option.recommended && (
                          <span className="ml-2 text-xs text-[#FF3D71]">Recommended</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <Label className="mb-3 block text-white">Outreach Frequency</Label>
                  <div className="space-y-2">
                    {[
                      { value: 24, label: 'Daily', recommended: true },
                      { value: 48, label: 'Every 2 days' },
                      { value: 168, label: 'Weekly' }
                    ].map((option) => (
                      <button
                        key={option.value}
                        onClick={() =>
                          setData((prev) => ({
                            ...prev,
                            outreachFrequency: option.value
                          }))
                        }
                        className={`w-full rounded-lg border-2 p-4 text-left transition-all ${
                          data.outreachFrequency === option.value
                            ? 'border-[#FF3D71] bg-[#FF3D71]/10'
                            : 'border-[#404040] bg-[#1A1A1A] hover:border-[#FF3D71]'
                        }`}
                        type="button"
                      >
                        <span className="text-white">{option.label}</span>
                        {option.recommended && (
                          <span className="ml-2 text-xs text-[#FF3D71]">Recommended</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Error Display */}
            {error && (
              <div className="rounded-lg border border-red-500 bg-red-500/10 p-4">
                <p className="text-red-500">{error}</p>
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="flex gap-3 pt-4">
              {currentScreen > 1 && (
                <Button
                  onClick={handleBack}
                  variant="outline"
                  className="border-[#404040] text-white hover:bg-white/10"
                  disabled={isLoading}
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back
                </Button>
              )}

              <Button
                onClick={handleNext}
                className="flex-1 bg-[#FF3D71] text-white hover:bg-[#FF3D71]/90"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {currentScreen === 5 ? 'Activating...' : 'Loading...'}
                  </>
                ) : (
                  <>
                    {currentScreen === 5 ? (
                      <>
                        <Zap className="mr-2 h-4 w-4" />
                        Activate AutoPilot
                      </>
                    ) : (
                      <>
                        Continue
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </>
                    )}
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
