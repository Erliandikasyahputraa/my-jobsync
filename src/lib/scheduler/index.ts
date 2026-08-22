import { SCHEDULER_CONSTANTS } from "@/lib/constants";
import db from "@/lib/db";
import { runAutomation, AutomationAlreadyRunningError } from "@/lib/scraper";
import type { JobBoard } from "@/models/automation.model";

export async function runDueAutomations(): Promise<number> {
  const now = new Date();
  console.log(`[Scheduler] Checking for due automations at ${now.toISOString()}`);

  try {
    const dueAutomations = await db.automation.findMany({
      where: {
        status: "active",
        nextRunAt: { lte: now },
      },
      include: {
        resume: true,
      },
    });

    if (dueAutomations.length === 0) {
      console.log("[Scheduler] No automations due to run");
      return 0;
    }

    console.log(`[Scheduler] Found ${dueAutomations.length} automation(s) to run`);

    let processed = 0;

    for (const automation of dueAutomations) {
      if (!automation.resume) {
        console.log(`[Scheduler] Skipping automation ${automation.id} - no resume`);
        await db.automationRun.create({
          data: {
            automationId: automation.id,
            status: "failed",
            errorMessage: "resume_missing",
            completedAt: new Date(),
          },
        });
        continue;
      }

      // Check if a run is already active (optimistic check before atomic claim)
      const activeRun = await db.automationRun.findFirst({
        where: {
          automationId: automation.id,
          status: { in: ["running", "cancelling"] },
        },
        select: { id: true },
      });
      if (activeRun) {
        console.log(`[Scheduler] Skipping automation ${automation.id} - run already in progress`);
        continue;
      }

      try {
        console.log(`[Scheduler] Running automation: ${automation.name}`);
        // runAutomation performs an atomic claim internally.
        // It throws AutomationAlreadyRunningError if it loses the race.
        const result = await runAutomation({
          id: automation.id,
          userId: automation.userId,
          name: automation.name,
          jobBoard: automation.jobBoard as JobBoard,
          keywords: automation.keywords,
          location: automation.location,
          sourceConfig: automation.sourceConfig,
          resumeId: automation.resumeId,
          matchThreshold: automation.matchThreshold,
          scheduleHour: automation.scheduleHour,
          nextRunAt: automation.nextRunAt,
          lastRunAt: automation.lastRunAt,
          status: automation.status as "active" | "paused",
          createdAt: automation.createdAt,
          updatedAt: automation.updatedAt,
        });
        console.log(`[Scheduler] Automation ${automation.name} completed: ${result.status}, saved ${result.jobsSaved} jobs`);
        processed++;
      } catch (error) {
        if (error instanceof AutomationAlreadyRunningError) {
          console.log(`[Scheduler] Skipping automation ${automation.id} - run already in progress`);
          continue;
        }
        const message = error instanceof Error ? error.message : "Unknown error";
        console.error(`[Scheduler] Automation ${automation.name} failed:`, message);
      }
    }
    
    return processed;
  } catch (error) {
    console.error("[Scheduler] Error running due automations:", error);
    return 0;
  }
}


// Marks any run stuck in "running" past the stale cutoff as failed. A hard kill
// mid-run (deploy/OOM/crash) leaves the run row in "running" forever otherwise.
export async function reapStaleRuns(): Promise<number> {
  const cutoff = new Date(Date.now() - SCHEDULER_CONSTANTS.STALE_RUN_TIMEOUT_MS);
  try {
    const result = await db.automationRun.updateMany({
      where: { status: "running", startedAt: { lt: cutoff } },
      data: {
        status: "failed",
        errorMessage: "interrupted",
        completedAt: new Date(),
      },
    });
    if (result.count > 0) {
      console.log(`[Scheduler] Reaped ${result.count} stale running run(s)`);
    }
    return result.count;
  } catch (error) {
    console.error("[Scheduler] Failed to reap stale runs:", error);
    return 0;
  }
}


