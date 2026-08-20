"use client";

import { useEffect, useState } from "react";
import { FileDown, Loader } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Button } from "../ui/button";
import type { Resume } from "@/models/profile.model";
import {
  defaultResumeExportSettings,
  type ResumeExportSettings,
} from "@/models/resumeExport.model";
import { ExportSettingsPanel } from "./export-pdf-dialog/ExportSettingsPanel";
import { PdfPreviewPane } from "./export-pdf-dialog/PdfPreviewPane";
import { canExportResume } from "./resume-container/useResumePdfExport";
import { useResumePdfPreview } from "./resume-container/useResumePdfPreview";

type ExportPdfDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  resume: Resume;
  isExporting: boolean;
  onExport: (
    settings: ResumeExportSettings,
    prepared?: { blob: Blob; filename: string } | null,
  ) => void;
};

export function ExportPdfDialog({
  open,
  onOpenChange,
  resume,
  isExporting,
  onExport,
}: ExportPdfDialogProps) {
  const [settings, setSettings] = useState<ResumeExportSettings>(
    defaultResumeExportSettings,
  );

  // Settings are not persisted: reset on close, so the next open already
  // holds the defaults on its very first render.
  useEffect(() => {
    if (!open) setSettings(defaultResumeExportSettings);
  }, [open]);

  const canExport = canExportResume(resume);
  const { blob, filename, isGenerating, error } = useResumePdfPreview(
    resume,
    settings,
    open,
  );

  // Exporting mid-generation would download the template just switched away
  // from, since Export reuses the previewed blob.
  const exportDisabled = isExporting || !canExport || isGenerating;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* A fixed height, not a max: the pane fits pages to its own height, so
          a content-driven one would feed back on itself. */}
      <DialogContent className="flex h-[90vh] flex-col sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>Export to PDF</DialogTitle>
          <DialogDescription>
            Adjust the settings and preview the file before exporting.
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-4 md:flex-row">
          <div className="order-2 h-[45vh] min-h-0 md:order-1 md:h-auto md:min-w-0 md:flex-1">
            <PdfPreviewPane
              blob={blob}
              isGenerating={isGenerating}
              hasError={!!error}
              canExport={canExport}
              className="h-full"
            />
          </div>
          <div className="order-1 min-h-0 shrink-0 overflow-y-auto md:order-2 md:w-[34%]">
            <ExportSettingsPanel settings={settings} onChange={setSettings} />
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isExporting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={exportDisabled}
            onClick={() => {
              // The blob on screen is the artifact; a null one makes the hook
              // fall back to generating, which covers a failed preview.
              const prepared = blob && filename ? { blob, filename } : null;
              onOpenChange(false);
              onExport(settings, prepared);
            }}
          >
            {isExporting ? (
              <>
                <Loader className="h-4 w-4 animate-spin" />
                Generating…
              </>
            ) : (
              <>
                <FileDown className="h-4 w-4" />
                Export
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
