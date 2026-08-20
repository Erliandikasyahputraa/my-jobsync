import type { Style } from "@react-pdf/types";

export type {
  ResumeExportSettings,
  ResumeLayout,
} from "@/models/resumeExport.model";
export {
  RESUME_LAYOUT_LABELS,
  defaultResumeExportSettings,
} from "@/models/resumeExport.model";

export type HtmlStyleSet = {
  bodyText: Style;
  bold: Style;
  italic: Style;
  boldItalic: Style;
  h2text: Style;
  listRow: Style;
  bullet: Style;
  listText: Style;
  bulletChar: string;
};
