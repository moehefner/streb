"use client"

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Activity,
  Settings,
  Pause,
  Play,
  Trash2,
  Plus,
  ArrowUpRight,
  Loader2,
  AlertCircle
} from 'lucide-react'

interface Campaign {
  id: string
  name: string
  appName: string
  appDescription: string
  isActive: boolean
  isPaused: boolean
  platforms: Record<string, boolean>
  createdAt: string
  updatedAt: string
}

export default function CampaignsPage() {
  const router = useRouter()
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [campaignsUsed, setCampaignsUsed] = useState(0)
  const [campaignsLimit, setCampaignsLimit] = useState(1)
  const [canCreateMore, setCanCreateMore] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchCampaigns()
  }, [])

  async function fetchCampaigns() {
    setIsLoading(true)
    setError('')

    try {
      const response = await fetch('/api/campaigns/list', {
        cache: 'no-store'
      })
      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to fetch campaigns')
      }

      const nextCampaigns = (data.campaigns || []) as Campaign[]
      const nextUsed = Number(data.campaignsUsed || nextCampaigns.length || 0)
      const nextLimit = Number(data.campaignsLimit || 1)
      const nextCanCreateMore =
        typeof data.canCreateMore === 'boolean' ? data.canCreateMore : nextUsed < nextLimit

      setCampaigns(nextCampaigns)
      setCampaignsUsed(nextUsed)
      setCampaignsLimit(nextLimit)
      setCanCreateMore(nextCanCreateMore)
    } catch (fetchError) {
      console.error('Failed to fetch campaigns:', fetchError)
      setError(fetchError instanceof Error ? fetchError.message : 'Failed to fetch campaigns')
      setCampaigns([])
      setCampaignsUsed(0)
      setCampaignsLimit(1)
      setCanCreateMore(false)
    } finally {
      setIsLoading(false)
    }
  }

  async function handlePauseCampaign(campaignId: string) {
    setActionLoading(campaignId)
    try {
      const response = await fetch('/api/autopilot/pause', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaignId })
      })

      const data = await response.json()

      if (data.success) {
        await fetchCampaigns()
      } else {
        alert(`Failed to pause: ${data.error}`)
      }
    } catch (pauseError) {
      console.error('Pause error:', pauseError)
      alert('Failed to pause campaign')
    } finally {
      setActionLoading(null)
    }
  }

  async function handleResumeCampaign(campaignId: string) {
    setActionLoading(campaignId)
    try {
      const response = await fetch('/api/autopilot/resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaignId })
      })

      const data = await response.json()

      if (data.success) {
        await fetchCampaigns()
      } else {
        alert(`Failed to resume: ${data.error}`)
      }
    } catch (resumeError) {
      console.error('Resume error:', resumeError)
      alert('Failed to resume campaign')
    } finally {
      setActionLoading(null)
    }
  }

  async function handleDeleteCampaign(campaignId: string, campaignName: string) {
    if (!confirm(`Are you sure you want to delete campaign "${campaignName}"? This cannot be undone.`)) {
      return
    }

    setActionLoading(campaignId)
    try {
      const response = await fetch(`/api/campaigns/${campaignId}`, {
        method: 'DELETE'
      })

      const data = await response.json()

      if (data.success) {
        await fetchCampaigns()
      } else {
        alert(`Failed to delete: ${data.error}`)
      }
    } catch (deleteError) {
      console.error('Delete error:', deleteError)
      alert('Failed to delete campaign')
    } finally {
      setActionLoading(null)
    }
  }

  function handleEditCampaign(campaignId: string) {
    localStorage.setItem('selectedCampaign', campaignId)
    router.push('/dashboard/autopilot')
  }

  function handleViewActivity(campaignId: string) {
    localStorage.setItem('selectedCampaign', campaignId)
    router.push('/dashboard')
  }

  function handleCreateCampaign() {
    if (!canCreateMore) {
      alert(`You've reached your campaign limit (${campaignsLimit}). Upgrade to create more campaigns.`)
      router.push('/dashboard/billing')
      return
    }

    router.push('/onboarding')
  }

  function getPlatformsList(platforms: Record<string, boolean>): string {
    const enabled = Object.entries(platforms)
      .filter(([, enabledValue]) => enabledValue)
      .map(([platform]) => platform)
      .map((platform) => platform.charAt(0).toUpperCase() + platform.slice(1))

    return enabled.length > 0 ? enabled.join(', ') : 'No platforms'
  }

  function getStatusColor(campaign: Campaign): string {
    if (!campaign.isActive) return 'text-red-400'
    if (campaign.isPaused) return 'text-yellow-400'
    return 'text-green-400'
  }

  function getStatusText(campaign: Campaign): string {
    if (!campaign.isActive) return 'Inactive'
    if (campaign.isPaused) return 'Paused'
    return 'Active'
  }

  function getStatusIcon(campaign: Campaign) {
    if (!campaign.isActive) return <AlertCircle className="h-5 w-5" />
    if (campaign.isPaused) return <Pause className="h-5 w-5" />
    return <Activity className="h-5 w-5" />
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0A0A0A]">
        <Loader2 className="h-12 w-12 animate-spin text-[#FF3D71]" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] p-8">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <h1 className="mb-2 text-4xl font-bold text-white">Campaigns</h1>
              <p className="text-gray-400">
                Manage your marketing campaigns ({campaignsUsed} / {campaignsLimit} used)
              </p>
            </div>

            <Button
              onClick={handleCreateCampaign}
              className="bg-[#FF3D71] text-white hover:bg-[#FF3D71]/90"
              disabled={!canCreateMore}
            >
              <Plus className="mr-2 h-4 w-4" />
              New Campaign
            </Button>
          </div>

          {/* Upgrade Prompt if at limit */}
          {!canCreateMore && (
            <div className="flex items-center justify-between rounded-lg border border-yellow-500 bg-yellow-500/10 p-4">
              <div className="flex items-center gap-3">
                <AlertCircle className="h-5 w-5 text-yellow-500" />
                <div>
                  <p className="font-medium text-white">Campaign limit reached</p>
                  <p className="text-sm text-gray-400">
                    Upgrade to {campaignsLimit === 1 ? 'Starter' : campaignsLimit === 2 ? 'Pro' : 'Agency'} to create more campaigns
                  </p>
                </div>
              </div>
              <Button
                onClick={() => router.push('/dashboard/billing')}
                variant="outline"
                className="border-yellow-500 text-yellow-500 hover:bg-yellow-500/10"
              >
                Upgrade Plan
              </Button>
            </div>
          )}
        </div>

        {/* Error State */}
        {error && (
          <Card className="mb-6 border-red-500/40 bg-red-500/10">
            <CardContent className="p-4">
              <p className="text-red-400">{error}</p>
            </CardContent>
          </Card>
        )}

        {/* Campaigns Grid */}
        {campaigns.length === 0 ? (
          <Card className="border-[#404040] bg-[#141414]">
            <CardContent className="p-12 text-center">
              <Activity className="mx-auto mb-4 h-16 w-16 text-gray-600" />
              <h2 className="mb-2 text-2xl font-bold text-white">No campaigns yet</h2>
              <p className="mb-6 text-gray-400">
                Create your first campaign to start marketing with AutoPilot
              </p>
              <Button
                onClick={handleCreateCampaign}
                className="bg-[#FF3D71] text-white hover:bg-[#FF3D71]/90"
              >
                <Plus className="mr-2 h-4 w-4" />
                Create First Campaign
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {campaigns.map((campaign) => (
              <Card key={campaign.id} className="border-[#404040] bg-[#141414]">
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <CardTitle className="mb-1 text-xl text-white">{campaign.name}</CardTitle>
                      <p className="line-clamp-2 text-sm text-gray-400">{campaign.appDescription}</p>
                    </div>
                    <div className={`flex items-center gap-2 ${getStatusColor(campaign)}`}>
                      {getStatusIcon(campaign)}
                      <span className="text-sm font-medium">{getStatusText(campaign)}</span>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  {/* Platforms */}
                  <div>
                    <p className="mb-1 text-sm text-gray-500">Platforms</p>
                    <p className="text-sm text-white">{getPlatformsList(campaign.platforms)}</p>
                  </div>

                  {/* Created Date */}
                  <div>
                    <p className="mb-1 text-sm text-gray-500">Created</p>
                    <p className="text-sm text-white">
                      {new Date(campaign.createdAt).toLocaleDateString()}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-2">
                    <Button
                      onClick={() => handleEditCampaign(campaign.id)}
                      variant="outline"
                      className="flex-1 border-[#404040] text-white hover:bg-white/10"
                      size="sm"
                    >
                      <Settings className="mr-2 h-4 w-4" />
                      Edit AutoPilot
                    </Button>

                    <Button
                      onClick={() => handleViewActivity(campaign.id)}
                      variant="outline"
                      className="flex-1 border-[#404040] text-white hover:bg-white/10"
                      size="sm"
                    >
                      <ArrowUpRight className="mr-2 h-4 w-4" />
                      View Activity
                    </Button>
                  </div>

                  <div className="flex gap-2">
                    {campaign.isActive && !campaign.isPaused ? (
                      <Button
                        onClick={() => handlePauseCampaign(campaign.id)}
                        variant="outline"
                        className="flex-1 border-yellow-500 text-yellow-500 hover:bg-yellow-500/10"
                        size="sm"
                        disabled={actionLoading === campaign.id}
                      >
                        {actionLoading === campaign.id ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Pause className="mr-2 h-4 w-4" />
                        )}
                        Pause
                      </Button>
                    ) : campaign.isPaused ? (
                      <Button
                        onClick={() => handleResumeCampaign(campaign.id)}
                        variant="outline"
                        className="flex-1 border-green-500 text-green-500 hover:bg-green-500/10"
                        size="sm"
                        disabled={actionLoading === campaign.id}
                      >
                        {actionLoading === campaign.id ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Play className="mr-2 h-4 w-4" />
                        )}
                        Resume
                      </Button>
                    ) : null}

                    <Button
                      onClick={() => handleDeleteCampaign(campaign.id, campaign.name)}
                      variant="outline"
                      className="border-red-500 text-red-500 hover:bg-red-500/10"
                      size="sm"
                      disabled={actionLoading === campaign.id}
                    >
                      {actionLoading === campaign.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
