import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { buildInsightInput } from "@/lib/ai/buildInsightInput";
import { buildFallbackInsight } from "@/lib/ai/fallbackSummarizer";
import { buildPortfolioMetrics } from "@/lib/finance/buildPortfolioMetrics";
import { InsightCard } from "./InsightCard";
import { InsightEvidence } from "./InsightEvidence";
const insight = buildFallbackInsight(buildInsightInput(buildPortfolioMetrics("1M"), "1M"));
const meta = { title: "AI/InsightCard", component: InsightCard } satisfies Meta<typeof InsightCard>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = { args: { state: "default" } };
export const Generating: Story = { args: { state: "generating" } };
export const Success: Story = { args: { state: "success", insight } };
export const RateLimited: Story = { args: { state: "rate_limited", insight } };
export const Error: Story = { args: { state: "error" } };
export const DemoFallback: Story = { args: { state: "demo", insight } };
export const LowDataQuality: Story = {
  args: {
    state: "demo",
    insight: {
      ...insight,
      dataQualityNote: "Dostupná je jen část historických dat; závěry jsou omezené.",
    },
  },
};
export const Evidence = () => <InsightEvidence {...insight.drivers[0]} />;
