import prisma from "@/lib/db";
import { calculatePercentageDifference } from "@/lib/utils";
import { Prisma } from "@prisma/client";
import { subDays } from "date-fns";
import { requireUser } from "../shared";
import { getLocalDayRange } from "./shared";

export interface TopActivityType {
  label: string;
  hours: number;
}

// Auth guard sits outside the try so an unauthenticated call surfaces
// "Not authenticated" rather than this function's generic message.
export const getJobsAppliedForPeriod = async (
  daysAgo: number,
): Promise<any | undefined> => {
  const user = await requireUser();

  try {
    const startDate1 = subDays(new Date(), daysAgo);
    const startDate2 = subDays(new Date(), daysAgo * 2);
    const endDate = new Date();
    const query = (date: Date): Prisma.JobCountArgs => ({
      where: {
        userId: user.id,
        applied: true,
        appliedDate: {
          gte: date,
          lt: endDate,
        },
      },
    });

    const [count, count2] = await prisma.$transaction([
      prisma.job.count(query(startDate1)),
      prisma.job.count(query(startDate2)),
    ]);
    const difference = Math.abs(count2 - count);
    const trend = calculatePercentageDifference(difference, count);
    return { count, trend };
  } catch (error) {
    const msg = "Failed to calculate job count";
    console.error(msg, error);
    throw new Error(msg);
  }
};

// Auth guard sits outside the try, as above.
export const getTopActivityTypesByDuration = async (
  daysAgo: number,
): Promise<TopActivityType[]> => {
  const user = await requireUser();

  try {
    const { start: startDate, end: today } = getLocalDayRange(daysAgo - 1);

    const activities = await prisma.activity.findMany({
      where: {
        userId: user.id,
        startTime: {
          gte: startDate,
          lte: today,
        },
      },
      select: {
        duration: true,
        activityType: {
          select: {
            label: true,
          },
        },
      },
    });

    const groupedByType = activities.reduce(
      (acc: Record<string, number>, activity) => {
        const label = activity.activityType?.label || "Unknown";
        const durationInHours = (activity.duration || 0) / 60;
        acc[label] = (acc[label] || 0) + durationInHours;
        return acc;
      },
      {},
    );

    const sorted = Object.entries(groupedByType)
      .map(([label, hours]) => ({ label, hours: Math.round(hours * 10) / 10 }))
      .sort((a, b) => b.hours - a.hours)
      .slice(0, 3);

    return sorted;
  } catch (error) {
    const msg = "Failed to fetch top activity types";
    console.error(msg, error);
    throw new Error(msg);
  }
};
