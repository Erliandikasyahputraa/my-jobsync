import { describe, it, expect } from "vitest";
import {
  clampNumericField,
  defaultResumeExportSettings,
  formatSettingValue,
  RESUME_FONT_LABELS,
  RESUME_NUMERIC_SETTINGS,
  type ResumeNumericSetting,
} from "@/models/resumeExport.model";

describe("defaultResumeExportSettings", () => {
  // Copied from simpleStyles, so buildSimpleStyles at the defaults is
  // identity. Professional's four deltas are documented in the plan.
  it("is Simple's own literals", () => {
    expect(defaultResumeExportSettings).toEqual({
      template: "simple",
      font: "helvetica",
      fontSize: 11,
      lineHeight: 1.4,
      marginVertical: 40,
      marginHorizontal: 48,
      sectionSpacing: 6,
      entrySpacing: 8,
    });
  });

  it("orders its keys template-first so the cache key is stable", () => {
    expect(Object.keys(defaultResumeExportSettings)).toEqual([
      "template",
      "font",
      "fontSize",
      "lineHeight",
      "marginVertical",
      "marginHorizontal",
      "sectionSpacing",
      "entrySpacing",
    ]);
  });

  it("puts every default inside its own field's range", () => {
    for (const [field, spec] of Object.entries(RESUME_NUMERIC_SETTINGS)) {
      const value = defaultResumeExportSettings[field as ResumeNumericSetting];
      expect(value).toBeGreaterThanOrEqual(spec.min);
      expect(value).toBeLessThanOrEqual(spec.max);
    }
  });
});

describe("RESUME_FONT_LABELS", () => {
  it("labels the three standard-14 families", () => {
    expect(RESUME_FONT_LABELS).toEqual({
      helvetica: "Helvetica",
      times: "Times",
      courier: "Courier",
    });
  });
});

describe("RESUME_NUMERIC_SETTINGS", () => {
  it("describes all six numeric settings", () => {
    expect(Object.keys(RESUME_NUMERIC_SETTINGS)).toEqual([
      "fontSize",
      "lineHeight",
      "marginVertical",
      "marginHorizontal",
      "sectionSpacing",
      "entrySpacing",
    ]);
  });

  it("gives font size half-point steps in points", () => {
    expect(RESUME_NUMERIC_SETTINGS.fontSize).toEqual({
      label: "Font size",
      min: 8,
      max: 16,
      step: 0.5,
      decimals: 1,
      unit: "pt",
    });
  });

  it("gives line height a unitless two-decimal scale", () => {
    expect(RESUME_NUMERIC_SETTINGS.lineHeight.unit).toBe("");
    expect(RESUME_NUMERIC_SETTINGS.lineHeight.step).toBe(0.05);
    expect(RESUME_NUMERIC_SETTINGS.lineHeight.decimals).toBe(2);
  });

  it("gives every field a step it can reach from its own default", () => {
    for (const [field, spec] of Object.entries(RESUME_NUMERIC_SETTINGS)) {
      expect(spec.step).toBeGreaterThan(0);
      expect(spec.min).toBeLessThan(spec.max);
      expect(spec.label.length).toBeGreaterThan(0);
      expect(defaultResumeExportSettings[field as ResumeNumericSetting]).toBeTypeOf(
        "number",
      );
    }
  });
});

describe("clampNumericField", () => {
  it("returns a value already in range unchanged", () => {
    expect(clampNumericField("fontSize", 12.5)).toBe(12.5);
    expect(clampNumericField("marginVertical", 40)).toBe(40);
  });

  it("clamps to the field's own bounds", () => {
    expect(clampNumericField("fontSize", 400)).toBe(16);
    expect(clampNumericField("fontSize", -3)).toBe(8);
    expect(clampNumericField("marginHorizontal", 1000)).toBe(90);
    expect(clampNumericField("sectionSpacing", -1)).toBe(0);
  });

  // 1.4 + 0.05 is 1.4500000000000002, which would poison both the style
  // sheet and the JSON.stringify preview cache key.
  it("rounds away IEEE-754 drift at the field's precision", () => {
    expect(clampNumericField("lineHeight", 1.4 + 0.05)).toBe(1.45);
    expect(clampNumericField("fontSize", 11 + 0.5)).toBe(11.5);
    expect(clampNumericField("marginVertical", 40.4)).toBe(40);
  });

  it("does not snap a typed value onto the step grid", () => {
    expect(clampNumericField("fontSize", 11.3)).toBe(11.3);
    expect(clampNumericField("marginVertical", 41)).toBe(41);
  });

  it("falls back to the field's default for anything that is not a number", () => {
    for (const value of [null, undefined, "40", NaN, Infinity, {}, []]) {
      expect(clampNumericField("marginVertical", value)).toBe(40);
    }
  });
});

describe("formatSettingValue", () => {
  it("renders a bare number, with a unit where the field has one", () => {
    expect(formatSettingValue("fontSize", 11)).toBe("11 pt");
    expect(formatSettingValue("fontSize", 11.5)).toBe("11.5 pt");
    expect(formatSettingValue("lineHeight", 1.4)).toBe("1.4");
    expect(formatSettingValue("lineHeight", 1.45)).toBe("1.45");
    expect(formatSettingValue("marginHorizontal", 48)).toBe("48 pt");
    expect(formatSettingValue("entrySpacing", 8)).toBe("8 pt");
  });
});
