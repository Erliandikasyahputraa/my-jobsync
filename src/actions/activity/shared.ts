import { APP_CONSTANTS } from "@/lib/constants";
import { getCurrentUser } from "@/utils/user.utils";

// Not a "use server" module: it exports selects and sync helpers, so it stays
// internal to src/actions/activity/ and is never imported by a client component.

export const requireUser = async () => {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("Not authenticated");
  }
  return user;
};

// One shape for every action that returns the running activity, so the client
// can never receive a copy missing its break state.
export const RUNNING_ACTIVITY_SELECT = {
  id: true,
  activityName: true,
  startTime: true,
  endTime: true,
  description: true,
  createdAt: true,
  activityType: true,
  breakMinutes: true,
  breakStartedAt: true,
  breakPlannedMins: true,
};

// Completed activities carry duration but no break state
export const ACTIVITY_LIST_SELECT = {
  id: true,
  activityName: true,
  startTime: true,
  endTime: true,
  duration: true,
  description: true,
  createdAt: true,
  activityType: true,
};

export const clampBreakMinutes = (minutes: number) =>
  Math.min(
    Math.max(minutes, APP_CONSTANTS.ACTIVITY_BREAK_MIN_MINUTES),
    APP_CONSTANTS.ACTIVITY_BREAK_MAX_MINUTES,
  );

// Rounded, not floored: repeated short breaks would otherwise be lost entirely.
export const breakMinutesSince = (start: Date, now: Date = new Date()) =>
  Math.max(0, Math.round((now.getTime() - start.getTime()) / 60000));
