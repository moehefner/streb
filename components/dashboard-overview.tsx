"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useUsage } from "@/hooks/use-usage";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  FileText,
  Video,
  Mail,
  Plus,
  Play,
  Send,
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  ResponsiveContainer,
  BarChart,
  Bar,
  Tooltip,
} from "recharts";

const PLAN_PRICE: Record<string, string> = {
  free: "$0/month",
  starter: "$49/month",
  pro: "$99/month",
  agency: "$249/month",
};

const PIE_THEME = {
  posts: { used: "#FF3D71", remaining: "#282828" },
  videos: { used: "#7C3AED", remaining: "#282828" },
  outreach: { used: "#06B6D4", remaining: "#282828" },
};

const weeklyContentData = [
  { day: "Mon", posts: 0, videos: 0, emails: 0 },
  { day: "Tue", posts: 0, videos: 0, emails: 0 },
  { day: "Wed", posts: 0, videos: 0, emails: 0 },
  { day: "Thu", posts: 0, videos: 0, emails: 0 },
  { day: "Fri", posts: 0, videos: 0, emails: 0 },
  { day: "Sat", posts: 0, videos: 0, emails: 0 },
  { day: "Sun", posts: 0, videos: 0, emails: 0 },
];

const reachGrowthData = [
  { week: "W1", value: 0 },
  { week: "W2", value: 0 },
  { week: "W3", value: 0 },
  { week: "W4", value: 0 },
];

type DashboardStats = {
  postsUsed: number;
  postsLimit: number;
  videosUsed: number;
  videosLimit: number;
  emailsUsed: number;
  emailsLimit: number;
  planType: string;
  autopilotActive: boolean;
  totalContent: number;
  totalReach: number;
};

type CampaignSummary = {
  id: string;
  name: string;
};

type CampaignActivity = {
  id: string;
  type: string;
  action: string;
  timestamp: string;
  result?: string;
  details?: Record<string, unknown>;
};

type CampaignStatus = {
  isActive: boolean;
  isPaused: boolean;
  limitsReached: boolean;
  nextAction?: string | null;
};

type ActiveCampaignConfig = {
  outreachSenderEmail: string;
  outreachSenderVerified: boolean;
};

const DEFAULT_STATS: DashboardStats = {
  postsUsed: 0,
  postsLimit: 0,
  videosUsed: 0,
  videosLimit: 0,
  emailsUsed: 0,
  emailsLimit: 0,
  planType: "free",
  autopilotActive: false,
  totalContent: 0,
  totalReach: 0,
};

interface DashboardOverviewProps {
  userName: string;
}

const iconWrap =
  "flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-b from-white to-[#C0C0C0] shadow-[0_2px_4px_rgba(0,0,0,0.3)]";
const glossyWhite =
  "text-white [text-shadow:0_0_1px_rgba(255,255,255,0.6)]";
const usageThreshold = 0.8;

const buildUsageData = (used: number, limit: number) => [
  { name: "Used", value: used },
  { name: "Remaining", value: Math.max(0, limit - used) },
];

const percentageUsed = (used: number, limit: number) =>
  limit > 0 ? Math.round((used / limit) * 100) : 0;

const formatPlanLabel = (plan: string) =>
  plan.charAt(0).toUpperCase() + plan.slice(1);

const getNextPlanSlug = (plan: string): "starter" | "pro" | "agency" => {
  const normalized = (plan || "free").toLowerCase()
  if (normalized === "free") return "starter"
  if (normalized === "starter") return "pro"
  return "agency"
}

