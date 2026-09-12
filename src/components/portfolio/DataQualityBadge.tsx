import { Database } from "lucide-react";
import { Badge } from "@/components/ui/Badge";

export function DataQualityBadge({ low = false }: { low?: boolean }) {
  return (
    <Badge tone={low ? "warning" : "neutral"}>
      <Database size={12} aria-hidden />
      {low ? "Omezená data" : "Mock · stabilní"}
    </Badge>
  );
}
