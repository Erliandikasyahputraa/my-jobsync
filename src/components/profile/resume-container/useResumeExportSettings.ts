"use client";
import { useEffect, useState } from "react";
import { APP_CONSTANTS } from "@/lib/constants";
import {
  clampNumericField,
  PDF_FONT_LABELS,
  type PdfFont,
} from "@/models/pdfExport.model";
import {
  defaultResumeExportSettings,
  RESUME_LAYOUT_LABELS,
  RESUME_NUMERIC_FIELDS,
  RESUME_TEMPLATE_DEFAULTS,
  type ResumeExportSettings,
  type ResumeLayout,
} from "@/models/resumeExport.model";
import {
  getFromLocalStorage,
  saveToLocalStorage,
} from "@/utils/localstorage.utils";

const KEY = APP_CONSTANTS.RESUME_EXPORT_SETTINGS_STORAGE_KEY;

// Rebuilt from a spread of the defaults, so the key order always comes from
// that one literal — the preview cache key is JSON.stringify(settings).
export function coerceResumeExportSettings(
  stored: unknown,
): ResumeExportSettings {
  if (!stored || typeof stored !== "object" || Array.isArray(stored)) {
    return { ...defaultResumeExportSettings };
  }
  const raw = stored as Record<string, unknown>;

  // The template is read first: every other field falls back to that
  // template's own default rather than to Simple's.
  const template =
    typeof raw.template === "string" && raw.template in RESUME_LAYOUT_LABELS
      ? (raw.template as ResumeLayout)
      : defaultResumeExportSettings.template;
  const next = { ...RESUME_TEMPLATE_DEFAULTS[template] };

  if (typeof raw.font === "string" && raw.font in PDF_FONT_LABELS) {
    next.font = raw.font as PdfFont;
  }

  // Iterates the resume's own field list, never the merged spec table.
  // clampNumericField returns the passed fallback for anything that is not
  // a finite number, so a missing key needs no guard.
  for (const field of RESUME_NUMERIC_FIELDS) {
    next[field] = clampNumericField(
      field,
      raw[field],
      RESUME_TEMPLATE_DEFAULTS[template][field],
    );
  }

  return next;
}

function readStored(): ResumeExportSettings {
  try {
    return coerceResumeExportSettings(getFromLocalStorage(KEY, null));
  } catch {
    // getFromLocalStorage calls JSON.parse unguarded.
    return { ...defaultResumeExportSettings };
  }
}

// Reads on open rather than at mount: localStorage is unavailable during SSR,
// and `ready` holds the preview back one commit so it generates once, with
// the stored settings, instead of once with the defaults and again after.
export function useResumeExportSettings(open: boolean) {
  const [settings, setSettings] = useState<ResumeExportSettings>(
    defaultResumeExportSettings,
  );
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!open) {
      setReady(false);
      return;
    }
    setSettings(readStored());
    setReady(true);
  }, [open]);

  // Picking a template re-seeds the rest: each template's defaults are its
  // own shipped literals, so carrying the previous one's numbers across
  // would silently restyle the template the user just chose.
  const update = (next: ResumeExportSettings) => {
    const applied =
      next.template === settings.template
        ? next
        : { ...RESUME_TEMPLATE_DEFAULTS[next.template] };
    setSettings(applied);
    saveToLocalStorage(KEY, applied);
  };

  return {
    settings,
    setSettings: update,
    ready,
    reset: () => update({ ...RESUME_TEMPLATE_DEFAULTS[settings.template] }),
  };
}
