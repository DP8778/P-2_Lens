import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { MetricCard } from "./MetricCard";
const meta = {
  title: "Dashboard/MetricCard",
  component: MetricCard,
  args: { label: "Výnos v období", value: "+6,5 %", detail: "1M", trend: "positive" },
} satisfies Meta<typeof MetricCard>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Positive: Story = {};
export const Negative: Story = { args: { value: "−4,2 %", trend: "negative" } };
export const Featured: Story = {
  args: { label: "Hodnota portfolia", value: "$132 128", featured: true, trend: "neutral" },
};
