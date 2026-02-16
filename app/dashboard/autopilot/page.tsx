"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  Clock,
  Pause,
  Play,
  Settings,
  Zap,
} from "lucide-react"

type PostPlatformKey =
  | "twitter"
  | "linkedin"
  | "reddit"
  | "productHunt"
  | "instagram"
  | "facebook"
  | "threads"

type VideoPlatformKey = "tiktok" | "youtube"
type OutreachPlatformKey = "twitterDm" | "linkedinMessage" | "email"

interface AutoPilotConfig {
  id?: string
  appName: string
  appDescription: string
  targetAudience: string
  keyFeatures: string
  appUrl: string
  githubRepoUrl: string
  postFrequency: number
  videoFrequency: number
  outreachFrequency: number
  platforms: Record<PostPlatformKey | VideoPlatformKey, boolean>
  outreachPlatforms: Record<OutreachPlatformKey, boolean>
  outreachKeywords: string
  minFollowers: number
  maxResultsPerDay: number
}

interface AutoPilotStatus {
  isActive: boolean
  isPaused: boolean
  limitsReached: boolean
  nextAction: string
  nextActionTime: string
}

interface ActivityLog {
  id: string
  action: string
  timestamp: string
  type: "post" | "video" | "outreach"
}

interface UserLimits {
  postsUsed: number
  postsLimit: number
  videosUsed: number
  videosLimit: number
  emailsUsed: number
  emailsLimit: number
  planType: string
}

const POST_PLATFORM_OPTIONS: Array<{
  key: PostPlatformKey
  label: string
  connectionKeys: string[]
}> = [
  { key: "twitter", label: "Twitter/X", connectionKeys: ["twitter", "x"] },
  { key: "linkedin", label: "LinkedIn", connectionKeys: ["linkedin"] },
  { key: "reddit", label: "Reddit", connectionKeys: ["reddit"] },
  {
    key: "productHunt",
    label: "Product Hunt",
    connectionKeys: ["producthunt", "product_hunt"],
  },
  { key: "instagram", label: "Instagram", connectionKeys: ["instagram"] },
  { key: "facebook", label: "Facebook", connectionKeys: ["facebook"] },
  { key: "threads", label: "Threads", connectionKeys: ["threads"] },
]

const VIDEO_PLATFORM_OPTIONS: Array<{
  key: VideoPlatformKey
  label: string
  connectionKeys: string[]
}> = [
  { key: "tiktok", label: "TikTok", connectionKeys: ["tiktok"] },
  { key: "youtube", label: "YouTube Shorts", connectionKeys: ["youtube", "youtube_shorts"] },
]

const OUTREACH_PLATFORM_OPTIONS: Array<{
  key: OutreachPlatformKey
  label: string
  connectionKeys: string[]
}> = [
  { key: "twitterDm", label: "Twitter DMs", connectionKeys: ["twitter", "x"] },
  { key: "linkedinMessage", label: "LinkedIn Messages", connectionKeys: ["linkedin"] },
  { key: "email", label: "Email", connectionKeys: ["email"] },
]

const DEFAULT_FORM_DATA: AutoPilotConfig = {
  appName: "",
  appDescription: "",
  targetAudience: "",
  keyFeatures: "",
  appUrl: "",
  githubRepoUrl: "",
  postFrequency: 6,
  videoFrequency: 48,
  outreachFrequency: 24,
  platforms: {
    twitter: false,
    linkedin: false,
    reddit: false,
    productHunt: false,
    instagram: false,
    facebook: false,
    threads: false,
    tiktok: false,
    youtube: false,
  },
  outreachPlatforms: {
    twitterDm: false,
    linkedinMessage: false,
    email: false,
  },
  outreachKeywords: "",
  minFollowers: 100,
  maxResultsPerDay: 25,
}

const DEFAULT_STATUS: AutoPilotStatus = {
  isActive: false,
  isPaused: false,
  limitsReached: false,
  nextAction: "",
  nextActionTime: "",
}

