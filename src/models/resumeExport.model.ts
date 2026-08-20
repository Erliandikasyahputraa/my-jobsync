export type ResumeLayout = "simple" | "professional";

export const RESUME_LAYOUT_LABELS: Record<ResumeLayout, string> = {
  simple: "Simple",
  professional: "Professional",
};

// The preview cache key. Each future setting is one added field here.
export interface ResumeExportSettings {
  template: ResumeLayout;
}

export const defaultResumeExportSettings: ResumeExportSettings = {
  template: "simple",
};
