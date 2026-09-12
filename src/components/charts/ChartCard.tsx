import type { ReactNode } from "react";
import { Card, CardHeader } from "@/components/ui/Card";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { Skeleton } from "@/components/ui/Skeleton";

export function ChartCard({
  title,
  eyebrow,
  action,
  children,
  state = "data",
  summary,
}: {
  title: string;
  eyebrow?: string;
  action?: ReactNode;
  children?: ReactNode;
  state?: "loading" | "data" | "empty" | "error";
  summary?: string;
}) {
  return (
    <Card className="overflow-hidden">
      <CardHeader eyebrow={eyebrow} title={title} action={action} />
      {summary && <p className="sr-only">{summary}</p>}
      {state === "loading" && (
        <div className="p-5">
          <Skeleton className="h-64 w-full" />
        </div>
      )}
      {state === "empty" && <EmptyState />}
      {state === "error" && <ErrorState />}
      {state === "data" && children}
    </Card>
  );
}
