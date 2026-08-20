import React from "react";
import { Resume, SectionType } from "@/models/profile.model";
import { htmlToPdfNodes } from "./html-to-pdf";
import {
  RESUME_LAYOUT_LABELS,
  defaultResumeExportSettings,
  type ResumeExportSettings,
} from "./types";
import type { HtmlStyleSet } from "./types";
import { buildSimpleStyles } from "./styles/simple.styles";
import { buildProfessionalStyles } from "./styles/professional.styles";

export type ResumeHtmlNodes = {
  summary: React.ReactElement[];
  experiences: React.ReactElement[][];
  educations: React.ReactElement[][];
};

export function sanitizeFilename(name: string): string {
  const sanitized = name
    .replace(/[\x00-\x1f\x7f]/g, "")
    .replace(/[/\\:*?"<>|]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 200);
  return sanitized || "resume";
}

// Parse HTML on the main thread before entering react-pdf's rendering context
function buildHtmlNodes(
  resume: Resume,
  htmlStyles: HtmlStyleSet,
): ResumeHtmlNodes {
  const summarySection = resume.ResumeSections?.find(
    (s) => s.sectionType === SectionType.SUMMARY,
  );
  const experienceSection = resume.ResumeSections?.find(
    (s) => s.sectionType === SectionType.EXPERIENCE,
  );
  const educationSection = resume.ResumeSections?.find(
    (s) => s.sectionType === SectionType.EDUCATION,
  );

  return {
    summary: summarySection?.summary?.content
      ? htmlToPdfNodes(summarySection.summary.content, htmlStyles)
      : [],
    experiences:
      experienceSection?.workExperiences?.map((exp) =>
        exp.description ? htmlToPdfNodes(exp.description, htmlStyles) : [],
      ) ?? [],
    educations:
      educationSection?.educations?.map((edu) =>
        edu.description ? htmlToPdfNodes(edu.description, htmlStyles) : [],
      ) ?? [],
  };
}

export async function generateResumePdfBlob(
  resume: Resume,
  settings: ResumeExportSettings = defaultResumeExportSettings,
): Promise<{ blob: Blob; filename: string }> {
  const layout = settings.template;

  const { pdf, Font } = await import("@react-pdf/renderer");
  Font.registerHyphenationCallback((word) => [word]);

  // Branch fully so each sheet narrows to its own template's prop type
  let document: React.ReactElement;
  if (layout === "professional") {
    const { styles, htmlStyles } = buildProfessionalStyles(settings);
    const htmlNodes = buildHtmlNodes(resume, htmlStyles);
    const { ProfessionalResumeDocument } = await import("./ProfessionalTemplate");
    document = (
      <ProfessionalResumeDocument
        resume={resume}
        htmlNodes={htmlNodes}
        styles={styles}
      />
    );
  } else {
    const { styles, htmlStyles } = buildSimpleStyles(settings);
    const htmlNodes = buildHtmlNodes(resume, htmlStyles);
    const { SimpleResumeDocument } = await import("./SimpleTemplate");
    document = (
      <SimpleResumeDocument
        resume={resume}
        htmlNodes={htmlNodes}
        styles={styles}
      />
    );
  }

  const blob = await pdf(document as any).toBlob();
  const filename = `${sanitizeFilename(resume.title)} - ${RESUME_LAYOUT_LABELS[layout]}.pdf`;
  return { blob, filename };
}

export async function downloadResumePdf(resume: Resume): Promise<void> {
  const { blob, filename } = await generateResumePdfBlob(resume);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
