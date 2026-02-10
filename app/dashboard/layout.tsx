"use client"

import { UserButton } from '@clerk/nextjs'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import {
  Activity,
  ChevronDown,
  CreditCard,
  LayoutDashboard,
  Plus,
  Settings as SettingsIcon,
  Zap
} from 'lucide-react'

type Campaign = {
  id: string
  name: string
}

export default function DashboardLayout({
  children
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()

  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [selectedCampaign, setSelectedCampaign] = useState<string | null>(null)
  const [showCampaignDropdown, setShowCampaignDropdown] = useState(false)
  const [showUserDropdown, setShowUserDropdown] = useState(false)

  const campaignDropdownRef = useRef<HTMLDivElement | null>(null)
  const userDropdownRef = useRef<HTMLDivElement | null>(null)

  // Fetch campaigns on mount
  useEffect(() => {
    fetchCampaigns()
  }, [])

  // Restore persisted campaign selection
  useEffect(() => {
    const storedCampaignId = localStorage.getItem('selectedCampaign')
    if (!storedCampaignId || campaigns.length === 0) {
      return
    }

    const exists = campaigns.some((campaign) => campaign.id === storedCampaignId)
    if (exists) {
      setSelectedCampaign(storedCampaignId)
    }
  }, [campaigns])

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node

      if (
        campaignDropdownRef.current &&
        !campaignDropdownRef.current.contains(target)
      ) {
        setShowCampaignDropdown(false)
      }

      if (userDropdownRef.current && !userDropdownRef.current.contains(target)) {
        setShowUserDropdown(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  async function fetchCampaigns() {
    try {
      const response = await fetch('/api/campaigns/list')
      const data = await response.json()

      if (data.success) {
        const fetchedCampaigns = (data.campaigns || []) as Campaign[]
        setCampaigns(fetchedCampaigns)

        if (fetchedCampaigns.length > 0 && !selectedCampaign) {
          setSelectedCampaign(fetchedCampaigns[0].id)
        }
      }
    } catch (error) {
      console.error('Failed to fetch campaigns:', error)
    }
  }

  function handleCampaignChange(campaignId: string) {
    setSelectedCampaign(campaignId)
    setShowCampaignDropdown(false)
    localStorage.setItem('selectedCampaign', campaignId)
  }

  function createNewCampaign() {
    setShowCampaignDropdown(false)
    router.push('/onboarding')
  }

  const selectedCampaignData = campaigns.find((campaign) => campaign.id === selectedCampaign)

  return (
    <div className="min-h-screen bg-[#0A0A0A]">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-[#404040] bg-[#141414]">
        <div className="mx-auto max-w-7xl px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <div className="flex items-center gap-8">
              <h1 className="text-2xl font-bold text-white">Streb</h1>

              {/* Campaign Selector */}
              {campaigns.length > 0 && (
                <div className="relative" ref={campaignDropdownRef}>
                  <button
                    onClick={() => setShowCampaignDropdown((prev) => !prev)}
                    className="flex items-center gap-2 rounded-lg border border-[#404040] bg-[#1A1A1A] px-4 py-2 text-white transition-colors hover:bg-[#252525]"
                    type="button"
                  >
                    <span className="text-sm">
                      {selectedCampaignData?.name || 'Select Campaign'}
                    </span>
                    <ChevronDown className="h-4 w-4 text-gray-400" />
                  </button>

                  {/* Campaign Dropdown */}
                  {showCampaignDropdown && (
                    <div className="absolute left-0 top-full z-50 mt-2 min-w-[220px] rounded-lg border border-[#404040] bg-[#1A1A1A] py-2 shadow-xl">
                      {campaigns.map((campaign) => (
                        <button
                          key={campaign.id}
                          onClick={() => handleCampaignChange(campaign.id)}
                          className={`w-full px-4 py-2 text-left transition-colors hover:bg-[#252525] ${
                            campaign.id === selectedCampaign ? 'text-[#FF3D71]' : 'text-white'
                          }`}
                          type="button"
                        >
                          {campaign.name}
                        </button>
                      ))}
                      <div className="mt-2 border-t border-[#404040] pt-2">
                        <button
                          onClick={createNewCampaign}
                          className="flex w-full items-center gap-2 px-4 py-2 text-left text-gray-400 transition-colors hover:bg-[#252525] hover:text-white"
                          type="button"
                        >
                          <Plus className="h-4 w-4" />
                          New Campaign
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* User Dropdown */}
            <div className="relative" ref={userDropdownRef}>
              <button
                onClick={() => setShowUserDropdown((prev) => !prev)}
                className="flex items-center gap-2 text-white transition-colors hover:text-gray-300"
                type="button"
              >
                <UserButton afterSignOutUrl="/" />
                <ChevronDown className="h-4 w-4 text-gray-400" />
              </button>

              {/* User Menu Dropdown */}
              {showUserDropdown && (
                <div className="absolute right-0 top-full z-50 mt-2 min-w-[220px] rounded-lg border border-[#404040] bg-[#1A1A1A] py-2 shadow-xl">
                  <button
                    onClick={() => {
                      router.push('/dashboard')
                      setShowUserDropdown(false)
                    }}
                    className={`flex w-full items-center gap-2 px-4 py-2 text-left transition-colors hover:bg-[#252525] ${
                      pathname === '/dashboard' ? 'text-[#FF3D71]' : 'text-white'
                    }`}
                    type="button"
                  >
                    <LayoutDashboard className="h-4 w-4" />
                    Dashboard
                  </button>
                  <button
                    onClick={() => {
                      router.push('/dashboard/autopilot')
                      setShowUserDropdown(false)
                    }}
                    className={`flex w-full items-center gap-2 px-4 py-2 text-left transition-colors hover:bg-[#252525] ${
                      pathname === '/dashboard/autopilot' ? 'text-[#FF3D71]' : 'text-white'
                    }`}
                    type="button"
                  >
                    <Zap className="h-4 w-4" />
                    AutoPilot
                  </button>
                  <button
                    onClick={() => {
                      router.push('/dashboard/campaigns')
                      setShowUserDropdown(false)
                    }}
                    className={`flex w-full items-center gap-2 px-4 py-2 text-left transition-colors hover:bg-[#252525] ${
                      pathname === '/dashboard/campaigns' ? 'text-[#FF3D71]' : 'text-white'
                    }`}
                    type="button"
                  >
                    <Activity className="h-4 w-4" />
                    Campaigns
                  </button>
                  <div className="my-2 border-t border-[#404040]" />
                  <button
                    onClick={() => {
                      router.push('/dashboard/settings')
                      setShowUserDropdown(false)
                    }}
                    className={`flex w-full items-center gap-2 px-4 py-2 text-left transition-colors hover:bg-[#252525] ${
                      pathname === '/dashboard/settings' ? 'text-[#FF3D71]' : 'text-white'
                    }`}
                    type="button"
                  >
                    <SettingsIcon className="h-4 w-4" />
                    Settings
                  </button>
                  <button
                    onClick={() => {
                      router.push('/dashboard/billing')
                      setShowUserDropdown(false)
                    }}
                    className="flex w-full items-center gap-2 px-4 py-2 text-left text-white transition-colors hover:bg-[#252525]"
                    type="button"
                  >
                    <CreditCard className="h-4 w-4" />
                    Billing
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-6 py-6">{children}</main>
    </div>
  )
}
