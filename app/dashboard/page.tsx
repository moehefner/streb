import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-helpers";
import { DashboardOverview } from "@/components/dashboard-overview";
import { createClient } from "@supabase/supabase-js";

export default async function DashboardPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/sign-in");
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { count, error } = await supabase
    .from("autopilot_configs")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);

  if (!error && (count ?? 0) === 0) {
    redirect("/onboarding");
  }

  return (
    <DashboardOverview
      userName={user.fullName || "User"}
    />
  );
}
