"use client";

import { AgentResumePicker } from "@/components/agent/AgentResumePicker";
import { AgentReviewContent } from "@/components/agent/AgentReviewContent";
import type { AgentReviewResumeResult } from "@/models/agent.model";

// The scores and body come from the tool output, not from parsed prose — the
// review is a server-side generation now, so the card cannot disagree with
// what was saved.
export function ReviewResumeResult({ output }: { output: AgentReviewResumeResult }) {
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
        <p>Which resume?</p>
        <AgentResumePicker resumes={output.resumes} />
      </div>
    );
  }

  if (output.status === "unreadable" || output.status === "generation_failed") {
    return (
      <p className="text-sm">
        Couldn&apos;t review <strong>{output.title}</strong> — {output.reason}
      </p>
    );
  }

  return (
    <div className="text-sm">
      <AgentReviewContent body={output.body} scores={output.scores} />
      {!output.saved && (
        <p className="mt-2 text-xs text-muted-foreground">
          Review not saved — {output.saveError}
        </p>
      )}
    </div>
  );
}
