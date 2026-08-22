import { NextResponse } from "next/server";
import { runDueAutomations, reapStaleRuns } from "@/lib/scheduler";

export const maxDuration = 300; // 5 minutes max on Vercel Pro
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  // 1. Verify cron secret
  const authHeader = request.headers.get("Authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.error("[Cron] CRON_SECRET is not configured");
    return NextResponse.json(
      { error: "Server configuration error" },
      { status: 500 }
    );
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    console.error("[Cron] Unauthorized attempt to run cron");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  console.log("[Cron] Starting hourly automations sync");

  try {
    // 2. Reap stale runs from previous crashes/timeouts
    await reapStaleRuns();

    // 3. Find and run due automations
    // We execute synchronously up to maxDuration / timeout limit
    const processedCount = await runDueAutomations();

    return NextResponse.json({
      success: true,
      processed: processedCount,
    });
  } catch (error) {
    console.error("[Cron] Error running automations:", error);
    return NextResponse.json(
      { error: "Internal server error during execution" },
      { status: 500 }
    );
  }
}