const DEFAULT_LIMITS: UserLimits = {
  postsUsed: 0,
  postsLimit: 5,
  videosUsed: 0,
  videosLimit: 3,
  emailsUsed: 0,
  emailsLimit: 25,
  planType: "free",
}

function safeNumber(value: unknown, fallback: number) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function parsePositiveInt(value: string, fallback: number) {
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback
}

function getNextMonthDateLabel() {
  const now = new Date()
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  return nextMonth.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  })
}

function formatDate(dateString?: string) {
  if (!dateString) return "N/A"
  const date = new Date(dateString)
  if (Number.isNaN(date.getTime())) return "N/A"
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function getFrequencyText(hours: number) {
  if (hours <= 0) return "Not scheduled"
  if (hours === 24) return "Daily"
  if (hours === 168) return "Weekly"
  return `Every ${hours} hours`
}

function getNextTier(currentPlan: string): string {
  const tiers = {
    free: "Starter ($49/mo)",
    starter: "Pro ($99/mo)",
    pro: "Agency ($249/mo)",
    agency: "Enterprise (contact sales)",
  }
  return tiers[currentPlan as keyof typeof tiers] || "a higher plan"
}

function getNextPlanSlug(currentPlan: string): "starter" | "pro" | "agency" {
  const normalized = (currentPlan || "free").toLowerCase()
  if (normalized === "free") return "starter"
  if (normalized === "starter") return "pro"
  return "agency"
}

function normalizeConnectedPlatforms(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((entry) => {
      if (typeof entry === "string") return entry.toLowerCase()
      if (entry && typeof entry === "object" && "platform" in entry) {
        const platformValue = (entry as { platform?: unknown }).platform
        return typeof platformValue === "string" ? platformValue.toLowerCase() : null
      }
      return null
    })
    .filter((value): value is string => Boolean(value))
}

function hasAllLimitsReached(limits: UserLimits) {
  return (
    limits.postsUsed >= limits.postsLimit &&
    limits.videosUsed >= limits.videosLimit &&
    limits.emailsUsed >= limits.emailsLimit
  )
}

function ProgressBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="w-full bg-[#1A1A1A] rounded-full h-2 mt-2">
      <div
        className={`h-2 rounded-full ${color}`}
        style={{
          width: `${Math.min(Math.max(value, 0), 100)}%`,
        }}
      />
    </div>
  )
}

