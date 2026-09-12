import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Button } from "./Button";
import { Tabs } from "./Tabs";
import { EmptyState, ErrorState } from "./States";
import { Skeleton } from "./Skeleton";

const meta = { title: "Foundations/Primitives", component: Button } satisfies Meta<typeof Button>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Primary: Story = { args: { children: "Vysvětlit období", variant: "primary" } };
export const Secondary: Story = { args: { children: "Zkusit znovu", variant: "secondary" } };
export const TabsComponent = () => (
  <Tabs items={["1D", "1W", "1M"]} value="1M" onChange={() => {}} label="Období" />
);
export const EmptyStateComponent = () => (
  <div className="card">
    <EmptyState />
  </div>
);
export const ErrorStateComponent = () => (
  <div className="card">
    <ErrorState />
  </div>
);
export const SkeletonComponent = () => <Skeleton className="h-20 w-80" />;
export const AllStates = () => (
  <div className="grid gap-8">
    <div className="flex gap-3">
      <Button>Primary</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="ghost">Ghost</Button>
    </div>
    <Tabs items={["1D", "1W", "1M"]} value="1M" onChange={() => {}} label="Období" />
    <div className="grid grid-cols-2 gap-4">
      <div className="card">
        <EmptyState />
      </div>
      <div className="card">
        <ErrorState />
      </div>
    </div>
  </div>
);
