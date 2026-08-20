"use client";
import { useEffect, useRef, useState } from "react";
import type { Resume } from "@/models/profile.model";
import type { ResumeExportSettings } from "@/models/resumeExport.model";
import { canExportResume } from "./useResumePdfExport";

const PREVIEW_DEBOUNCE_MS = 250;

type PreviewResult = { blob: Blob; filename: string };

// Owns the preview artifact: debounce, cache, and blob generation. Deliberately
// touches no canvas and creates no object URL — PdfPreviewPane owns rendering.
export function useResumePdfPreview(
  resume: Resume,
  settings: ResumeExportSettings,
  open: boolean,
) {
  const [result, setResult] = useState<PreviewResult | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const cacheRef = useRef(new Map<string, PreviewResult>());
  const hasRenderedRef = useRef(false);
  const runIdRef = useRef(0);

  // Read through refs so the effect can depend on primitives only.
  const resumeRef = useRef(resume);
  resumeRef.current = resume;
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  // Insertion-order sensitive. Fine while settings come from one literal;
  // revisit the day a setting arrives by spread or merge.
  const key = JSON.stringify(settings);
  const canExport = canExportResume(resume);

  useEffect(() => {
    if (!open) {
      // A resume edited between openings must never show a stale preview.
      cacheRef.current.clear();
      hasRenderedRef.current = false;
      runIdRef.current += 1;
      setResult(null);
      setIsGenerating(false);
      setError(null);
      return;
    }

    if (!canExport) {
      runIdRef.current += 1;
      setResult(null);
      setIsGenerating(false);
      setError(null);
      return;
    }

    const cached = cacheRef.current.get(key);
    if (cached) {
      runIdRef.current += 1;
      hasRenderedRef.current = true;
      setResult(cached);
      setIsGenerating(false);
      setError(null);
      return;
    }

    const runId = ++runIdRef.current;
    setIsGenerating(true);
    setError(null);

    const generate = async () => {
      try {
        const { generateResumePdfBlob } = await import("../resume-pdf");
        const generated = await generateResumePdfBlob(
          resumeRef.current,
          settingsRef.current,
        );
        if (runIdRef.current !== runId) return;
        cacheRef.current.set(key, generated);
        setResult(generated);
        setError(null);
      } catch (e) {
        if (runIdRef.current !== runId) return;
        setResult(null);
        setError(e instanceof Error ? e : new Error("Preview failed"));
      } finally {
        if (runIdRef.current === runId) setIsGenerating(false);
      }
    };

    // Opening the dialog must not wait out a debounce nobody triggered.
    if (!hasRenderedRef.current) {
      hasRenderedRef.current = true;
      void generate();
      return;
    }

    const timer = setTimeout(() => void generate(), PREVIEW_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [open, key, canExport]);

  return {
    blob: result?.blob ?? null,
    filename: result?.filename ?? null,
    isGenerating,
    error,
  };
}