export default function AutoPilotPage() {
  const router = useRouter()
  const [config, setConfig] = useState<AutoPilotConfig | null>(null)
  const [status, setStatus] = useState<AutoPilotStatus>(DEFAULT_STATUS)
  const [activityLog, setActivityLog] = useState<ActivityLog[]>([])
  const [userLimits, setUserLimits] = useState<UserLimits>(DEFAULT_LIMITS)
  const [connectedPlatforms, setConnectedPlatforms] = useState<string[]>([])
  const [isCheckingOnboarding, setIsCheckingOnboarding] = useState(true)
  const [hasNoCampaigns, setHasNoCampaigns] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formData, setFormData] = useState<AutoPilotConfig>(DEFAULT_FORM_DATA)

  const connectedPlatformSet = useMemo(
    () => new Set(connectedPlatforms.map((p) => p.toLowerCase())),
    [connectedPlatforms]
  )

  const inferredLimitsReached = useMemo(() => hasAllLimitsReached(userLimits), [userLimits])
  const effectiveLimitsReached = status.limitsReached || inferredLimitsReached

  useEffect(() => {
    checkOnboardingStatusAndLoad()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function checkOnboardingStatusAndLoad() {
    setIsCheckingOnboarding(true)
    try {
      const response = await fetch("/api/campaigns/list", { cache: "no-store" })
      const data = await response.json().catch(() => null)

      if (response.ok && data?.success && Array.isArray(data.campaigns) && data.campaigns.length === 0) {
        setHasNoCampaigns(true)
        router.replace("/onboarding")
        return
      }

      setHasNoCampaigns(false)
      await fetchAutoPilotData()
    } catch (checkError) {
      console.error("Failed to check onboarding status:", checkError)
      await fetchAutoPilotData()
    } finally {
      setIsCheckingOnboarding(false)
    }
  }

  async function fetchAutoPilotData() {
    setIsLoading(true)
    setError(null)

    try {
      const [limitsRes, platformsRes, configRes, statusRes, activityRes] = await Promise.all([
        fetch("/api/user/limits"),
        fetch("/api/user/connected-platforms"),
        fetch("/api/autopilot/config"),
        fetch("/api/autopilot/status"),
        fetch("/api/autopilot/activity"),
      ])

      const limitsData = await limitsRes.json().catch(() => null)
      if (limitsRes.ok && limitsData?.success) {
        setUserLimits({
          postsUsed: safeNumber(limitsData.posts_used, 0),
          postsLimit: safeNumber(limitsData.posts_limit, 5),
          videosUsed: safeNumber(limitsData.videos_used, 0),
          videosLimit: safeNumber(limitsData.videos_limit, 3),
          emailsUsed: safeNumber(limitsData.emails_used, 0),
          emailsLimit: safeNumber(limitsData.emails_limit, 25),
          planType: typeof limitsData.plan_type === "string" ? limitsData.plan_type : "free",
        })
      }

      const platformsData = await platformsRes.json().catch(() => null)
      if (platformsRes.ok && platformsData?.success) {
        setConnectedPlatforms(normalizeConnectedPlatforms(platformsData.platforms))
      } else {
        setConnectedPlatforms([])
      }

      const configData = await configRes.json().catch(() => null)
      if (configRes.ok && configData?.success && configData.config) {
        const incomingConfig = configData.config as AutoPilotConfig
        setConfig(incomingConfig)
        setFormData(incomingConfig)
        setShowForm(false)
      } else {
        setConfig(null)
        setShowForm(true)
      }

      const statusData = await statusRes.json().catch(() => null)
      if (statusRes.ok && statusData?.success && statusData.status) {
        const incomingStatus = statusData.status as Partial<AutoPilotStatus>
        setStatus({
          isActive: Boolean(incomingStatus.isActive),
          isPaused: Boolean(incomingStatus.isPaused),
          limitsReached: Boolean(incomingStatus.limitsReached),
          nextAction: typeof incomingStatus.nextAction === "string" ? incomingStatus.nextAction : "",
          nextActionTime:
            typeof incomingStatus.nextActionTime === "string" ? incomingStatus.nextActionTime : "",
        })
      } else {
        setStatus(DEFAULT_STATUS)
      }

      const activityData = await activityRes.json().catch(() => null)
      if (activityRes.ok && activityData?.success && Array.isArray(activityData.activities)) {
        setActivityLog((activityData.activities as ActivityLog[]).slice(0, 20))
      } else {
        setActivityLog([])
      }
    } catch (fetchError) {
      console.error("Failed to fetch AutoPilot data:", fetchError)
      setError(fetchError instanceof Error ? fetchError.message : "Failed to load AutoPilot data")
    } finally {
      setIsLoading(false)
    }
  }

  function isPlatformConnected(connectionKeys: string[]) {
    return connectionKeys.some((key) => connectedPlatformSet.has(key.toLowerCase()))
  }

  function togglePostOrVideoPlatform(key: PostPlatformKey | VideoPlatformKey, checked: boolean) {
    setFormData((prev) => ({
      ...prev,
      platforms: {
        ...prev.platforms,
        [key]: checked,
      },
    }))
  }

  function toggleOutreachPlatform(key: OutreachPlatformKey, checked: boolean) {
    setFormData((prev) => ({
      ...prev,
      outreachPlatforms: {
        ...prev.outreachPlatforms,
        [key]: checked,
      },
    }))
  }

  async function handleStartOrUpdateAutoPilot() {
    setError(null)

    if (!formData.appName.trim() || !formData.appDescription.trim() || !formData.targetAudience.trim()) {
      setError("Please fill App Name, App Description, and Target Audience.")
      return
    }

    if (formData.appDescription.trim().length < 100) {
      setError("App Description must be at least 100 characters.")
      return
    }

    const hasSelectedPostOrVideoPlatform = Object.values(formData.platforms).some(Boolean)
    const hasSelectedOutreachPlatform = Object.values(formData.outreachPlatforms).some(Boolean)

    if (!hasSelectedPostOrVideoPlatform && !hasSelectedOutreachPlatform) {
      setError("Select at least one platform for AutoPilot to run.")
      return
    }

    if (hasSelectedOutreachPlatform && !formData.outreachKeywords.trim()) {
      setError("Add at least one outreach keyword when outreach is enabled.")
      return
    }

    setIsSaving(true)
    try {
      const response = await fetch("/api/autopilot/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })
      const data = await response.json().catch(() => null)

      if (!response.ok || !data?.success) {
        throw new Error(data?.error || "Failed to save AutoPilot settings")
      }

      await fetchAutoPilotData()
      setShowForm(false)
    } catch (saveError) {
      console.error("Start AutoPilot error:", saveError)
      setError(saveError instanceof Error ? saveError.message : "Failed to start AutoPilot")
    } finally {
      setIsSaving(false)
    }
  }

  async function handlePauseAutoPilot() {
    setError(null)
    try {
      const response = await fetch("/api/autopilot/pause", { method: "POST" })
      const data = await response.json().catch(() => null)
      if (!response.ok || !data?.success) {
        throw new Error(data?.error || "Failed to pause AutoPilot")
      }
      await fetchAutoPilotData()
    } catch (pauseError) {
      console.error("Pause AutoPilot error:", pauseError)
      setError(pauseError instanceof Error ? pauseError.message : "Failed to pause AutoPilot")
    }
  }

  async function handleResumeAutoPilot() {
    setError(null)
    try {
      const response = await fetch("/api/autopilot/resume", { method: "POST" })
      const data = await response.json().catch(() => null)
      if (!response.ok || !data?.success) {
        throw new Error(data?.error || "Failed to resume AutoPilot")
      }
      await fetchAutoPilotData()
    } catch (resumeError) {
      console.error("Resume AutoPilot error:", resumeError)
      setError(resumeError instanceof Error ? resumeError.message : "Failed to resume AutoPilot")
    }
  }

  const outreachEnabled = useMemo(
    () => Object.values(formData.outreachPlatforms).some(Boolean),
    [formData.outreachPlatforms]
  )

  const statusLabel = useMemo(() => {
    if (effectiveLimitsReached) return "Limits Reached"
    if (!config) return "Inactive"
    if (status.isPaused) return "Paused"
    if (status.isActive) return "Active"
    return "Inactive"
  }, [config, status, effectiveLimitsReached])

  const statusColorClass = useMemo(() => {
    if (effectiveLimitsReached) return "text-orange-400"
    if (!config) return "text-red-400"
    if (status.isPaused) return "text-yellow-400"
    if (status.isActive) return "text-green-400"
    return "text-red-400"
  }, [config, status, effectiveLimitsReached])

  const nextActionText = useMemo(() => {
    if (effectiveLimitsReached) {
      return `Limits reached. AutoPilot resumes ${getNextMonthDateLabel()}.`
    }
    if (status.nextAction) return status.nextAction
    if (!config) return "Configure AutoPilot to begin automated marketing."
    return "AutoPilot is ready."
  }, [config, status.nextAction, effectiveLimitsReached])

  function renderStatusIcon() {
    if (effectiveLimitsReached) return <AlertCircle className="w-6 h-6" />
    if (!config) return <Clock className="w-6 h-6" />
    if (status.isPaused) return <Pause className="w-6 h-6" />
    return <CheckCircle2 className="w-6 h-6" />
  }

  function renderControlButtons() {
    if (!config) {
      return (
        <Button
          onClick={() => setShowForm(true)}
          className="bg-[#FF3D71] hover:bg-[#FF3D71]/90 text-white"
        >
          <Play className="w-4 h-4 mr-2" />
          Start AutoPilot
        </Button>
      )
    }

    if (effectiveLimitsReached) {
      return (
        <div className="flex flex-wrap gap-3">
          <Button asChild className="bg-[#FF3D71] hover:bg-[#FF3D71]/90 text-white">
            <Link href={`/pricing?plan=${getNextPlanSlug(userLimits.planType)}`}>Upgrade Plan</Link>
          </Button>
          <Button
            onClick={() => setShowForm(true)}
            variant="outline"
            className="border-[#404040] text-white hover:bg-white/10"
          >
            <Settings className="w-4 h-4 mr-2" />
            Update Settings
          </Button>
        </div>
      )
    }

    return (
      <div className="flex flex-wrap gap-3">
        {status.isActive && !status.isPaused ? (
          <Button onClick={handlePauseAutoPilot} className="bg-yellow-600 hover:bg-yellow-700 text-white">
            <Pause className="w-4 h-4 mr-2" />
            Pause AutoPilot
          </Button>
        ) : (
          <Button onClick={handleResumeAutoPilot} className="bg-green-600 hover:bg-green-700 text-white">
            <Play className="w-4 h-4 mr-2" />
            Resume AutoPilot
          </Button>
        )}
        <Button
          onClick={() => setShowForm(true)}
          variant="outline"
          className="border-[#404040] text-white hover:bg-white/10"
        >
          <Settings className="w-4 h-4 mr-2" />
          Update Settings
        </Button>
      </div>
    )
  }

  const hasNoConnectedPlatforms =
    !isLoading && !isCheckingOnboarding && connectedPlatforms.length === 0

  if (isCheckingOnboarding) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] p-4 md:p-8">
        <div className="max-w-3xl mx-auto">
          <Card className="bg-[#141414] border-[#404040]">
            <CardContent className="p-12 text-center">
              <Clock className="w-12 h-12 text-[#FF3D71] mx-auto mb-4 animate-pulse" />
              <p className="text-white">Checking onboarding status...</p>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  if (hasNoCampaigns) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] p-4 md:p-8">
        <div className="max-w-3xl mx-auto">
          <Card className="bg-[#141414] border-[#404040]">
            <CardContent className="p-12 text-center">
              <AlertCircle className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-white mb-2">Complete Onboarding First</h2>
              <p className="text-gray-400 mb-6">
                Set up your first campaign before configuring AutoPilot settings.
              </p>
              <Button
                onClick={() => router.push("/onboarding")}
                className="bg-[#FF3D71] hover:bg-[#FF3D71]/90 text-white"
              >
                Go to Onboarding
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  if (hasNoConnectedPlatforms) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] p-4 md:p-8">
        <div className="max-w-3xl mx-auto">
          <Card className="bg-[#141414] border-[#404040]">
            <CardContent className="p-12 text-center">
              <AlertCircle className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-white mb-2">Connect Platforms First</h2>
              <p className="text-gray-400 mb-6">
                You need to connect at least one platform before setting up AutoPilot.
              </p>
              <Button
                onClick={() => router.push("/onboarding")}
                className="bg-[#FF3D71] hover:bg-[#FF3D71]/90 text-white"
              >
                Go to Onboarding
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Zap className="w-10 h-10 text-[#FF3D71]" />
            <h1 className="text-3xl md:text-4xl font-bold text-white">AutoPilot</h1>
          </div>
          <p className="text-gray-400">
            Configure marketing automation once and let Streb run posts, videos, and outreach on a schedule.
          </p>
        </div>

        {error && (
          <Card className="bg-red-950/30 border-red-900 mb-6">
            <CardContent className="p-4 text-red-300">{error}</CardContent>
          </Card>
        )}

        <Card className="bg-[#141414] border-[#404040] mb-8">
          <CardContent className="p-6">
            {isLoading ? (
              <p className="text-gray-400">Loading AutoPilot status...</p>
            ) : (
              <>
                <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between mb-6">
                  <div className="flex items-center gap-4">
                    <div className={statusColorClass}>{renderStatusIcon()}</div>
                    <div>
                      <p className="text-2xl font-bold text-white">{statusLabel}</p>
                      <p className="text-gray-400">{nextActionText}</p>
                      {effectiveLimitsReached && (
                        <p className="text-orange-300 text-sm mt-1">
                          Upgrade to {getNextTier(userLimits.planType)} for higher monthly limits.
                        </p>
                      )}
                      {status.nextActionTime && !effectiveLimitsReached && (
                        <p className="text-gray-500 text-sm mt-1">
                          Next run: {formatDate(status.nextActionTime)}
                        </p>
                      )}
                    </div>
                  </div>
                  <div>{renderControlButtons()}</div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <p className="text-gray-400 text-sm mb-1">Posts Created This Month</p>
                    <p className="text-2xl font-bold text-white">
                      {userLimits.postsUsed} / {userLimits.postsLimit}
                    </p>
                    <ProgressBar
                      color="bg-[#FF3D71]"
                      value={(userLimits.postsUsed / Math.max(userLimits.postsLimit, 1)) * 100}
                    />
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm mb-1">Videos Created This Month</p>
                    <p className="text-2xl font-bold text-white">
                      {userLimits.videosUsed} / {userLimits.videosLimit}
                    </p>
                    <ProgressBar
                      color="bg-blue-500"
                      value={(userLimits.videosUsed / Math.max(userLimits.videosLimit, 1)) * 100}
                    />
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm mb-1">Outreach Sent This Month</p>
                    <p className="text-2xl font-bold text-white">
                      {userLimits.emailsUsed} / {userLimits.emailsLimit}
                    </p>
                    <ProgressBar
                      color="bg-green-500"
                      value={(userLimits.emailsUsed / Math.max(userLimits.emailsLimit, 1)) * 100}
                    />
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {(showForm || !config) && !isLoading && (
          <Card className="bg-[#141414] border-[#404040] mb-8">
            <CardHeader>
              <CardTitle className="text-white">{config ? "Update AutoPilot Settings" : "Setup AutoPilot"}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-8">
              <section className="space-y-4">
                <h3 className="text-lg font-semibold text-white">App Information</h3>

                <div>
                  <Label className="text-white">App Name *</Label>
                  <Input
                    value={formData.appName}
                    onChange={(event) => setFormData((prev) => ({ ...prev, appName: event.target.value }))}
                    className="bg-[#1A1A1A] border-[#404040] text-white mt-2"
                    placeholder="TaskMaster"
                  />
                </div>

                <div>
                  <Label className="text-white">App Description * (min 100 characters)</Label>
                  <Textarea
                    value={formData.appDescription}
                    onChange={(event) =>
                      setFormData((prev) => ({ ...prev, appDescription: event.target.value }))
                    }
                    className="bg-[#1A1A1A] border-[#404040] text-white min-h-[120px] mt-2"
                    placeholder="Describe your app in detail. This helps AI generate better content."
                  />
                  <p className="text-gray-400 text-sm mt-1">{formData.appDescription.length} / 100 characters</p>
                </div>

                <div>
                  <Label className="text-white">Target Audience *</Label>
                  <Input
                    value={formData.targetAudience}
                    onChange={(event) =>
                      setFormData((prev) => ({ ...prev, targetAudience: event.target.value }))
                    }
                    className="bg-[#1A1A1A] border-[#404040] text-white mt-2"
                    placeholder="Freelancers, entrepreneurs, remote workers"
                  />
                </div>

                <div>
                  <Label className="text-white">Key Features (comma-separated)</Label>
                  <Textarea
                    value={formData.keyFeatures}
                    onChange={(event) => setFormData((prev) => ({ ...prev, keyFeatures: event.target.value }))}
                    className="bg-[#1A1A1A] border-[#404040] text-white mt-2"
                    placeholder="AI prioritization, Calendar sync, Mobile app"
                  />
                </div>

                <div>
                  <Label className="text-white">App URL</Label>
                  <Input
                    value={formData.appUrl}
                    onChange={(event) => setFormData((prev) => ({ ...prev, appUrl: event.target.value }))}
                    className="bg-[#1A1A1A] border-[#404040] text-white mt-2"
                    placeholder="https://taskmaster.com"
                  />
                </div>

                <div>
                  <Label className="text-white">GitHub Repo URL (optional)</Label>
                  <Input
                    value={formData.githubRepoUrl}
                    onChange={(event) =>
                      setFormData((prev) => ({ ...prev, githubRepoUrl: event.target.value }))
                    }
                    className="bg-[#1A1A1A] border-[#404040] text-white mt-2"
                    placeholder="https://github.com/you/taskmaster"
                  />
                </div>
              </section>

              <section className="space-y-4">
                <h3 className="text-lg font-semibold text-white">Content Settings</h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label className="text-white">Post Frequency</Label>
                    <select
                      value={formData.postFrequency}
                      onChange={(event) =>
                        setFormData((prev) => ({
                          ...prev,
                          postFrequency: parsePositiveInt(event.target.value, prev.postFrequency),
                        }))
                      }
                      className="w-full bg-[#1A1A1A] border border-[#404040] text-white rounded-md px-3 py-2 mt-2"
                    >
                      <option value={6}>Every 6 hours (default)</option>
                      <option value={12}>Every 12 hours</option>
                      <option value={24}>Daily</option>
                    </select>
                    <p className="text-gray-500 text-xs mt-1">{getFrequencyText(formData.postFrequency)}</p>
                  </div>

                  <div>
                    <Label className="text-white">Video Frequency</Label>
                    <select
                      value={formData.videoFrequency}
                      onChange={(event) =>
                        setFormData((prev) => ({
                          ...prev,
                          videoFrequency: parsePositiveInt(event.target.value, prev.videoFrequency),
                        }))
                      }
                      className="w-full bg-[#1A1A1A] border border-[#404040] text-white rounded-md px-3 py-2 mt-2"
                    >
                      <option value={48}>Every 2 days (default)</option>
                      <option value={72}>Every 3 days</option>
                      <option value={168}>Weekly</option>
                    </select>
                    <p className="text-gray-500 text-xs mt-1">{getFrequencyText(formData.videoFrequency)}</p>
                  </div>

                  <div>
                    <Label className="text-white">Outreach Frequency</Label>
                    <select
                      value={formData.outreachFrequency}
                      onChange={(event) =>
                        setFormData((prev) => ({
                          ...prev,
                          outreachFrequency: parsePositiveInt(event.target.value, prev.outreachFrequency),
                        }))
                      }
                      className="w-full bg-[#1A1A1A] border border-[#404040] text-white rounded-md px-3 py-2 mt-2"
                    >
                      <option value={24}>Daily</option>
                      <option value={48}>Every 2 days</option>
                      <option value={168}>Weekly</option>
                    </select>
                    <p className="text-gray-500 text-xs mt-1">{getFrequencyText(formData.outreachFrequency)}</p>
                  </div>
                </div>
              </section>

              <section className="space-y-4">
                <h3 className="text-lg font-semibold text-white">Platform Selection</h3>
                <p className="text-sm text-gray-400">
                  Connect platforms in Settings first. Unconnected platforms are disabled.
                </p>

                <div>
                  <p className="text-gray-300 text-sm mb-2">Post Platforms</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                    {POST_PLATFORM_OPTIONS.map((platform) => {
                      const connected = isPlatformConnected(platform.connectionKeys)
                      return (
                        <div key={platform.key} className="flex items-center gap-2">
                          <Checkbox
                            checked={formData.platforms[platform.key]}
                            onCheckedChange={(checked) =>
                              togglePostOrVideoPlatform(platform.key, checked === true)
                            }
                            disabled={!connected}
                          />
                          <Label className={connected ? "text-white" : "text-gray-600"}>
                            {platform.label}
                            {!connected && " (not connected)"}
                          </Label>
                        </div>
                      )
                    })}
                  </div>
                </div>

                <div>
                  <p className="text-gray-300 text-sm mb-2">Video Platforms</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {VIDEO_PLATFORM_OPTIONS.map((platform) => {
                      const connected = isPlatformConnected(platform.connectionKeys)
                      return (
                        <div key={platform.key} className="flex items-center gap-2">
                          <Checkbox
                            checked={formData.platforms[platform.key]}
                            onCheckedChange={(checked) =>
                              togglePostOrVideoPlatform(platform.key, checked === true)
                            }
                            disabled={!connected}
                          />
                          <Label className={connected ? "text-white" : "text-gray-600"}>
                            {platform.label}
                            {!connected && " (not connected)"}
                          </Label>
                        </div>
                      )
                    })}
                  </div>
                </div>

                <div>
                  <p className="text-gray-300 text-sm mb-2">Outreach Platforms</p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {OUTREACH_PLATFORM_OPTIONS.map((platform) => {
                      const connected = isPlatformConnected(platform.connectionKeys)
                      return (
                        <div key={platform.key} className="flex items-center gap-2">
                          <Checkbox
                            checked={formData.outreachPlatforms[platform.key]}
                            onCheckedChange={(checked) =>
                              toggleOutreachPlatform(platform.key, checked === true)
                            }
                            disabled={!connected}
                          />
                          <Label className={connected ? "text-white" : "text-gray-600"}>
                            {platform.label}
                            {!connected && " (not connected)"}
                          </Label>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </section>

              {outreachEnabled && (
                <section className="space-y-4">
                  <h3 className="text-lg font-semibold text-white">Outreach Settings</h3>

                  <div>
                    <Label className="text-white">Target Keywords (one per line)</Label>
                    <Textarea
                      value={formData.outreachKeywords}
                      onChange={(event) =>
                        setFormData((prev) => ({ ...prev, outreachKeywords: event.target.value }))
                      }
                      className="bg-[#1A1A1A] border-[#404040] text-white min-h-[100px] mt-2"
                      placeholder={"looking for task manager\nneed productivity app"}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-white">Min Followers (Twitter)</Label>
                      <Input
                        type="number"
                        min={0}
                        value={formData.minFollowers}
                        onChange={(event) =>
                          setFormData((prev) => ({
                            ...prev,
                            minFollowers: parsePositiveInt(event.target.value, prev.minFollowers),
                          }))
                        }
                        className="bg-[#1A1A1A] border-[#404040] text-white mt-2"
                      />
                    </div>

                    <div>
                      <Label className="text-white">Max Results Per Day</Label>
                      <Input
                        type="number"
                        min={1}
                        value={formData.maxResultsPerDay}
                        onChange={(event) =>
                          setFormData((prev) => ({
                            ...prev,
                            maxResultsPerDay: parsePositiveInt(event.target.value, prev.maxResultsPerDay),
                          }))
                        }
                        className="bg-[#1A1A1A] border-[#404040] text-white mt-2"
                      />
                    </div>
                  </div>
                </section>
              )}

              <div className="flex flex-wrap gap-3">
                <Button
                  onClick={handleStartOrUpdateAutoPilot}
                  disabled={isSaving}
                  className="bg-[#FF3D71] hover:bg-[#FF3D71]/90 text-white"
                >
                  {isSaving ? "Saving..." : config ? "Update AutoPilot" : "Start AutoPilot"}
                </Button>
                {config && (
                  <Button
                    onClick={() => setShowForm(false)}
                    variant="outline"
                    className="border-[#404040] text-white hover:bg-white/10"
                  >
                    Cancel
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {!isLoading && config && (
          <Card className="bg-[#141414] border-[#404040]">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Activity className="w-5 h-5" />
                Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              {activityLog.length === 0 ? (
                <p className="text-gray-400">No activity yet. AutoPilot actions will appear here.</p>
              ) : (
                <div className="space-y-3">
                  {activityLog.slice(0, 20).map((activity) => (
                    <div
                      key={activity.id}
                      className="bg-[#1A1A1A] p-4 rounded-lg border border-[#404040] flex flex-col md:flex-row md:items-center md:justify-between gap-2"
                    >
                      <p className="text-white">{activity.action}</p>
                      <p className="text-gray-400 text-sm">{formatDate(activity.timestamp)}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {!isLoading && !config && !showForm && (
          <Card className="bg-[#141414] border-[#404040]">
            <CardContent className="p-8 text-center">
              <p className="text-gray-300 mb-4">AutoPilot is not configured yet.</p>
              <Button
                onClick={() => setShowForm(true)}
                className="bg-[#FF3D71] hover:bg-[#FF3D71]/90 text-white"
              >
                Start AutoPilot
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
