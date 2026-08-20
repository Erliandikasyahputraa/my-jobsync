"use client";

import { useEffect, useRef, useState } from "react";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

const PREVIEW_RESIZE_DEBOUNCE_MS = 250;
const MAX_CANVAS_SCALE = 2;
const EMPTY_MESSAGE =
  "Add your contact info and at least one section to preview.";

type PdfPreviewPaneProps = {
  blob: Blob | null;
  isGenerating: boolean;
  hasError: boolean;
  canExport: boolean;
  className?: string;
};

// pdf.js rejects a cancelled render; that is normal here, not a failure.
function isRenderCancelled(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { name?: string }).name === "RenderingCancelledException"
  );
}

function pageLabel(count: number): string {
  return `${count} ${count === 1 ? "page" : "pages"}`;
}

export function PdfPreviewPane({
  blob,
  isGenerating,
  hasError,
  canExport,
  className,
}: PdfPreviewPaneProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const pagesRef = useRef<HTMLDivElement>(null);
  const widthRef = useRef(0);
  const [width, setWidth] = useState(0);
  const [pageCount, setPageCount] = useState(0);
  const [renderFailed, setRenderFailed] = useState(false);

  useEffect(() => {
    const element = measureRef.current;
    if (!element) return;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const observer = new ResizeObserver((entries) => {
      const next = Math.floor(entries[0].contentRect.width);
      if (next <= 0 || next === widthRef.current) return;
      // First measurement lands at once; later changes share the 250ms debounce.
      if (widthRef.current === 0) {
        widthRef.current = next;
        setWidth(next);
        return;
      }
      clearTimeout(timer);
      timer = setTimeout(() => {
        widthRef.current = next;
        setWidth(next);
      }, PREVIEW_RESIZE_DEBOUNCE_MS);
    });

    observer.observe(element);
    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!blob || width <= 0) return;

    let cancelled = false;
    let renderTask: { cancel: () => void } | null = null;
    let document_: { destroy: () => Promise<void> } | null = null;

    // A stale failure must not suppress this attempt's spinner.
    setRenderFailed(false);

    const draw = async () => {
      try {
        const { getDocumentProxy } = await import("unpdf");
        // A fresh copy each load: pdf.js neuters the array it is handed.
        const bytes = new Uint8Array(await blob.arrayBuffer());
        if (cancelled) return;

        const pdf = await getDocumentProxy(bytes);
        if (cancelled) {
          void pdf.destroy().catch(() => {});
          return;
        }
        document_ = pdf;

        const dpr = Math.min(window.devicePixelRatio || 1, MAX_CANVAS_SCALE);
        const canvases: HTMLCanvasElement[] = [];

        for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
          const page = await pdf.getPage(pageNumber);
          if (cancelled) return;

          const unscaled = page.getViewport({ scale: 1 });
          const viewport = page.getViewport({
            scale: (width / unscaled.width) * dpr,
          });

          // Detached canvases: the mounted set is swapped only once the whole
          // document is drawn, so the pane never blanks mid-render.
          const canvas = document.createElement("canvas");
          canvas.width = Math.floor(viewport.width);
          canvas.height = Math.floor(viewport.height);
          canvas.className = "block h-auto w-full bg-white shadow-sm";

          const task = page.render({ canvas, viewport });
          renderTask = task;
          await task.promise;
          renderTask = null;
          if (cancelled) return;

          canvases.push(canvas);
        }

        const host = pagesRef.current;
        if (!host || cancelled) return;
        host.replaceChildren(...canvases);
        setPageCount(canvases.length);
        setRenderFailed(false);
        // Page breaks move between settings, so a kept offset lands nowhere.
        scrollRef.current?.scrollTo({ top: 0 });
      } catch (error) {
        if (cancelled || isRenderCancelled(error)) return;
        setRenderFailed(true);
      }
    };

    void draw();

    return () => {
      cancelled = true;
      renderTask?.cancel();
      // destroy() rejects any page work still in flight; that is the point of
      // the call, so the rejection is swallowed rather than left floating.
      void document_?.destroy().catch(() => {});
    };
  }, [blob, width]);

  const hasPages = pageCount > 0;
  const showEmpty = !canExport;
  const showError = canExport && (hasError || renderFailed);
  const showFirstSpinner = canExport && !showError && !hasPages;
  const showOverlaySpinner = canExport && !showError && hasPages && isGenerating;

  const status = showEmpty
    ? EMPTY_MESSAGE
    : showError
      ? "Preview unavailable"
      : isGenerating
        ? "Generating preview…"
        : hasPages
          ? `Preview ready, ${pageLabel(pageCount)}`
          : "";

  return (
    <div className={cn("flex min-h-0 flex-col gap-2", className)}>
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-medium">Preview</span>
        <span className="text-xs text-muted-foreground">
          {hasPages ? pageLabel(pageCount) : ""}
        </span>
      </div>

      <div
        ref={scrollRef}
        aria-label={
          hasPages ? `Resume preview, ${pageLabel(pageCount)}` : "Resume preview"
        }
        className="relative min-h-0 flex-1 overflow-y-auto rounded-md border bg-muted p-4"
      >
        <div ref={measureRef} className="mx-auto w-full max-w-3xl">
          <div
            ref={pagesRef}
            aria-hidden="true"
            className={cn(
              "flex flex-col gap-4 transition-opacity",
              showOverlaySpinner && "opacity-50",
            )}
          />
        </div>

        {(showEmpty || showError || showFirstSpinner) && (
          <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-muted-foreground">
            {showEmpty ? (
              EMPTY_MESSAGE
            ) : showError ? (
              "Preview unavailable"
            ) : (
              <Spinner className="size-6" />
            )}
          </div>
        )}

        {showOverlaySpinner && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <Spinner className="size-6" />
          </div>
        )}
      </div>

      <span className="sr-only" role="status" aria-live="polite">
        {status}
      </span>
    </div>
  );
}
