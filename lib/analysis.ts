import { FlexibilityRow, MarketSignal, PlanData, PlanResult, ProfileData, Region } from "./types"

function normalize(values: number[]): number[] {
  const min = Math.min(...values)
  const max = Math.max(...values)
  if (max === min) return values.map(() => 0.5)
  return values.map((v) => (v - min) / (max - min))
}

function annualizeStanding(amount: number, period: string): number {
  const p = period.trim().toLowerCase()
  const map: Record<string, number> = {
    yearly: 1,
    annual: 1,
    year: 1,
    monthly: 12,
    month: 12,
    quarterly: 4,
    quarter: 4,
    weekly: 52,
    week: 52,
    daily: 365,
    day: 365,
  }
  return amount * (map[p] ?? 1)
}

function applyVat(value: number, includesVat: boolean, vatRate: number) {
  return includesVat ? value : value * (1 + vatRate)
}

function findFallbackPlan(plans: PlanData[], plan: PlanData): PlanData | undefined {
  if (plan.reversionTariffName) {
    const exact = plans.find(
      (candidate) =>
        candidate.providerName === plan.providerName &&
        candidate.meterType === plan.meterType &&
        candidate.tariffName.toLowerCase() === plan.reversionTariffName.toLowerCase(),
    )
    if (exact) return exact
  }
  return plans.find(
    (candidate) =>
      candidate.providerName === plan.providerName &&
      candidate.meterType === plan.meterType &&
      !candidate.promotional,
  )
}

export function comparePlans(
  plans: PlanData[],
  profile: ProfileData,
  annualKwh: number,
  region: Region,
  meterFilter: string,
): PlanResult[] {
  const relevantPlans = meterFilter === "All meter types"
    ? plans
    : plans.filter((plan) => plan.meterType === meterFilter)

  const computed = relevantPlans.map((plan) => {
    const energyBase = Object.entries(profile.hourlyShares).reduce((sum, [hour, share]) => {
      return sum + annualKwh * share * plan.hourlyRates[hour]
    }, 0)

    const standingRaw = region === "urban" ? plan.standingUrban : plan.standingRural
    const standingAnnual = annualizeStanding(standingRaw, plan.standingPeriod)

    const year1Energy = applyVat(energyBase, plan.ratesIncludeVat, plan.vatRate)
    const year1Standing = applyVat(standingAnnual, plan.standingIncludesVat, plan.vatRate)
    let year1Total = year1Energy + year1Standing
    let year2Total = year1Total

    if (plan.promotional && plan.promoDurationMonths > 0 && plan.promoDurationMonths < 12) {
      const fallback = findFallbackPlan(relevantPlans, plan)
      if (fallback) {
        const promoFraction = plan.promoDurationMonths / 12
        const fallbackEnergyBase = Object.entries(profile.hourlyShares).reduce((sum, [hour, share]) => {
          return sum + annualKwh * share * fallback.hourlyRates[hour]
        }, 0)
        const fallbackStandingRaw = region === "urban" ? fallback.standingUrban : fallback.standingRural
        const fallbackStandingAnnual = annualizeStanding(fallbackStandingRaw, fallback.standingPeriod)
        const fallbackTotal = applyVat(fallbackEnergyBase, fallback.ratesIncludeVat, fallback.vatRate) +
          applyVat(fallbackStandingAnnual, fallback.standingIncludesVat, fallback.vatRate)
        year1Total = year1Total * promoFraction + fallbackTotal * (1 - promoFraction)
        year2Total = fallbackTotal
      }
    } else if (plan.promotional && plan.promoDurationMonths >= 12) {
      const fallback = findFallbackPlan(relevantPlans, plan)
      if (fallback) {
        const fallbackEnergyBase = Object.entries(profile.hourlyShares).reduce((sum, [hour, share]) => {
          return sum + annualKwh * share * fallback.hourlyRates[hour]
        }, 0)
        const fallbackStandingRaw = region === "urban" ? fallback.standingUrban : fallback.standingRural
        const fallbackStandingAnnual = annualizeStanding(fallbackStandingRaw, fallback.standingPeriod)
        year2Total = applyVat(fallbackEnergyBase, fallback.ratesIncludeVat, fallback.vatRate) +
          applyVat(fallbackStandingAnnual, fallback.standingIncludesVat, fallback.vatRate)
      }
    }

    return {
      providerName: plan.providerName,
      tariffName: plan.tariffName,
      meterType: plan.meterType,
      year1Total,
      year2Total,
      promotional: plan.promotional,
    }
  })

  computed.sort((a, b) => a.year1Total - b.year1Total)
  const best = computed[0]?.year1Total ?? 0

  return computed.map((row, index) => ({
    ...row,
    rank: index + 1,
    savingsVsBest: row.year1Total - best,
  }))
}

export function buildFlexibility(profile: ProfileData, marketSignals: MarketSignal[]): FlexibilityRow[] {
  const spreadNorm = normalize(marketSignals.map((row) => Math.abs(row.spread)))
  const volNorm = normalize(marketSignals.map((row) => row.volatility))
  const loadNorm = normalize(marketSignals.map((row) => profile.hourlyShares[String(row.hour)] ?? 0))

  return marketSignals.map((row, index) => {
    const flexibilityIndex = 0.4 * spreadNorm[index] + 0.3 * volNorm[index] + 0.3 * loadNorm[index]
    const level = flexibilityIndex >= 0.7 ? "High" : flexibilityIndex >= 0.4 ? "Medium" : "Low"
    return {
      hour: row.hour,
      spreadScore: spreadNorm[index],
      volatilityScore: volNorm[index],
      loadScore: loadNorm[index],
      flexibilityIndex,
      flexibilityLevel: level,
    }
  })
}

export function getRecommendation(plan: PlanResult, profile: ProfileData, topFlex: FlexibilityRow | undefined) {
  if (!plan || !topFlex) return "Select a profile and run the analysis to generate a recommendation."
  const bandBreakdown = [
    `day ${(profile.bands.day * 100).toFixed(1)}%`,
    `night ${(profile.bands.night * 100).toFixed(1)}%`,
    `peak ${(profile.bands.peak * 100).toFixed(1)}%`,
  ].join(" · ")

  return `Choose ${plan.providerName} – ${plan.tariffName}. Your selected household has a load shape of ${bandBreakdown}. The best demand-shift window is around ${String(topFlex.hour).padStart(2, "0")}:00, where the flexibility score is ${topFlex.flexibilityLevel.toLowerCase()}. Move discretionary loads such as laundry or EV charging away from the 17:00–19:00 peak when possible.`
}
