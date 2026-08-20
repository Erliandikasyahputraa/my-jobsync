import type {
  ResumeExportSettings,
  ResumeFont,
} from "@/models/resumeExport.model";

export type FontQuartet = {
  regular: string;
  bold: string;
  italic: string;
  boldItalic: string;
};

// The three standard-14 families @react-pdf/font ships; anything else
// would need font files shipped or fetched.
export const FONT_QUARTETS: Record<ResumeFont, FontQuartet> = {
  helvetica: {
    regular: "Helvetica",
    bold: "Helvetica-Bold",
    italic: "Helvetica-Oblique",
    boldItalic: "Helvetica-BoldOblique",
  },
  times: {
    regular: "Times-Roman",
    bold: "Times-Bold",
    italic: "Times-Italic",
    boldItalic: "Times-BoldItalic",
  },
  courier: {
    regular: "Courier",
    bold: "Courier-Bold",
    italic: "Courier-Oblique",
    boldItalic: "Courier-BoldOblique",
  },
};

// Every derived size in both sheets is proportional to this.
export const BASE_FONT_SIZE = 11;

// Certificate blocks sit at three quarters of an entry gap in both
// templates (6 against 8), so the ratio is identity at the default.
const CERT_SPACING_RATIO = 0.75;

export type StyleTokens = {
  font: FontQuartet;
  /** The base size itself. Assigned, never passed through `pt`. */
  fontSize: number;
  /** Sizes derived from the base, and the two font-metric widths. */
  pt: (literal: number) => number;
  lineHeight: number;
  marginVertical: number;
  marginHorizontal: number;
  sectionSpacing: number;
  entrySpacing: number;
  certSpacing: number;
};

export function styleTokens(settings: ResumeExportSettings): StyleTokens {
  const scale = settings.fontSize / BASE_FONT_SIZE;

  return {
    font: FONT_QUARTETS[settings.font],
    fontSize: settings.fontSize,
    // A scale of exactly 1 returns the literal untouched rather than
    // rounding it, so the defaults reproduce the Simple sheet exactly.
    pt: (literal) =>
      scale === 1 ? literal : Math.round(literal * scale * 10) / 10,
    lineHeight: settings.lineHeight,
    marginVertical: settings.marginVertical,
    marginHorizontal: settings.marginHorizontal,
    sectionSpacing: settings.sectionSpacing,
    entrySpacing: settings.entrySpacing,
    certSpacing: Math.round(settings.entrySpacing * CERT_SPACING_RATIO),
  };
}