const formatActivityTime = (timestamp: string) => {
  const parsed = new Date(timestamp);
  if (Number.isNaN(parsed.getTime())) {
    return timestamp;
  }

  return parsed.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const SkeletonCard = () => (
  <Skeleton className="h-40 w-full rounded-2xl bg-[#1A1A1A]" />
);

export function DashboardOverview({ userName }: DashboardOverviewProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { usage } = useUsage();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [campaigns, setCampaigns] = useState<CampaignSummary[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [activeCampaign, setActiveCampaign] = useState<ActiveCampaignConfig | null>(null);
  const [activities, setActivities] = useState<CampaignActivity[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [campaignStatus, setCampaignStatus] = useState<CampaignStatus | null>(null);
  const [showVerificationBanner, setShowVerificationBanner] = useState(false);
  const [senderEmail, setSenderEmail] = useState("");
  const [isResendingVerification, setIsResendingVerification] = useState(false);
  const [toastState, setToastState] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const verifyStatus = searchParams.get("verify");

  const toast = useMemo(
    () => ({
      success: (message: string) => setToastState({ type: "success", message }),
      error: (message: string) => setToastState({ type: "error", message }),
    }),
    []
  );

  const fetchStats = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/dashboard/stats", {
        cache: "no-store",
      });

      if (response.status === 401 || response.status === 404) {
        router.replace("/sign-in");
        return;
      }

      if (!response.ok) {
        throw new Error("Failed to load dashboard stats");
      }

      const payload: DashboardStats = await response.json();
      setStats(payload);
    } catch (err) {
      console.error("Error fetching dashboard stats", err);
      setError("We couldn't load your dashboard data. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  const fetchCampaigns = useCallback(async () => {
    try {
      const response = await fetch("/api/campaigns/list", {
        cache: "no-store",
      });

      if (response.status === 401 || response.status === 404) {
        router.replace("/sign-in");
        return;
      }

      if (!response.ok) {
        throw new Error("Failed to load campaigns");
      }

      const payload = (await response.json()) as {
        success?: boolean;
        campaigns?: CampaignSummary[];
      };

      if (!payload.success) {
        throw new Error("Failed to load campaigns");
      }

      const fetchedCampaigns = payload.campaigns || [];
      setCampaigns(fetchedCampaigns);

      if (fetchedCampaigns.length === 0) {
        setSelectedCampaignId(null);
        router.replace("/onboarding");
        return;
      }

      const storedCampaignId = localStorage.getItem("selectedCampaign");
      const hasStoredCampaign = fetchedCampaigns.some(
        (campaign) => campaign.id === storedCampaignId
      );

      const nextCampaignId = hasStoredCampaign
        ? storedCampaignId!
        : fetchedCampaigns[0].id;

      setSelectedCampaignId(nextCampaignId);
      localStorage.setItem("selectedCampaign", nextCampaignId);
    } catch (err) {
      console.error("Error fetching campaigns", err);
    }
  }, [router]);

  const fetchCampaignActivity = useCallback(
    async (campaignId: string) => {
      setActivityLoading(true);
      try {
        const response = await fetch(
          `/api/autopilot/activity?campaign_id=${encodeURIComponent(campaignId)}`,
          { cache: "no-store" }
        );

        if (!response.ok) {
          throw new Error("Failed to load activity");
        }

        const payload = (await response.json()) as {
          success?: boolean;
          activities?: CampaignActivity[];
        };

        if (!payload.success) {
          throw new Error("Failed to load activity");
        }

        setActivities(payload.activities || []);
      } catch (err) {
        console.error("Error fetching campaign activity", err);
        setActivities([]);
      } finally {
        setActivityLoading(false);
      }
    },
    []
  );

  const fetchCampaignStatus = useCallback(async (campaignId: string) => {
    try {
      const response = await fetch(
        `/api/autopilot/status?campaign_id=${encodeURIComponent(campaignId)}`,
        { cache: "no-store" }
      );

      if (!response.ok) {
        throw new Error("Failed to load AutoPilot status");
      }

      const payload = (await response.json()) as {
        success?: boolean;
        status?: CampaignStatus;
      };

      if (!payload.success || !payload.status) {
        throw new Error("Failed to load AutoPilot status");
      }

      setCampaignStatus(payload.status);
    } catch (err) {
      console.error("Error fetching campaign status", err);
      setCampaignStatus(null);
    }
  }, []);

  const fetchActiveCampaign = useCallback(async (campaignId: string) => {
    try {
      const response = await fetch(
        `/api/autopilot/config?campaign_id=${encodeURIComponent(campaignId)}`,
        { cache: "no-store" }
      );

      if (!response.ok) {
        throw new Error("Failed to load campaign config");
      }

      const payload = (await response.json()) as {
        success?: boolean;
        config?: {
          outreachSenderEmail?: string;
          outreachSenderVerified?: boolean;
        } | null;
      };

      if (!payload.success) {
        throw new Error("Failed to load campaign config");
      }

      const config = payload.config;
      setActiveCampaign(
        config
          ? {
              outreachSenderEmail: config.outreachSenderEmail || "",
              outreachSenderVerified: Boolean(config.outreachSenderVerified),
            }
          : null
      );
    } catch (err) {
      console.error("Error fetching campaign config", err);
      setActiveCampaign(null);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  useEffect(() => {
    if (!selectedCampaignId) {
      setActivities([]);
      setCampaignStatus(null);
      setActiveCampaign(null);
      return;
    }

    fetchCampaignActivity(selectedCampaignId);
    fetchCampaignStatus(selectedCampaignId);
    fetchActiveCampaign(selectedCampaignId);
  }, [fetchActiveCampaign, fetchCampaignActivity, fetchCampaignStatus, selectedCampaignId]);

  useEffect(() => {
    const syncCampaignSelection = () => {
      const storedCampaignId = localStorage.getItem("selectedCampaign");
      if (!storedCampaignId) {
        return;
      }

      if (storedCampaignId !== selectedCampaignId) {
        setSelectedCampaignId(storedCampaignId);
      }
    };

    window.addEventListener("storage", syncCampaignSelection);
    window.addEventListener("focus", syncCampaignSelection);

    return () => {
      window.removeEventListener("storage", syncCampaignSelection);
      window.removeEventListener("focus", syncCampaignSelection);
    };
  }, [selectedCampaignId]);

  useEffect(() => {
    if (activeCampaign?.outreachSenderEmail && !activeCampaign?.outreachSenderVerified) {
      setShowVerificationBanner(true);
      setSenderEmail(activeCampaign.outreachSenderEmail);
      return;
    }

    setShowVerificationBanner(false);
    setSenderEmail("");
  }, [activeCampaign]);

  useEffect(() => {
    if (!verifyStatus) {
      return;
    }

    if (verifyStatus === "success") {
      toast.success("Email verified! Outreach will start on next cycle.");
      setShowVerificationBanner(false);
      setActiveCampaign((previous) =>
        previous
          ? {
              ...previous,
              outreachSenderVerified: true,
            }
          : previous
      );
    } else if (verifyStatus === "expired") {
      toast.error("Verification link expired. Please request a new one.");
    } else if (verifyStatus === "invalid" || verifyStatus === "error") {
      toast.error("Verification failed. Please contact support.");
    }

    router.replace(pathname);
  }, [pathname, router, toast, verifyStatus]);

  useEffect(() => {
    if (!toastState) {
      return;
    }

    const timeout = window.setTimeout(() => setToastState(null), 4000);
    return () => window.clearTimeout(timeout);
  }, [toastState]);

  const resolvedStats = stats ?? DEFAULT_STATS;
  const postsUsed = usage?.posts.used ?? resolvedStats.postsUsed;
  const postsLimit = usage?.posts.limit ?? resolvedStats.postsLimit;
  const videosUsed = usage?.videos.used ?? resolvedStats.videosUsed;
  const videosLimit = usage?.videos.limit ?? resolvedStats.videosLimit;
  const emailsUsed = usage?.outreach.used ?? resolvedStats.emailsUsed;
  const emailsLimit = usage?.outreach.limit ?? resolvedStats.emailsLimit;
  const planType = (usage?.plan || resolvedStats.planType || "free").toLowerCase();
  const planLabel = formatPlanLabel(planType);
  const planPrice = PLAN_PRICE[planType] ?? PLAN_PRICE.free;
  const selectedCampaignName =
    campaigns.find((campaign) => campaign.id === selectedCampaignId)?.name ||
    "No campaign selected";
  const nextPlanSlug = getNextPlanSlug(planType)

  const postsData = useMemo(() => buildUsageData(postsUsed, postsLimit), [postsUsed, postsLimit]);
  const videosData = useMemo(() => buildUsageData(videosUsed, videosLimit), [videosUsed, videosLimit]);
  const outreachData = useMemo(() => buildUsageData(emailsUsed, emailsLimit), [emailsUsed, emailsLimit]);

  const postsPct = usage?.posts.percentage ?? percentageUsed(postsUsed, postsLimit);
  const videosPct = usage?.videos.percentage ?? percentageUsed(videosUsed, videosLimit);
  const emailsPct = usage?.outreach.percentage ?? percentageUsed(emailsUsed, emailsLimit);

  const usageWarnings = useMemo(() => {
    const limits = [
      {
        key: "posts",
        label: "posts",
        used: postsUsed,
        limit: postsLimit,
        percentage: postsPct,
      },
      {
        key: "videos",
        label: "videos",
        used: videosUsed,
        limit: videosLimit,
        percentage: videosPct,
      },
      {
        key: "emails",
        label: "emails",
        used: emailsUsed,
        limit: emailsLimit,
        percentage: emailsPct,
      },
    ];

    return limits
      .filter(
        (item) => item.limit > 0 && item.percentage / 100 >= usageThreshold
      )
      .map((item) => ({
        id: item.key,
        message: `Warning: You've used ${Math.round(
          item.percentage
        )}% of your ${item.label}`,
      }));
  }, [
    postsUsed,
    postsLimit,
    videosUsed,
    videosLimit,
    emailsUsed,
    emailsLimit,
    postsPct,
    videosPct,
    emailsPct,
  ]);

  const autopilotStatus = campaignStatus?.limitsReached
    ? "Limits Reached"
    : campaignStatus?.isActive
      ? campaignStatus.isPaused
        ? "Paused"
        : "Active"
      : resolvedStats.autopilotActive
        ? "Active"
        : "Inactive";

  const autopilotSubtext = campaignStatus?.nextAction
    ? campaignStatus.nextAction
    : campaignStatus?.isActive
      ? "Running your outreach"
      : "Not activated";

  const renderSkeleton = () => (
    <div className="space-y-8 font-semibold">
      <Skeleton className="h-24 w-full rounded-2xl bg-[#1A1A1A]" />
      <div className="grid gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, idx) => (
          <SkeletonCard key={`metric-${idx}`} />
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, idx) => (
          <SkeletonCard key={`usage-${idx}`} />
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {Array.from({ length: 2 }).map((_, idx) => (
          <SkeletonCard key={`chart-${idx}`} />
        ))}
      </div>
    </div>
  );

  const handleCampaignSelect = (campaignId: string) => {
    setSelectedCampaignId(campaignId);
    localStorage.setItem("selectedCampaign", campaignId);
  };

  if (isLoading && !stats) {
    return renderSkeleton();
  }

  return (
    <div className="space-y-8 font-semibold">
      {toastState && (
        <div
          className={`fixed right-4 top-4 z-50 rounded-lg px-4 py-3 text-sm text-white shadow-lg ${
            toastState.type === "success" ? "bg-emerald-600" : "bg-red-600"
          }`}
        >
          {toastState.message}
        </div>
      )}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className={`text-3xl font-bold ${glossyWhite}`}>
            Welcome back, {userName}!
          </h1>
          <p className={`mt-1 font-semibold ${glossyWhite}`}>
            Here&apos;s what&apos;s happening with your marketing automation
          </p>
          <p className="mt-2 text-sm text-gray-400">
            Campaign: {selectedCampaignName}
          </p>
          {campaigns.length > 0 && (
            <div className="mt-3">
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-400">
                Selected Campaign
              </label>
              <select
                value={selectedCampaignId || ""}
                onChange={(event) => handleCampaignSelect(event.target.value)}
                className="w-full max-w-sm rounded-lg border border-[#404040] bg-[#1A1A1A] px-3 py-2 text-sm text-white outline-none focus:border-[#FF3D71]"
              >
                {campaigns.map((campaign) => (
                  <option key={campaign.id} value={campaign.id}>
                    {campaign.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-3">
          <Button className="border border-gray-500/50 bg-gradient-to-b from-white via-[#E8E8E8] to-[#C0C0C0] font-medium text-[#1A1A1A] shadow-[0_1px_3px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.8)] hover:from-[#F5F5F5] hover:via-[#E0E0E0] hover:to-[#B8B8B8]">
            <Plus className="mr-2 h-4 w-4" />
            Create Post
          </Button>
          <Button className="border border-gray-500/50 bg-gradient-to-b from-white via-[#E8E8E8] to-[#C0C0C0] font-medium text-[#1A1A1A] shadow-[0_1px_3px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.8)] hover:from-[#F5F5F5] hover:via-[#E0E0E0] hover:to-[#B8B8B8]">
            <Play className="mr-2 h-4 w-4" />
            Create Video
          </Button>
          <Button className="border border-gray-500/50 bg-gradient-to-b from-white via-[#E8E8E8] to-[#C0C0C0] font-medium text-[#1A1A1A] shadow-[0_1px_3px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.8)] hover:from-[#F5F5F5] hover:via-[#E0E0E0] hover:to-[#B8B8B8]">
            <Send className="mr-2 h-4 w-4" />
            Start Campaign
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-900/40 bg-[#2B1415] p-4 text-sm text-red-100">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <span>{error}</span>
            <Button
              variant="outline"
              className="border-red-500/50 text-red-100 hover:bg-red-900/20"
              onClick={fetchStats}
            >
              Retry
            </Button>
          </div>
        </div>
      )}

      {usage?.needsUpgrade && (
        <div className="mb-6 rounded-lg bg-gradient-to-r from-orange-500 to-red-500 p-4 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold">You&apos;re running low on credits!</h3>
              <p className="text-sm opacity-90">
                {usage.posts.used}/{usage.posts.limit} posts used this month
              </p>
            </div>
            <Link href="/pricing?plan=pro">
              <Button variant="secondary">Upgrade Now</Button>
            </Link>
          </div>
        </div>
      )}

      {usage && usage.posts.used >= usage.posts.limit && (
        <div className="mb-6 rounded-lg bg-red-500 p-4 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold">Monthly limit reached!</h3>
              <p className="text-sm opacity-90">
                AutoPilot is paused until next billing cycle or upgrade.
              </p>
            </div>
            <Link href="/pricing">
              <Button variant="secondary">Upgrade Plan</Button>
            </Link>
          </div>
        </div>
      )}

      {planType === "free" && (
        <div className="rounded-2xl border border-amber-500/40 bg-[#1F1503] p-4 text-sm text-amber-100">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <p className="font-medium">{"\u26A1"} Upgrade to Starter for 100 posts/month and unlock higher limits.</p>
            <Button asChild size="sm" className="bg-amber-400 text-black hover:bg-amber-300">
              <Link href={`/pricing?plan=${nextPlanSlug}`}>Upgrade Now</Link>
            </Button>
          </div>
        </div>
      )}

      {usageWarnings.length > 0 && (
        <div className="space-y-3">
          {usageWarnings.map((warning) => (
            <div
              key={warning.id}
              className="flex flex-col gap-3 rounded-2xl border border-yellow-500/20 bg-[#2A230C] p-4 text-sm text-yellow-100 md:flex-row md:items-center md:justify-between"
            >
              <span>{warning.message}</span>
              <Button
                asChild
                size="sm"
                className="bg-yellow-400 text-black hover:bg-yellow-300"
              >
                <Link href={`/pricing?plan=${nextPlanSlug}`}>Upgrade</Link>
              </Button>
            </div>
          ))}
        </div>
      )}

      {showVerificationBanner && (
        <div className="mb-6 rounded-lg border border-orange-300 bg-orange-50 p-4 dark:bg-orange-950">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="font-semibold text-orange-900 dark:text-orange-100">
                Verify your sender email
              </h3>
              <p className="text-sm text-orange-700 dark:text-orange-300">
                We sent a verification email to <strong>{senderEmail}</strong>. Outreach won&apos;t
                start until verified.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                if (!selectedCampaignId) {
                  toast.error("No campaign selected.")
                  return
                }

                if (isResendingVerification) {
                  return
                }

                setIsResendingVerification(true)

                try {
                  const res = await fetch("/api/resend-verification", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ campaignId: selectedCampaignId }),
                  })

                  if (res.ok) {
                    toast.success("Verification email sent!")
                  } else {
                    const data = (await res.json().catch(() => ({}))) as { error?: string }
                    toast.error(data.error || "Failed to send")
                  }
                } catch {
                  toast.error("Failed to send")
                } finally {
                  setIsResendingVerification(false)
                }
              }}
              disabled={isResendingVerification}
            >
              {isResendingVerification ? "Sending..." : "Resend Email"}
            </Button>
          </div>
        </div>
      )}

      {/* Top row: 4 metric cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card
          className={`border-[#404040] ${
            postsPct >= 80 ? "bg-[#3A2B1A]" : "bg-[#2A2A2A]"
          }`}
        >
          <CardContent className="pt-6 text-center">
            <div className="flex flex-col items-center justify-center gap-2">
              <div className={iconWrap}>
                <span className="text-lg">{"\u{1F4CA}"}</span>
              </div>
              <p className={`text-base ${glossyWhite}`}>Total Content</p>
              <p className={`text-3xl font-bold ${glossyWhite}`}>
                {resolvedStats.totalContent}
              </p>
              <p className={`text-sm ${glossyWhite}`}>This month</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-[#404040] bg-[#2A2A2A]">
          <CardContent className="pt-6 text-center">
            <div className="flex flex-col items-center justify-center gap-2">
              <div className={iconWrap}>
                <span className="text-lg">{"\u{1F465}"}</span>
              </div>
              <p className={`text-base ${glossyWhite}`}>Total Reach</p>
              <p className={`text-3xl font-bold ${glossyWhite}`}>
                {resolvedStats.totalReach}
              </p>
              <p className={`text-sm ${glossyWhite}`}>
                People reached across all platforms
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-[#404040] bg-[#2A2A2A]">
          <CardContent className="pt-6 text-center">
            <div className="flex flex-col items-center justify-center gap-2">
              <div className={iconWrap}>
                <span className="text-lg">{"\u{1F916}"}</span>
              </div>
              <p className={`text-base ${glossyWhite}`}>AutoPilot</p>
              <p className={`text-3xl font-bold ${glossyWhite}`}>
                {autopilotStatus}
              </p>
              <p className={`text-sm ${glossyWhite}`}>{autopilotSubtext}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-[#404040] bg-[#2A2A2A]">
          <CardContent className="pt-6 text-center">
            <div className="flex flex-col items-center justify-center gap-2">
              <div className={iconWrap}>
                <span className="text-lg">{"\u26A1"}</span>
              </div>
              <p className={`text-base ${glossyWhite}`}>Current Plan</p>
              <p className={`text-3xl font-bold ${glossyWhite}`}>
                {planLabel}
              </p>
              <p className={`text-sm ${glossyWhite}`}>{planPrice}</p>
              {planType !== "agency" && (
                <Button asChild size="sm" className="mt-2">
                  <Link href={`/pricing?plan=${nextPlanSlug}`}>Upgrade</Link>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Middle row: 3 usage cards with circular progress (pie) */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-[#404040] bg-[#2A2A2A]">
          <CardHeader className="pb-2 text-center">
            <div className="mx-auto mb-2 flex justify-center">
              <div
                className={`${iconWrap} h-8 w-8 shadow-[0_1px_3px_rgba(0,0,0,0.3)]`}
              >
                <FileText className="h-4 w-4 text-[#1A1A1A]" />
              </div>
            </div>
            <CardTitle className={`text-lg font-medium ${glossyWhite}`}>
              Posts Usage
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <div className="flex flex-col items-center justify-center gap-3">
              <div className="mx-auto h-24 w-24">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={postsData}
                      dataKey="value"
                      innerRadius={25}
                      outerRadius={40}
                      paddingAngle={2}
                    >
                      <Cell fill={PIE_THEME.posts.used} />
                      <Cell fill={PIE_THEME.posts.remaining} />
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className={`text-4xl font-bold ${glossyWhite}`}>
                {postsUsed} / {postsLimit}
              </div>
              <p className={`text-sm ${glossyWhite}`}>
                {postsPct}% used this month
              </p>
              <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-sm">
                <div className="flex items-center">
                  <div
                    className="mr-2 h-3 w-3 rounded-full"
                    style={{ backgroundColor: PIE_THEME.posts.used }}
                  />
                  <span className={glossyWhite}>
                    Used: {postsUsed}
                  </span>
                </div>
                <div className="flex items-center">
                  <div
                    className="mr-2 h-3 w-3 rounded-full"
                    style={{ backgroundColor: PIE_THEME.posts.remaining }}
                  />
                  <span className={glossyWhite}>
                    Remaining:{" "}
                    {Math.max(
                      0,
                      postsLimit - postsUsed
                    )}
                  </span>
                </div>
              </div>
              {postsPct >= 80 && (
                <p className="mt-2 text-xs text-orange-300">
                  {"\u26A0\uFE0F"} Running low - consider upgrading
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card
          className={`border-[#404040] ${
            videosPct >= 80 ? "bg-[#3A2B1A]" : "bg-[#2A2A2A]"
          }`}
        >
          <CardHeader className="pb-2 text-center">
            <div className="mx-auto mb-2 flex justify-center">
              <div
                className={`${iconWrap} h-8 w-8 shadow-[0_1px_3px_rgba(0,0,0,0.3)]`}
              >
                <Video className="h-4 w-4 text-[#1A1A1A]" />
              </div>
            </div>
            <CardTitle className={`text-lg font-medium ${glossyWhite}`}>
              Videos Usage
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <div className="flex flex-col items-center justify-center gap-3">
              <div className="mx-auto h-24 w-24">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={videosData}
                      dataKey="value"
                      innerRadius={25}
                      outerRadius={40}
                      paddingAngle={2}
                    >
                      <Cell fill={PIE_THEME.videos.used} />
                      <Cell fill={PIE_THEME.videos.remaining} />
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className={`text-4xl font-bold ${glossyWhite}`}>
                {videosUsed} / {videosLimit}
              </div>
              <p className={`text-sm ${glossyWhite}`}>
                {videosPct}% used this month
              </p>
              <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-sm">
                <div className="flex items-center">
                  <div
                    className="mr-2 h-3 w-3 rounded-full"
                    style={{ backgroundColor: PIE_THEME.videos.used }}
                  />
                  <span className={glossyWhite}>
                    Used: {videosUsed}
                  </span>
                </div>
                <div className="flex items-center">
                  <div
                    className="mr-2 h-3 w-3 rounded-full"
                    style={{ backgroundColor: PIE_THEME.videos.remaining }}
                  />
                  <span className={glossyWhite}>
                    Remaining:{" "}
                    {Math.max(
                      0,
                      videosLimit - videosUsed
                    )}
                  </span>
                </div>
              </div>
              {videosPct >= 80 && (
                <p className="mt-2 text-xs text-orange-300">
                  {"\u26A0\uFE0F"} Running low - consider upgrading
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card
          className={`border-[#404040] ${
            emailsPct >= 80 ? "bg-[#3A2B1A]" : "bg-[#2A2A2A]"
          }`}
        >
          <CardHeader className="pb-2 text-center">
            <div className="mx-auto mb-2 flex justify-center">
              <div
                className={`${iconWrap} h-8 w-8 shadow-[0_1px_3px_rgba(0,0,0,0.3)]`}
              >
                <Mail className="h-4 w-4 text-[#1A1A1A]" />
              </div>
            </div>
            <CardTitle className={`text-lg font-medium ${glossyWhite}`}>
              Outreach Emails
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <div className="flex flex-col items-center justify-center gap-3">
              <div className="mx-auto h-24 w-24">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={outreachData}
                      dataKey="value"
                      innerRadius={25}
                      outerRadius={40}
                      paddingAngle={2}
                    >
                      <Cell fill={PIE_THEME.outreach.used} />
                      <Cell fill={PIE_THEME.outreach.remaining} />
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className={`text-4xl font-bold ${glossyWhite}`}>
                {emailsUsed} / {emailsLimit}
              </div>
              <p className={`text-sm ${glossyWhite}`}>
                {emailsPct}% used this month
              </p>
              <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-sm">
                <div className="flex items-center">
                  <div
                    className="mr-2 h-3 w-3 rounded-full"
                    style={{ backgroundColor: PIE_THEME.outreach.used }}
                  />
                  <span className={glossyWhite}>
                    Used: {emailsUsed}
                  </span>
                </div>
                <div className="flex items-center">
                  <div
                    className="mr-2 h-3 w-3 rounded-full"
                    style={{ backgroundColor: PIE_THEME.outreach.remaining }}
                  />
                  <span className={glossyWhite}>
                    Remaining:{" "}
                    {Math.max(
                      0,
                      emailsLimit - emailsUsed
                    )}
                  </span>
                </div>
              </div>
              {emailsPct >= 80 && (
                <p className="mt-2 text-xs text-orange-300">
                  {"\u26A0\uFE0F"} Running low - consider upgrading
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bottom row: 2 charts */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-[#404040] bg-[#2A2A2A]">
          <CardHeader>
            <CardTitle className={`text-center text-lg font-medium ${glossyWhite}`}>
              Content Created This Week
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weeklyContentData}>
                  <XAxis
                    dataKey="day"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#6B6B6B", fontSize: 14 }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#6B6B6B", fontSize: 14 }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#2A2A2A",
                      border: "1px solid #404040",
                      borderRadius: "8px",
                      color: "#FFFFFF",
                    }}
                    labelStyle={{ color: "#A0A0A0" }}
                  />
                  <Bar
                    dataKey="posts"
                    fill="#FF3D71"
                    radius={[4, 4, 0, 0]}
                    name="Posts"
                  />
                  <Bar
                    dataKey="videos"
                    fill="#7C3AED"
                    radius={[4, 4, 0, 0]}
                    name="Videos"
                  />
                  <Bar
                    dataKey="emails"
                    fill="#06B6D4"
                    radius={[4, 4, 0, 0]}
                    name="Emails"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 flex items-center justify-center gap-6">
              <div className="flex items-center text-sm">
                <div className="mr-2 h-3 w-3 rounded bg-[#FF3D71]" />
                <span className="text-gray-400">Posts</span>
              </div>
              <div className="flex items-center text-sm">
                <div className="mr-2 h-3 w-3 rounded bg-[#7C3AED]" />
                <span className="text-gray-400">Videos</span>
              </div>
              <div className="flex items-center text-sm">
                <div className="mr-2 h-3 w-3 rounded bg-[#06B6D4]" />
                <span className="text-gray-400">Emails</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-[#404040] bg-[#2A2A2A]">
          <CardHeader>
            <CardTitle className={`text-center text-lg font-medium ${glossyWhite}`}>
              Total Reach Growth
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={reachGrowthData}>
                  <defs>
                    <linearGradient id="colorReach" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#FFFFFF" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#FFFFFF" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="week"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#6B6B6B", fontSize: 14 }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#6B6B6B", fontSize: 14 }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#2A2A2A",
                      border: "1px solid #404040",
                      borderRadius: "8px",
                      color: "#FFFFFF",
                    }}
                    labelStyle={{ color: "#A0A0A0" }}
                  />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="#FFFFFF"
                    strokeWidth={2}
                    fill="url(#colorReach)"
                    name="Reach"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-[#404040] bg-[#2A2A2A]">
        <CardHeader>
          <CardTitle className={`text-lg font-medium ${glossyWhite}`}>
            Campaign Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          {activityLoading ? (
            <p className="text-sm text-gray-400">Loading activity...</p>
          ) : activities.length === 0 ? (
            <p className="text-sm text-gray-400">
              No activity found for this campaign yet.
            </p>
          ) : (
            <div className="space-y-3">
              {activities.map((activity) => (
                <div
                  key={activity.id}
                  className="rounded-lg border border-[#404040] bg-[#1A1A1A] px-4 py-3"
                >
                  <div className="flex items-start justify-between gap-4">
                    <p className="text-sm font-medium text-white">
                      {activity.action}
                    </p>
                    <span className="whitespace-nowrap text-xs text-gray-400">
                      {formatActivityTime(activity.timestamp)}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center gap-2 text-xs text-gray-400">
                    <span className="rounded-full bg-[#232323] px-2 py-1">
                      {activity.type}
                    </span>
                    <span className="rounded-full bg-[#232323] px-2 py-1">
                      {activity.result || "success"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

