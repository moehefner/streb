import { useEffect, useState } from "react";

export interface UsageData {
  posts: { used: number; limit: number; percentage: number; remaining: number };
  videos: { used: number; limit: number; percentage: number; remaining: number };
  outreach: { used: number; limit: number; percentage: number; remaining: number };
  plan: string;
  needsUpgrade: boolean;
}

export function useUsage() {
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    fetch("/api/usage/check", { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => {
        if (!mounted) return;
        setUsage(data as UsageData);
      })
      .catch((error) => {
        console.error("Failed to fetch usage data", error);
        if (!mounted) return;
        setUsage(null);
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  return { usage, loading };
}

