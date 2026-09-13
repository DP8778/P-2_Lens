import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { getPerformanceSeries } from "@/data/mock/portfolio";
import { PerformanceChart } from "./PerformanceChart";
import { ChartCard } from "./ChartCard";
const meta = {
  title: "Charts/ChartCard",
  component: ChartCard,
  args: { title: "Vývoj portfolia" },
} satisfies Meta<typeof ChartCard>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Data: Story = {
  args: {
    children: <PerformanceChart data={getPerformanceSeries("1M")} normalized showBenchmark />,
  },
};
export const Loading: Story = { args: { state: "loading" } };
export const Empty: Story = { args: { state: "empty" } };
export const Error: Story = { args: { state: "error" } };
