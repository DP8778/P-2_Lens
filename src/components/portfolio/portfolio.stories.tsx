import type { Meta } from "@storybook/nextjs-vite";
import { enrichedPositions } from "@/data/mock/assets";
import { AssetRow } from "./AssetRow";
import { DataQualityBadge } from "./DataQualityBadge";
const meta = { title: "Portfolio/Components" } satisfies Meta;
export default meta;
export const Row = () => (
  <table className="card w-full">
    <tbody>
      <AssetRow
        asset={enrichedPositions[0].asset}
        position={enrichedPositions[0]}
        locale="cs-CZ"
        contribution={2.1}
      />
    </tbody>
  </table>
);
export const DataQuality = () => (
  <div className="flex gap-3">
    <DataQualityBadge />
    <DataQualityBadge low />
  </div>
);
