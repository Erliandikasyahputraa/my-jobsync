"use client";

import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  RESUME_LAYOUT_LABELS,
  type ResumeExportSettings,
  type ResumeLayout,
} from "@/models/resumeExport.model";

const TEMPLATE_OPTIONS: ResumeLayout[] = ["simple", "professional"];

type ExportSettingsPanelProps = {
  settings: ResumeExportSettings;
  onChange: (settings: ResumeExportSettings) => void;
};

// Later settings land as sibling <section> blocks below Template; every
// control emits a whole settings object so the preview cache key stays valid.
export function ExportSettingsPanel({
  settings,
  onChange,
}: ExportSettingsPanelProps) {
  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-lg border bg-muted/40">
        <h3 className="border-b px-4 py-2.5 text-sm font-semibold">Template</h3>
        <RadioGroup
          className="gap-0 px-4"
          value={settings.template}
          onValueChange={(value) =>
            onChange({ ...settings, template: value as ResumeLayout })
          }
        >
          {TEMPLATE_OPTIONS.map((layout) => (
            <div
              key={layout}
              className="flex items-center justify-between gap-3 border-b py-3 last:border-b-0"
            >
              <Label
                htmlFor={`resume-template-${layout}`}
                className="cursor-pointer font-normal"
              >
                {RESUME_LAYOUT_LABELS[layout]}
              </Label>
              <RadioGroupItem
                id={`resume-template-${layout}`}
                value={layout}
              />
            </div>
          ))}
        </RadioGroup>
      </section>
    </div>
  );
}
