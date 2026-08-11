"use client";

import { AgentResumePicker } from "@/components/agent/AgentResumePicker";
import { AgentMatchContent } from "@/components/agent/AgentMatchContent";
import type { AgentMatchJobResult } from "@/models/agent.model";

// The score and body come from the tool output, not from parsed prose — the
// match is a server-side generation, so the card cannot disagree with what
// was saved.
export function MatchJobResult({ output }: { output: AgentMatchJobResult }) {
  if (output.status === "no_job") {
    return (
      <p className="text-sm">
        Open the job you want to match first — I score the job you&apos;re
        looking at.
      </p>
    );
  }

  if (output.status === "no_resumes") {
    return (
      <p className="text-sm">
        You don&apos;t have any resumes yet — create one on the Profile page.
      </p>
    );
  }

  if (output.status === "needs_selection") {
    return (
      <div className="text-sm">
        <p>Which resume should I match against?</p>
        <AgentResumePicker
          resumes={output.resumes}
          messageFor={(title) => `Match this job against my resume "${title}"`}
        />
      </div>
    );
  }

  if (output.status === "unreadable") {
    return (
      <p className="text-sm">
        Couldn&apos;t read <strong>{output.title}</strong> — {output.reason}
      </p>
    );
  }

  if (output.status === "generation_failed") {
    return (
      <p className="text-sm">
        Couldn&apos;t match <strong>{output.jobTitle}</strong> — {output.reason}
      </p>
    );
  }

  return (
    <div className="text-sm">
      <AgentMatchContent body={output.body} scores={output.scores} />
      <p className="mt-2 text-xs text-muted-foreground">
        {output.jobTitle}
        {output.company ? ` at ${output.company}` : ""} · matched against{" "}
        {output.resumeTitle}
      </p>
      {!output.saved && (
        <p className="mt-1 text-xs text-muted-foreground">
          Match not saved — {output.saveError}
        </p>
      )}
    </div>
  );
}
