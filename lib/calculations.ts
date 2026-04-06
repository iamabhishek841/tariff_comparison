import { AnalysisProfile, FlexibilityRow, MarketSignal, PlanResult } from "@/lib/types"
import { normalizeSeries } from "@/lib/marketSignals"

export function buildFlexibilityRows(profile: AnalysisProfile, marketSignals: MarketSignal[]): FlexibilityRow[] {
  const spreadScores = normalizeSeries(marketSignals.map((row) => row.spread))
  const volatilityScores = normalizeSeries(marketSignals.map((row) => row.volatility))
  const loadScores = normalizeSeries(
    marketSignals.map((row) => profile.hourlyShares[String(row.hour).padStart(2, "0")] ?? 0),
  )

  return marketSignals.map((row, index) => {
    const flexibilityIndex = (0.4 * spreadScores[index]) + (0.3 * volatilityScores[index]) + (0.3 * loadScores[index])
    const flexibilityLevel: "High" | "Medium" | "Low" = flexibilityIndex >= 0.7
      ? "High"
      : flexibilityIndex >= 0.4
        ? "Medium"
        : "Low"

    return {
      hour: row.hour,
      spreadScore: spreadScores[index],
      volatilityScore: volatilityScores[index],
      loadScore: loadScores[index],
      flexibilityIndex,
      flexibilityLevel,
    }
  })
}

export function buildRecommendation(profile: AnalysisProfile, bestPlan: PlanResult, topFlex?: FlexibilityRow): string {
  if (!topFlex) {
    return "No flexibility signal was available for a recommendation."
  }

  const bandSummary = [
    `day ${(profile.bands.day * 100).toFixed(1)}%`,
    `night ${(profile.bands.night * 100).toFixed(1)}%`,
    `peak ${(profile.bands.peak * 100).toFixed(1)}%`,
  ].join(" | ")

  return `Choose ${bestPlan.providerName} - ${bestPlan.tariffName}. Profile mix: ${bandSummary}. Highest flexibility is around ${String(topFlex.hour).padStart(2, "0")}:00 (${topFlex.flexibilityLevel.toLowerCase()}). Shift discretionary demand (laundry, EV, dishwashing) toward that window when possible.`
}

