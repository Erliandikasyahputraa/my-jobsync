"use client";

import { ResponsivePie } from "@nivo/pie";
import { useTheme } from "next-themes";
import { TrendingDown, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { JobsActivitySummary } from "@/actions/dashboard.actions";
import { usePersistedTabIndex } from "@/hooks/usePersistedTabIndex";
import { APP_CONSTANTS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { buildDonutSlices, OTHER_SLICE_ID } from "./jobsActivityChart";

interface JobsActivityCardProps {
  data: {
    label: string;
    summary: JobsActivitySummary;
  }[];
}

export default function JobsActivityCard({ data }: JobsActivityCardProps) {
  const [activeIndex, selectTab] = usePersistedTabIndex(
    APP_CONSTANTS.DASHBOARD_JOBS_ACTIVITY_STORAGE_KEY,
    data.map((item) => item.label),
  );
  const { resolvedTheme } = useTheme();
  const current = data[activeIndex];
  const { jobsApplied, jobsTrend, topActivities, otherHours, totalHours } =
    current.summary;
  const slices = buildDonutSlices(
    topActivities,
    otherHours,
    resolvedTheme === "light" ? "light" : "dark",
  );

  return (
    <Card className="@lg:col-span-2">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-lg text-green-600 min-w-0 truncate">
            Jobs &amp; Activity
          </CardTitle>
          <div
            className="flex shrink-0 rounded-md border text-xs"
            data-testid="jobs-activity-toggle-group"
          >
            {data.map((item, index) => (
              <button
                key={item.label}
                onClick={() => selectTab(index)}
                className={cn(
                  "px-2 py-1 transition-colors",
                  index === 0 && "rounded-l-md",
                  index === data.length - 1 && "rounded-r-md",
                  activeIndex === index
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-muted",
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent className="@container/jobsactivity">
        <div className="flex flex-col items-center gap-4 @sm/jobsactivity:flex-row @sm/jobsactivity:gap-6">
          <div className="relative h-[148px] w-[148px] shrink-0">
            {slices.length === 0 ? (
              <div className="h-full w-full rounded-full border-[20px] border-muted" />
            ) : (
              <ResponsivePie
                data={slices}
                margin={{ top: 4, right: 4, bottom: 4, left: 4 }}
                innerRadius={0.72}
                padAngle={2}
                cornerRadius={2}
                activeOuterRadiusOffset={4}
                colors={{ datum: "data.color" }}
                borderWidth={0}
                enableArcLabels={false}
                enableArcLinkLabels={false}
                theme={{
                  tooltip: {
                    container: { background: "#1e293b", color: "#fff" },
                  },
                }}
                tooltip={({ datum }) => (
                  <div
                    style={{
                      background: "#1e293b",
                      color: "#fff",
                      padding: "6px 12px",
                      borderRadius: "4px",
                      fontSize: "12px",
                      whiteSpace: "nowrap",
                    }}
                  >
                    <strong>{datum.data.label}</strong> — {datum.value}h
                  </div>
                )}
              />
            )}
            <div
              className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-px text-center"
              data-testid="jobs-activity-total"
            >
              <span className="text-xl font-bold leading-tight tabular-nums">
                {totalHours}h
              </span>
              <span className="text-sm text-muted-foreground tabular-nums">
                {jobsApplied} {jobsApplied === 1 ? "job" : "jobs"}
              </span>
              {jobsTrend !== 0 && (
                <span
                  className={cn(
                    "flex items-center gap-0.5 text-[10px] tabular-nums",
                    jobsTrend > 0 ? "text-emerald-600" : "text-rose-600",
                  )}
                >
                  {jobsTrend > 0 ? (
                    <TrendingUp className="h-3 w-3" />
                  ) : (
                    <TrendingDown className="h-3 w-3" />
                  )}
                  {Math.abs(jobsTrend)}%
                </span>
              )}
            </div>
          </div>

          <div
            className="flex w-full min-w-0 flex-col gap-2.5"
            data-testid="jobs-activity-legend"
          >
            {slices.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No activities recorded
              </p>
            ) : (
              slices.map((slice) => (
                <div
                  key={slice.id}
                  className="flex min-w-0 items-center gap-2.5 text-sm"
                >
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-sm"
                    style={{ backgroundColor: slice.color }}
                  />
                  <span
                    className={cn(
                      "min-w-0 truncate",
                      slice.id === OTHER_SLICE_ID && "text-muted-foreground",
                    )}
                  >
                    {slice.label}
                  </span>
                  <span
                    className={cn(
                      "ml-auto shrink-0 font-semibold tabular-nums",
                      slice.id === OTHER_SLICE_ID && "text-muted-foreground",
                    )}
                  >
                    {slice.value}h
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
