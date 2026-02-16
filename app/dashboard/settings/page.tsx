"use client"

import { useState, useEffect, Suspense } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CheckCircle2 } from 'lucide-react'
import { useSearchParams } from 'next/navigation'

const glossyWhite = "text-white [text-shadow:0_0_1px_rgba(255,255,255,0.6)]"

const DEFAULT_CONNECTED_ACCOUNTS: Record<string, { username?: string; connected: boolean }> = {
  twitter: { connected: false },
  reddit: { connected: false },
  linkedin: { connected: false },
  product_hunt: { connected: false },
  facebook: { connected: false },
  instagram: { connected: false },
  threads: { connected: false },
  github: { connected: false },
  tiktok: { connected: false },
  youtube: { connected: false }
}

function normalizePlatformKey(platform: string): keyof typeof DEFAULT_CONNECTED_ACCOUNTS | null {
  const raw = platform.trim().toLowerCase()
  const aliasMap: Record<string, keyof typeof DEFAULT_CONNECTED_ACCOUNTS> = {
    producthunt: 'product_hunt',
    'product-hunt': 'product_hunt',
    youtube_shorts: 'youtube'
  }

  const normalized = aliasMap[raw] || (raw as keyof typeof DEFAULT_CONNECTED_ACCOUNTS)
  return normalized in DEFAULT_CONNECTED_ACCOUNTS ? normalized : null
}

