"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronRight, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  clampNumericField,
  formatSettingValue,
  PDF_FONT_LABELS,
  PDF_NUMERIC_SETTINGS,
} from "@/models/pdfExport.model";
import {
  RESUME_LAYOUT_LABELS,
  type ResumeExportSettings,
  type ResumeNumericSetting,
} from "@/models/resumeExport.model";

type ExportSettingsPanelProps = {
  settings: ResumeExportSettings;
  onChange: (settings: ResumeExportSettings) => void;
  onReset?: () => void;
  isDefault?: boolean;
};

// Wraps rather than clips: the control drops below the label on a narrow
// settings column instead of overflowing it.
const ROW =
  "flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b px-4 py-2.5 last:border-b-0";

// A label element pointing at role="combobox" is named inconsistently across
// accname implementations, so the trigger carries its own aria-label.
function SelectRow<T extends string>({
  id,
  label,
  value,
  labels,
  onSelect,
}: {
  id: string;
  label: string;
  value: T;
  labels: Record<T, string>;
  onSelect: (value: T) => void;
}) {
  return (
    <div className={ROW}>
      <Label htmlFor={id} className="cursor-pointer font-normal">
        {label}
      </Label>
      <Select value={value} onValueChange={(next) => onSelect(next as T)}>
        <SelectTrigger id={id} aria-label={label} className="ml-auto h-8 w-40">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {(Object.keys(labels) as T[]).map((key) => (
            <SelectItem key={key} value={key}>
              {labels[key]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

// The draft string is what is typed; only a parsed, in-range value is
// committed upward. Clamping on every keystroke would snap a cleared field
// to its minimum mid-edit.
function StepperRow({
  field,
  value,
  onCommit,
}: {
  field: ResumeNumericSetting;
  value: number;
  onCommit: (value: number) => void;
}) {
  const spec = PDF_NUMERIC_SETTINGS[field];
  const id = `resume-export-${field}`;
  const [draft, setDraft] = useState(() => String(value));

  // Resyncs when the value moves without the input being touched: Reset,
  // or the first read from storage.
  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  const stepBy = (direction: 1 | -1) =>
    onCommit(clampNumericField(field, value + direction * spec.step));

  const onDraftChange = (next: string) => {
    setDraft(next);
    const parsed = Number(next);
    if (next.trim() === "" || !Number.isFinite(parsed)) return;
    if (parsed < spec.min || parsed > spec.max) return;
    onCommit(clampNumericField(field, parsed));
  };

  return (
    <div className={ROW}>
      <Label htmlFor={id} className="cursor-pointer font-normal">
        {spec.label}
      </Label>
      <div className="ml-auto flex items-center gap-1">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-7 w-7 shrink-0"
          aria-label={`Decrease ${spec.label}`}
          disabled={value <= spec.min}
          onClick={() => stepBy(-1)}
        >
          <Minus className="h-3 w-3" aria-hidden />
        </Button>
        <Input
          id={id}
          type="number"
          inputMode="decimal"
          min={spec.min}
          max={spec.max}
          step={spec.step}
          value={draft}
          onChange={(event) => onDraftChange(event.target.value)}
          onBlur={() => setDraft(String(value))}
          className="h-7 w-16 px-2 text-center text-sm"
        />
        {spec.unit && (
          <span className="w-4 text-xs text-muted-foreground">{spec.unit}</span>
        )}
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-7 w-7 shrink-0"
          aria-label={`Increase ${spec.label}`}
          disabled={value >= spec.max}
          onClick={() => stepBy(1)}
        >
          <Plus className="h-3 w-3" aria-hidden />
        </Button>
      </div>
    </div>
  );
}

function DisclosureGroup({
  title,
  summary,
  children,
}: {
  title: string;
  summary: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex w-full items-center gap-1.5 text-sm font-semibold">
        {open ? (
          <ChevronDown className="h-4 w-4" aria-hidden />
        ) : (
          <ChevronRight className="h-4 w-4" aria-hidden />
        )}
        {title}
      </CollapsibleTrigger>
      {!open && (
        <p className="pl-[1.375rem] text-xs text-muted-foreground">{summary}</p>
      )}
      <CollapsibleContent className="mt-2 rounded-lg border bg-muted/40">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}

export function ExportSettingsPanel({
  settings,
  onChange,
  onReset,
  isDefault,
}: ExportSettingsPanelProps) {
  const setNumber = (field: ResumeNumericSetting) => (value: number) =>
    onChange({ ...settings, [field]: value });

  const typographySummary = [
    PDF_FONT_LABELS[settings.font],
    formatSettingValue("fontSize", settings.fontSize),
    `${formatSettingValue("lineHeight", settings.lineHeight)} line`,
  ].join(" • ");

  const layoutSummary = [
    `${settings.marginVertical} × ${settings.marginHorizontal} pt margins`,
    `${settings.sectionSpacing}/${settings.entrySpacing} pt spacing`,
  ].join(" • ");

  return (
    <div className="flex flex-col gap-4">
      {/* Template reshapes everything below it, so it never folds away. */}
      <div className="rounded-lg border bg-muted/40">
        <SelectRow
          id="resume-export-template"
          label="Template"
          value={settings.template}
          labels={RESUME_LAYOUT_LABELS}
          onSelect={(template) => onChange({ ...settings, template })}
        />
      </div>

      <DisclosureGroup title="Typography" summary={typographySummary}>
        <SelectRow
          id="resume-export-font"
          label="Font"
          value={settings.font}
          labels={PDF_FONT_LABELS}
          onSelect={(font) => onChange({ ...settings, font })}
        />
        <StepperRow
          field="fontSize"
          value={settings.fontSize}
          onCommit={setNumber("fontSize")}
        />
        <StepperRow
          field="lineHeight"
          value={settings.lineHeight}
          onCommit={setNumber("lineHeight")}
        />
      </DisclosureGroup>

      <DisclosureGroup title="Layout" summary={layoutSummary}>
        <StepperRow
          field="marginVertical"
          value={settings.marginVertical}
          onCommit={setNumber("marginVertical")}
        />
        <StepperRow
          field="marginHorizontal"
          value={settings.marginHorizontal}
          onCommit={setNumber("marginHorizontal")}
        />
        <StepperRow
          field="sectionSpacing"
          value={settings.sectionSpacing}
          onCommit={setNumber("sectionSpacing")}
        />
        <StepperRow
          field="entrySpacing"
          value={settings.entrySpacing}
          onCommit={setNumber("entrySpacing")}
        />
      </DisclosureGroup>

      {onReset && (
        <div className="flex justify-end">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onReset}
            disabled={isDefault}
          >
            Reset to defaults
          </Button>
        </div>
      )}
    </div>
  );
}
