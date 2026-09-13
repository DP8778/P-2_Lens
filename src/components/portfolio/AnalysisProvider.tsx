"use client";
import {
  createContext,
  useContext,
  useMemo,
  useReducer,
  type Dispatch,
  type ReactNode,
} from "react";
import {
  timeline,
  timeframeRange,
  type ChartDisplay,
  type ChartMode,
  type TimeRange,
} from "@/lib/finance/portfolio-engine";

export interface AnalysisState {
  timeframe: TimeRange | "CUSTOM";
  mode: ChartMode;
  display: ChartDisplay;
  benchmarkId: "spy" | "qqq";
  compareAssetId: string;
  selectedPoint: string | null;
  selectedRange: [string, string] | null;
  viewportRange: [string, string];
  showBenchmark: boolean;
  annotations: boolean;
  navigator: boolean;
}
export type AnalysisAction =
  | { type: "timeframe"; value: TimeRange }
  | { type: "range"; value: [string, string] }
  | { type: "clearRange" }
  | { type: "viewport"; value: [string, string] }
  | { type: "point"; value: string | null }
  | {
      type: "settings";
      value: Partial<
        Pick<
          AnalysisState,
          | "mode"
          | "display"
          | "benchmarkId"
          | "compareAssetId"
          | "showBenchmark"
          | "annotations"
          | "navigator"
        >
      >;
    };

const indices = timeframeRange("1M");
const initialState: AnalysisState = {
  timeframe: "1M",
  mode: "performance",
  display: "percent",
  benchmarkId: "spy",
  compareAssetId: "",
  selectedPoint: null,
  selectedRange: null,
  viewportRange: [timeline[indices[0]], timeline[indices[1]]],
  showBenchmark: true,
  annotations: false,
  navigator: true,
};
function reducer(state: AnalysisState, action: AnalysisAction): AnalysisState {
  if (action.type === "timeframe") {
    const range = timeframeRange(action.value);
    return {
      ...state,
      timeframe: action.value,
      selectedRange: null,
      viewportRange: [timeline[range[0]], timeline[range[1]]],
      selectedPoint: null,
    };
  }
  if (action.type === "range")
    return { ...state, selectedRange: action.value, selectedPoint: null };
  if (action.type === "clearRange") return { ...state, selectedRange: null, selectedPoint: null };
  if (action.type === "viewport") return { ...state, viewportRange: action.value };
  if (action.type === "point") return { ...state, selectedPoint: action.value };
  return { ...state, ...action.value, selectedPoint: null };
}
const Context = createContext<{ state: AnalysisState; dispatch: Dispatch<AnalysisAction> } | null>(
  null,
);
export function AnalysisProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const value = useMemo(() => ({ state, dispatch }), [state]);
  return <Context value={value}>{children}</Context>;
}
export function useAnalysisContext() {
  const context = useContext(Context);
  if (!context) throw new Error("AnalysisProvider missing");
  return context;
}
