import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase";

type UserStatsRow = {
  posts_used: number | null;
  posts_limit: number | null;
  videos_used: number | null;
  videos_limit: number | null;
  emails_used: number | null;
  emails_limit: number | null;
  plan_type: string | null;
  autopilot_active: boolean | null;
};

const toNumber = (value: number | null | undefined) => value ?? 0;

export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await supabaseAdmin
      .from("users")
      .select(
        "posts_used, posts_limit, videos_used, videos_limit, emails_used, emails_limit, plan_type, autopilot_active"
      )
      .eq("clerk_user_id", userId)
      .single<UserStatsRow>();

    if (error) {
      console.error("Failed to load dashboard stats:", error);
      return NextResponse.json(
        { error: "Unable to load dashboard stats" },
        { status: error.code === "PGRST116" ? 404 : 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    const postsUsed = toNumber(data.posts_used);
    const videosUsed = toNumber(data.videos_used);
    const emailsUsed = toNumber(data.emails_used);

    const postsLimit = toNumber(data.posts_limit);
    const videosLimit = toNumber(data.videos_limit);
    const emailsLimit = toNumber(data.emails_limit);

    const response = {
      postsUsed,
      postsLimit,
      videosUsed,
      videosLimit,
      emailsUsed,
      emailsLimit,
      planType: (data.plan_type || "free").toLowerCase(),
      autopilotActive: Boolean(data.autopilot_active),
      totalContent: postsUsed + videosUsed + emailsUsed,
      totalReach: 0,
    };

    return NextResponse.json(response);
  } catch (err) {
    console.error("Unexpected error fetching dashboard stats:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