function SettingsContent() {
  const searchParams = useSearchParams()
  const [isConnecting, setIsConnecting] = useState(false)
  const [connectedAccounts, setConnectedAccounts] = useState<Record<string, { username?: string; connected: boolean }>>(
    DEFAULT_CONNECTED_ACCOUNTS
  )

  async function fetchConnectedAccounts() {
    try {
      const response = await fetch('/api/user/connected-platforms', {
        method: 'GET',
        cache: 'no-store'
      })
      const data = await response.json()

      if (!response.ok || !data?.success) {
        console.error('Failed to fetch connected platforms:', data?.error || 'Unknown error')
        return
      }

      const nextState: Record<string, { username?: string; connected: boolean }> = {
        ...DEFAULT_CONNECTED_ACCOUNTS
      }

      const details = Array.isArray(data.details) ? data.details : []
      const usernameByPlatform = new Map<string, string>()

      for (const detail of details) {
        if (!detail || typeof detail !== 'object') continue
        const platform = typeof detail.platform === 'string' ? detail.platform : ''
        const username = typeof detail.username === 'string' ? detail.username : ''
        const key = normalizePlatformKey(platform)
        if (key && username) {
          usernameByPlatform.set(key, username)
        }
      }

      const platforms = Array.isArray(data.platforms) ? data.platforms : []
      for (const platform of platforms) {
        if (typeof platform !== 'string') continue
        const key = normalizePlatformKey(platform)
        if (!key) continue
        nextState[key] = {
          connected: true,
          username: usernameByPlatform.get(key)
        }
      }

      setConnectedAccounts(nextState)
    } catch (error) {
      console.error('Failed to load connected accounts:', error)
    }
  }

  useEffect(() => {
    // Check for connection status from URL params and hydrate from DB
    const connected = searchParams.get('connected')
    const error = searchParams.get('error')

    if (error) {
      console.error('OAuth error:', error)
    }

    if (connected) {
      const key = normalizePlatformKey(connected)
      if (key) {
        setConnectedAccounts(prev => ({
          ...prev,
          [key]: {
            ...prev[key],
            connected: true
          }
        }))
      }
    }

    void fetchConnectedAccounts()
  }, [searchParams])

  const handleConnectTwitter = async () => {
    setIsConnecting(true)
    try {
      const res = await fetch('/api/oauth/twitter')
      const data = await res.json()
      if (data.authUrl) {
        window.location.href = data.authUrl
      } else {
        console.error('No auth URL returned:', data)
        setIsConnecting(false)
      }
    } catch (error) {
      console.error('Failed to initiate Twitter OAuth:', error)
      setIsConnecting(false)
    }
  }

  const handleConnectReddit = async () => {
    setIsConnecting(true)
    try {
      const res = await fetch('/api/oauth/reddit')
      const data = await res.json()
      if (data.authUrl) {
        window.location.href = data.authUrl
      } else {
        console.error('No auth URL returned:', data)
        setIsConnecting(false)
      }
    } catch (error) {
      console.error('Failed to initiate Reddit OAuth:', error)
      setIsConnecting(false)
    }
  }

  const handleConnectLinkedIn = async () => {
    setIsConnecting(true)
    try {
      const res = await fetch('/api/oauth/linkedin')
      const data = await res.json()
      if (data.authUrl) {
        window.location.href = data.authUrl
      } else {
        console.error('No auth URL returned:', data)
        setIsConnecting(false)
      }
    } catch (error) {
      console.error('Failed to initiate LinkedIn OAuth:', error)
      setIsConnecting(false)
    }
  }

  const handleConnectProductHunt = async () => {
    setIsConnecting(true)
    try {
      const res = await fetch('/api/oauth/product-hunt')
      const data = await res.json()
      if (data.authUrl) {
        window.location.href = data.authUrl
      } else {
        console.error('No auth URL returned:', data)
        setIsConnecting(false)
      }
    } catch (error) {
      console.error('Failed to initiate Product Hunt OAuth:', error)
      setIsConnecting(false)
    }
  }

  const handleConnectFacebook = async () => {
    setIsConnecting(true)
    try {
      const res = await fetch('/api/oauth/facebook')
      const data = await res.json()
      if (data.authUrl) {
        window.location.href = data.authUrl
      } else {
        console.error('No auth URL returned:', data)
        setIsConnecting(false)
      }
    } catch (error) {
      console.error('Failed to initiate Facebook OAuth:', error)
      setIsConnecting(false)
    }
  }

  const handleConnectInstagram = async () => {
    setIsConnecting(true)
    try {
      const res = await fetch('/api/oauth/instagram')
      const data = await res.json()
      if (data.authUrl) {
        window.location.href = data.authUrl
      } else {
        console.error('No auth URL returned:', data)
        setIsConnecting(false)
      }
    } catch (error) {
      console.error('Failed to initiate Instagram OAuth:', error)
      setIsConnecting(false)
    }
  }

  const handleConnectThreads = async () => {
    setIsConnecting(true)
    try {
      const res = await fetch('/api/oauth/threads')
      const data = await res.json()
      if (data.authUrl) {
        window.location.href = data.authUrl
      } else {
        console.error('No auth URL returned:', data)
        setIsConnecting(false)
      }
    } catch (error) {
      console.error('Failed to initiate Threads OAuth:', error)
      setIsConnecting(false)
    }
  }

  const handleConnectGitHub = async () => {
    setIsConnecting(true)
    try {
      const res = await fetch('/api/oauth/github')
      const data = await res.json()
      if (data.authUrl) {
        window.location.href = data.authUrl
      } else {
        console.error('No auth URL returned:', data)
        setIsConnecting(false)
      }
    } catch (error) {
      console.error('Failed to initiate GitHub OAuth:', error)
      setIsConnecting(false)
    }
  }

  const handleConnectTikTok = async () => {
    setIsConnecting(true)
    try {
      const res = await fetch('/api/oauth/tiktok')
      const data = await res.json()
      if (data.authUrl) {
        window.location.href = data.authUrl
      } else {
        console.error('No auth URL returned:', data)
        setIsConnecting(false)
      }
    } catch (error) {
      console.error('Failed to initiate TikTok OAuth:', error)
      setIsConnecting(false)
    }
  }

  const handleConnectYouTube = async () => {
    setIsConnecting(true)
    try {
      const res = await fetch('/api/oauth/youtube')
      const data = await res.json()
      if (data.authUrl) {
        window.location.href = data.authUrl
      } else {
        console.error('No auth URL returned:', data)
        setIsConnecting(false)
      }
    } catch (error) {
      console.error('Failed to initiate YouTube OAuth:', error)
      setIsConnecting(false)
    }
  }

  return (
    <div className="space-y-8">
      <div className="mb-8">
        <h1 className={`text-3xl font-bold ${glossyWhite}`}>Settings</h1>
        <p className="text-gray-400 mt-2">Manage your account and connected platforms</p>
      </div>

      <Card className="border-[#404040] bg-[#2A2A2A]">
        <CardHeader>
          <CardTitle className={glossyWhite}>Connected Accounts</CardTitle>
          <CardDescription className="text-gray-400">
            Connect your social media accounts to enable posting
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-5 gap-4">
            {/* Twitter Connection */}
            <div className="flex flex-col p-4 border border-[#404040] rounded-lg bg-[#1A1A1A]">
              <div className="flex items-center gap-3 mb-3">
                <svg className="w-6 h-6 text-[#1DA1F2]" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                </svg>
                <div>
                  <h3 className={`${glossyWhite} font-semibold`}>Twitter</h3>
                  {connectedAccounts.twitter?.username && (
                    <p className="text-sm text-gray-400">@{connectedAccounts.twitter.username}</p>
                  )}
                </div>
              </div>
              <div className="mt-auto">
                {connectedAccounts.twitter?.connected ? (
                  <div className="flex items-center gap-2 text-green-400">
                    <CheckCircle2 className="w-5 h-5" />
                    <span className="text-sm">Connected</span>
                  </div>
                ) : (
                  <Button
                    onClick={handleConnectTwitter}
                    disabled={isConnecting}
                    className="w-full border border-gray-500/50 bg-gradient-to-b from-white via-[#E8E8E8] to-[#C0C0C0] font-medium text-[#1A1A1A] shadow-[0_1px_3px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.8)] hover:from-[#F5F5F5] hover:via-[#E0E0E0] hover:to-[#B8B8B8] disabled:opacity-50"
                  >
                    {isConnecting ? 'Connecting...' : 'Connect Twitter'}
                  </Button>
                )}
              </div>
            </div>

            {/* Reddit Connection */}
            <div className="flex flex-col p-4 border border-[#404040] rounded-lg bg-[#1A1A1A]">
              <div className="flex items-center gap-3 mb-3">
                <svg className="w-6 h-6 text-[#FF4500]" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z"/>
                </svg>
                <div>
                  <h3 className={`${glossyWhite} font-semibold`}>Reddit</h3>
                  {connectedAccounts.reddit?.username && (
                    <p className="text-sm text-gray-400">u/{connectedAccounts.reddit.username}</p>
                  )}
                </div>
              </div>
              <div className="mt-auto">
                {connectedAccounts.reddit?.connected ? (
                  <div className="flex items-center gap-2 text-green-400">
                    <CheckCircle2 className="w-5 h-5" />
                    <span className="text-sm">Connected</span>
                  </div>
                ) : (
                  <Button
                    onClick={handleConnectReddit}
                    disabled={isConnecting}
                    className="w-full border border-gray-500/50 bg-gradient-to-b from-white via-[#E8E8E8] to-[#C0C0C0] font-medium text-[#1A1A1A] shadow-[0_1px_3px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.8)] hover:from-[#F5F5F5] hover:via-[#E0E0E0] hover:to-[#B8B8B8] disabled:opacity-50"
                  >
                    {isConnecting ? 'Connecting...' : 'Connect Reddit'}
                  </Button>
                )}
              </div>
            </div>

            {/* LinkedIn Connection */}
            <div className="flex flex-col p-4 border border-[#404040] rounded-lg bg-[#1A1A1A]">
              <div className="flex items-center gap-3 mb-3">
                <svg className="w-6 h-6 text-[#0A66C2]" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                </svg>
                <div>
                  <h3 className={`${glossyWhite} font-semibold`}>LinkedIn</h3>
                  {connectedAccounts.linkedin?.username && (
                    <p className="text-sm text-gray-400">{connectedAccounts.linkedin.username}</p>
                  )}
                </div>
              </div>
              <div className="mt-auto">
                {connectedAccounts.linkedin?.connected ? (
                  <div className="flex items-center gap-2 text-green-400">
                    <CheckCircle2 className="w-5 h-5" />
                    <span className="text-sm">Connected</span>
                  </div>
                ) : (
                  <Button
                    onClick={handleConnectLinkedIn}
                    disabled={isConnecting}
                    className="w-full border border-gray-500/50 bg-gradient-to-b from-white via-[#E8E8E8] to-[#C0C0C0] font-medium text-[#1A1A1A] shadow-[0_1px_3px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.8)] hover:from-[#F5F5F5] hover:via-[#E0E0E0] hover:to-[#B8B8B8] disabled:opacity-50"
                  >
                    {isConnecting ? 'Connecting...' : 'Connect LinkedIn'}
                  </Button>
                )}
              </div>
            </div>

            {/* Product Hunt Connection */}
            <div className="flex flex-col p-4 border border-[#404040] rounded-lg bg-[#1A1A1A]">
              <div className="flex items-center gap-3 mb-3">
                <svg className="w-6 h-6 text-[#DA552F]" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M13.337 9h-2.838v3h2.838a1.5 1.5 0 1 0 0-3zM12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm1.337 14h-2.838v3H8.5V7h4.837a3.5 3.5 0 1 1 0 7z"/>
                </svg>
                <div>
                  <h3 className={`${glossyWhite} font-semibold`}>Product Hunt</h3>
                  {connectedAccounts.product_hunt?.username && (
                    <p className="text-sm text-gray-400">@{connectedAccounts.product_hunt.username}</p>
                  )}
                </div>
              </div>
              <div className="mt-auto">
                {connectedAccounts.product_hunt?.connected ? (
                  <div className="flex items-center gap-2 text-green-400">
                    <CheckCircle2 className="w-5 h-5" />
                    <span className="text-sm">Connected</span>
                  </div>
                ) : (
                  <Button
                    onClick={handleConnectProductHunt}
                    disabled={isConnecting}
                    className="w-full border border-gray-500/50 bg-gradient-to-b from-white via-[#E8E8E8] to-[#C0C0C0] font-medium text-[#1A1A1A] shadow-[0_1px_3px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.8)] hover:from-[#F5F5F5] hover:via-[#E0E0E0] hover:to-[#B8B8B8] disabled:opacity-50"
                  >
                    {isConnecting ? 'Connecting...' : 'Connect Product Hunt'}
                  </Button>
                )}
              </div>
            </div>

            {/* Facebook Connection */}
            <div className="flex flex-col p-4 border border-[#404040] rounded-lg bg-[#1A1A1A]">
              <div className="flex items-center gap-3 mb-3">
                <svg className="w-6 h-6 text-[#1877F2]" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
                <div>
                  <h3 className={`${glossyWhite} font-semibold`}>Facebook</h3>
                  {connectedAccounts.facebook?.username && (
                    <p className="text-sm text-gray-400">{connectedAccounts.facebook.username}</p>
                  )}
                </div>
              </div>
              <div className="mt-auto">
                {connectedAccounts.facebook?.connected ? (
                  <div className="flex items-center gap-2 text-green-400">
                    <CheckCircle2 className="w-5 h-5" />
                    <span className="text-sm">Connected</span>
                  </div>
                ) : (
                  <Button
                    onClick={handleConnectFacebook}
                    disabled={isConnecting}
                    className="w-full border border-gray-500/50 bg-gradient-to-b from-white via-[#E8E8E8] to-[#C0C0C0] font-medium text-[#1A1A1A] shadow-[0_1px_3px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.8)] hover:from-[#F5F5F5] hover:via-[#E0E0E0] hover:to-[#B8B8B8] disabled:opacity-50"
                  >
                    {isConnecting ? 'Connecting...' : 'Connect Facebook'}
                  </Button>
                )}
              </div>
            </div>

            {/* Instagram Connection */}
            <div className="flex flex-col p-4 border border-[#404040] rounded-lg bg-[#1A1A1A]">
              <div className="flex items-center gap-3 mb-3">
                <svg className="w-6 h-6 text-[#E4405F]" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
                </svg>
                <div>
                  <h3 className={`${glossyWhite} font-semibold`}>Instagram</h3>
                  {connectedAccounts.instagram?.username && (
                    <p className="text-sm text-gray-400">@{connectedAccounts.instagram.username}</p>
                  )}
                </div>
              </div>
              <div className="mt-auto">
                {connectedAccounts.instagram?.connected ? (
                  <div className="flex items-center gap-2 text-green-400">
                    <CheckCircle2 className="w-5 h-5" />
                    <span className="text-sm">Connected</span>
                  </div>
                ) : (
                  <Button
                    onClick={handleConnectInstagram}
                    disabled={isConnecting}
                    className="w-full border border-gray-500/50 bg-gradient-to-b from-white via-[#E8E8E8] to-[#C0C0C0] font-medium text-[#1A1A1A] shadow-[0_1px_3px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.8)] hover:from-[#F5F5F5] hover:via-[#E0E0E0] hover:to-[#B8B8B8] disabled:opacity-50"
                  >
                    {isConnecting ? 'Connecting...' : 'Connect Instagram'}
                  </Button>
                )}
              </div>
            </div>
            {/* Threads Connection */}
            <div className="flex flex-col p-4 border border-[#404040] rounded-lg bg-[#1A1A1A]">
              <div className="flex items-center gap-3 mb-3">
                <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12.186 10.625c-.39-.178-.783-.304-1.178-.379a5.474 5.474 0 0 0-1.013-.084c-.916 0-1.674.246-2.275.739-.599.493-.901 1.148-.904 1.965v.085c0 .835.294 1.495.882 1.98.587.485 1.342.728 2.267.728 1.045 0 1.856-.36 2.434-1.08.578-.72.867-1.77.867-3.15V10.3c0-1.8-.448-3.255-1.345-4.365-.896-1.11-2.135-1.665-3.716-1.665-1.727 0-3.07.624-4.031 1.874C2.476 7.308 1.996 9.01 1.996 11.163c0 2.226.488 3.96 1.465 5.202.977 1.242 2.354 1.863 4.13 1.863 1.278 0 2.355-.312 3.231-.936.876-.624 1.476-1.542 1.803-2.754l-2.213-.363c-.234.648-.546 1.128-.939 1.44-.393.312-.9.468-1.52.468-1.071 0-1.854-.378-2.352-1.134-.498-.756-.747-1.938-.747-3.546 0-1.692.258-2.904.774-3.636.516-.732 1.311-1.098 2.385-1.098.963 0 1.717.234 2.259.702.543.468.819 1.116.828 1.944h-2.28z"/>
                </svg>
                <div>
                  <h3 className={`${glossyWhite} font-semibold`}>Threads</h3>
                  {connectedAccounts.threads?.username && (
                    <p className="text-sm text-gray-400">@{connectedAccounts.threads.username}</p>
                  )}
                </div>
              </div>
              <div className="mt-auto">
                {connectedAccounts.threads?.connected ? (
                  <div className="flex items-center gap-2 text-green-400">
                    <CheckCircle2 className="w-5 h-5" />
                    <span className="text-sm">Connected</span>
                  </div>
                ) : (
                  <Button
                    onClick={handleConnectThreads}
                    disabled={isConnecting}
                    className="w-full border border-gray-500/50 bg-gradient-to-b from-white via-[#E8E8E8] to-[#C0C0C0] font-medium text-[#1A1A1A] shadow-[0_1px_3px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.8)] hover:from-[#F5F5F5] hover:via-[#E0E0E0] hover:to-[#B8B8B8] disabled:opacity-50"
                  >
                    {isConnecting ? 'Connecting...' : 'Connect Threads'}
                  </Button>
                )}
              </div>
            </div>

            {/* GitHub Connection */}
            <div className="flex flex-col p-4 border border-[#404040] rounded-lg bg-[#1A1A1A]">
              <div className="flex items-center gap-3 mb-3">
                <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                </svg>
                <div>
                  <h3 className={`${glossyWhite} font-semibold`}>GitHub</h3>
                  {connectedAccounts.github?.username && (
                    <p className="text-sm text-gray-400">{connectedAccounts.github.username}</p>
                  )}
                </div>
              </div>
              <div className="mt-auto">
                {connectedAccounts.github?.connected ? (
                  <div className="flex items-center gap-2 text-green-400">
                    <CheckCircle2 className="w-5 h-5" />
                    <span className="text-sm">Connected</span>
                  </div>
                ) : (
                  <Button
                    onClick={handleConnectGitHub}
                    disabled={isConnecting}
                    className="w-full border border-gray-500/50 bg-gradient-to-b from-white via-[#E8E8E8] to-[#C0C0C0] font-medium text-[#1A1A1A] shadow-[0_1px_3px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.8)] hover:from-[#F5F5F5] hover:via-[#E0E0E0] hover:to-[#B8B8B8] disabled:opacity-50"
                  >
                    {isConnecting ? 'Connecting...' : 'Connect GitHub'}
                  </Button>
                )}
              </div>
            </div>

            {/* TikTok Connection */}
            <div className="flex flex-col p-4 border border-[#404040] rounded-lg bg-[#1A1A1A]">
              <div className="flex items-center gap-3 mb-3">
                <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/>
                </svg>
                <div>
                  <h3 className={`${glossyWhite} font-semibold`}>TikTok</h3>
                  {connectedAccounts.tiktok?.username && (
                    <p className="text-sm text-gray-400">@{connectedAccounts.tiktok.username}</p>
                  )}
                </div>
              </div>
              <div className="mt-auto">
                {connectedAccounts.tiktok?.connected ? (
                  <div className="flex items-center gap-2 text-green-400">
                    <CheckCircle2 className="w-5 h-5" />
                    <span className="text-sm">Connected</span>
                  </div>
                ) : (
                  <Button
                    onClick={handleConnectTikTok}
                    disabled={isConnecting}
                    className="w-full border border-gray-500/50 bg-gradient-to-b from-white via-[#E8E8E8] to-[#C0C0C0] font-medium text-[#1A1A1A] shadow-[0_1px_3px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.8)] hover:from-[#F5F5F5] hover:via-[#E0E0E0] hover:to-[#B8B8B8] disabled:opacity-50"
                  >
                    {isConnecting ? 'Connecting...' : 'Connect TikTok'}
                  </Button>
                )}
              </div>
            </div>

            {/* YouTube Connection */}
            <div className="flex flex-col p-4 border border-[#404040] rounded-lg bg-[#1A1A1A]">
              <div className="flex items-center gap-3 mb-3">
                <svg className="w-6 h-6 text-[#FF0000]" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                </svg>
                <div>
                  <h3 className={`${glossyWhite} font-semibold`}>YouTube</h3>
                  {connectedAccounts.youtube?.username && (
                    <p className="text-sm text-gray-400">{connectedAccounts.youtube.username}</p>
                  )}
                </div>
              </div>
              <div className="mt-auto">
                {connectedAccounts.youtube?.connected ? (
                  <div className="flex items-center gap-2 text-green-400">
                    <CheckCircle2 className="w-5 h-5" />
                    <span className="text-sm">Connected</span>
                  </div>
                ) : (
                  <Button
                    onClick={handleConnectYouTube}
                    disabled={isConnecting}
                    className="w-full border border-gray-500/50 bg-gradient-to-b from-white via-[#E8E8E8] to-[#C0C0C0] font-medium text-[#1A1A1A] shadow-[0_1px_3px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.8)] hover:from-[#F5F5F5] hover:via-[#E0E0E0] hover:to-[#B8B8B8] disabled:opacity-50"
                  >
                    {isConnecting ? 'Connecting...' : 'Connect YouTube'}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default function SettingsPage() {
  return (
    <Suspense fallback={
      <div className="space-y-8">
        <div className="mb-8">
          <h1 className={`text-3xl font-bold ${glossyWhite}`}>Settings</h1>
          <p className="text-gray-400 mt-2">Loading...</p>
        </div>
      </div>
    }>
      <SettingsContent />
    </Suspense>
  )
}
