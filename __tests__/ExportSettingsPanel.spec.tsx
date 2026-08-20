import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ExportSettingsPanel } from "@/components/profile/export-pdf-dialog/ExportSettingsPanel";
import type { ResumeExportSettings } from "@/models/resumeExport.model";

const simple: ResumeExportSettings = { template: "simple" };

describe("ExportSettingsPanel", () => {
  it("renders a Template section with both layout options", () => {
    render(<ExportSettingsPanel settings={simple} onChange={vi.fn()} />);

    expect(screen.getByText("Template")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Simple" })).toBeInTheDocument();
    expect(
      screen.getByRole("radio", { name: "Professional" }),
    ).toBeInTheDocument();
  });

  it("marks the current template as checked", () => {
    render(<ExportSettingsPanel settings={simple} onChange={vi.fn()} />);

    expect(screen.getByRole("radio", { name: "Simple" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Professional" })).not.toBeChecked();
  });

  it("emits a whole settings object, not a bare layout", async () => {
    const onChange = vi.fn();
    render(<ExportSettingsPanel settings={simple} onChange={onChange} />);

    await userEvent.click(screen.getByRole("radio", { name: "Professional" }));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith({ template: "professional" });
  });
});
