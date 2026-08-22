import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import JobsActivityCard from "@/components/dashboard/JobsActivityCard";

vi.mock("next-themes", () => ({
  useTheme: () => ({ resolvedTheme: "light" }),
}));

vi.mock("@nivo/pie", () => ({
  ResponsivePie: (props: any) => (
    <div data-testid="donut">
      {props.data.map((slice: any) => (
        <div key={slice.id} data-testid={`slice-${slice.id}`}>
          {slice.label}:{slice.value}:{slice.color}
        </div>
      ))}
    </div>
  ),
}));

describe("JobsActivityCard", () => {
  const user = userEvent.setup();

  const data = [
    {
      label: "7d",
      summary: {
        jobsApplied: 16,
        topActivities: [
          { label: "Jobsync", hours: 28.1 },
          { label: "Side Project 1", hours: 9.2 },
          { label: "Learning", hours: 8.6 },
        ],
        otherHours: 17.5,
        totalHours: 63.4,
      },
    },
    {
      label: "30d",
      summary: {
        jobsApplied: 34,
        topActivities: [{ label: "Job Search", hours: 6.4 }],
        otherHours: 0,
        totalHours: 6.4,
      },
    },
  ];

  it("shows the period's total hours and job count in the donut center", () => {
    render(<JobsActivityCard data={data} />);

    const total = screen.getByTestId("jobs-activity-total");

    expect(within(total).getByText("63.4h")).toBeInTheDocument();
    expect(within(total).getByText("16 jobs")).toBeInTheDocument();
  });

  it("lists every slice with its hours in the legend", () => {
    render(<JobsActivityCard data={data} />);

    const legend = screen.getByTestId("jobs-activity-legend");

    expect(within(legend).getByText("Jobsync")).toBeInTheDocument();
    expect(within(legend).getByText("28.1h")).toBeInTheDocument();
    expect(within(legend).getByText("Other")).toBeInTheDocument();
    expect(within(legend).getByText("17.5h")).toBeInTheDocument();
  });

  it("feeds the same slices to the donut", () => {
    render(<JobsActivityCard data={data} />);

    expect(screen.getByTestId("slice-Jobsync")).toHaveTextContent(
      "Jobsync:28.1:#2a9d90",
    );
    expect(screen.getByTestId("slice-__other__")).toHaveTextContent(
      "Other:17.5:#94a3b8",
    );
  });

  it("switches every number when the period changes", async () => {
    render(<JobsActivityCard data={data} />);

    const toggle = screen.getByTestId("jobs-activity-toggle-group");
    await user.click(within(toggle).getByRole("button", { name: "30d" }));

    const total = screen.getByTestId("jobs-activity-total");

    expect(within(total).getByText("6.4h")).toBeInTheDocument();
    expect(within(total).getByText("34 jobs")).toBeInTheDocument();
    expect(screen.queryByText("Jobsync")).not.toBeInTheDocument();
    expect(screen.queryByText("Other")).not.toBeInTheDocument();
  });

  it("says one job, not one jobs", () => {
    render(
      <JobsActivityCard
        data={[
          {
            label: "7d",
            summary: {
              jobsApplied: 1,
              topActivities: [{ label: "Job Search", hours: 2 }],
              otherHours: 0,
              totalHours: 2,
            },
          },
        ]}
      />,
    );

    expect(screen.getByText("1 job")).toBeInTheDocument();
  });

  it("keeps the job count visible when no activity is logged", () => {
    render(
      <JobsActivityCard
        data={[
          {
            label: "7d",
            summary: {
              jobsApplied: 3,
              topActivities: [],
              otherHours: 0,
              totalHours: 0,
            },
          },
        ]}
      />,
    );

    expect(screen.getByText("0h")).toBeInTheDocument();
    expect(screen.getByText("3 jobs")).toBeInTheDocument();
    expect(screen.getByText("No activities recorded")).toBeInTheDocument();
    expect(screen.queryByTestId("donut")).not.toBeInTheDocument();
  });
});
