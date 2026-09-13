export type AnalyticsEvent =
  | { name: "auth_login_submitted" | "auth_login_succeeded" }
  | { name: "dashboard_timeframe_changed" | "chart_timeframe_changed"; timeframe: string }
  | { name: "dashboard_benchmark_changed"; benchmark: string }
  | { name: "portfolio_asset_opened"; symbol: string }
  | { name: "portfolio_filter_changed"; filter: string }
  | { name: "portfolio_sort_changed"; column: string }
  | { name: "chart_series_toggled"; series: string; visible: boolean }
  | {
      name:
        | "ai_insight_requested"
        | "ai_insight_succeeded"
        | "ai_insight_failed"
        | "ai_insight_rate_limited"
        | "ai_insight_fallback_shown";
    }
  | { name: "ai_insight_feedback_positive" | "ai_insight_feedback_negative" }
  | { name: "ai_insight_evidence_opened"; reference: string }
  | { name: "privacy_disclosure_opened" | "data_quality_opened" }
  | { name: "settings_locale_changed"; locale: string }
  | { name: "settings_currency_changed"; currency: string };

export function track(event: AnalyticsEvent) {
  if (process.env.NODE_ENV === "development") console.info("[analytics]", event.name, event);
}
