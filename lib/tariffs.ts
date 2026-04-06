import "server-only"
import fs from "node:fs"
import Papa from "papaparse"
import { AnalysisProfile, PlanResult, Region, TariffPlan } from "@/lib/types"
import { getProjectFilePath } from "@/lib/files"
import { getRawMeterTypesForClean, isValidNormalizedMeterType } from "@/lib/meterTypeNormalization"

function toFloat(value: unknown): number | null {
  if (value === null || value === undefined) return null
  if (typeof value === "number") return Number.isFinite(value) ? value : null

  const text = String(value).trim()
  if (!text) return null
  const lowered = text.toLowerCase()
  if (["null", "none", "nan", "na", "not applicable", "not mentioned"].includes(lowered)) return null

  const parsed = Number(text.replace(/,/g, "").replace(/%/g, ""))
  return Number.isFinite(parsed) ? parsed : null
}

function toBool(value: unknown): boolean {
  if (typeof value === "boolean") return value
  if (typeof value === "number") return value !== 0
  return ["true", "t", "1", "yes", "y"].includes(String(value ?? "").trim().toLowerCase())
}

function normalizeVatRate(vatRaw: unknown): number {
  const value = toFloat(vatRaw)
  if (value === null) return 0
  return value > 1 ? value / 100 : value
}

function normalizeStanding(amount: number | null, periodRaw: unknown): number {
  if (amount === null) return 0
  const period = String(periodRaw ?? "yearly").trim().toLowerCase()
  const map: Record<string, number> = {
    year: 1,
    yearly: 1,
    annual: 1,
    month: 12,
    monthly: 12,
    quarter: 4,
    quarterly: 4,
    week: 52,
    weekly: 52,
    day: 365,
    daily: 365,
  }
  return amount * (map[period] ?? 1)
}

function toEurPerKwh(rawRate: number): number {
  return rawRate > 2 ? rawRate / 100 : rawRate
}

function componentTotal(amount: number, includesVat: boolean, vatRate: number): number {
  return includesVat ? amount : amount * (1 + vatRate)
}

export function parseTariffPlans(filename: string): TariffPlan[] {
  const filePath = getProjectFilePath(filename)
  const raw = fs.readFileSync(filePath, "utf8")
  const parsed = Papa.parse<Record<string, string>>(raw, {
    header: true,
    skipEmptyLines: true,
  })

  return (parsed.data ?? [])
    .filter((row) => {
      const provider = String(row.provider_name ?? "").trim()
      const tariff = String(row.tariff_name ?? "").trim()
      if (!provider || !tariff) return false
      return toBool(row["source.verified"]) && toBool(row["tariffs.human_verification"])
    })
    .map((row) => {
      const hourlyRates: Record<string, number> = {}
      for (let hour = 0; hour < 24; hour += 1) {
        const key = String(hour).padStart(2, "0")
        hourlyRates[key] = toEurPerKwh(toFloat(row[`rate_time_${key}`]) ?? 0)
      }

      const promoMonths = toFloat(row["tariffs.promo_duration_months"])
      return {
        providerName: String(row.provider_name ?? "Unknown").trim() || "Unknown",
        meterType: String(row.Meter_Type ?? "Unknown").trim() || "Unknown",
        tariffName: String(row.tariff_name ?? "Unknown").trim() || "Unknown",
        reversionTariffName: String(row.reversion_tariff_name ?? "").trim(),
        standingUrban: toFloat(row["standing_charges.urban"]),
        standingRural: toFloat(row["standing_charges.rural"]),
        standingPeriod: String(row.standing_charge_period ?? "yearly").trim() || "yearly",
        standingIncludesVat: toBool(row.standing_charge_includes_vat),
        ratesIncludeVat: toBool(row["tariffs.vat_included"]),
        vatRate: normalizeVatRate(row.vat_rate),
        hourlyRates,
        promotional: toBool(row["tariffs.is_promotional"]),
        promoDurationMonths: promoMonths && promoMonths > 0 ? Math.round(promoMonths) : null,
      }
    })
}

function findFallbackPlan(plans: TariffPlan[], plan: TariffPlan): TariffPlan | undefined {
  const provider = plan.providerName.toLowerCase()
  const meterType = plan.meterType.toLowerCase()

  if (plan.reversionTariffName) {
    const exact = plans.find(
      (candidate) =>
        candidate.providerName.toLowerCase() === provider &&
        candidate.meterType.toLowerCase() === meterType &&
        !candidate.promotional &&
        candidate.tariffName.toLowerCase() === plan.reversionTariffName.toLowerCase(),
    )
    if (exact) return exact
  }

  const sameName = plans.find(
    (candidate) =>
      candidate.providerName.toLowerCase() === provider &&
      candidate.meterType.toLowerCase() === meterType &&
      !candidate.promotional &&
      candidate.tariffName.toLowerCase() === plan.tariffName.toLowerCase(),
  )
  if (sameName) return sameName

  return plans.find(
    (candidate) =>
      candidate.providerName.toLowerCase() === provider &&
      candidate.meterType.toLowerCase() === meterType &&
      !candidate.promotional,
  )
}

function calculateAnnualCost(
  plan: TariffPlan,
  annualKwh: number,
  hourlyShares: Record<string, number>,
  region: Region,
): number {
  let energyBase = 0
  for (let hour = 0; hour < 24; hour += 1) {
    const key = String(hour).padStart(2, "0")
    energyBase += annualKwh * (hourlyShares[key] ?? 0) * (plan.hourlyRates[key] ?? 0)
  }

  const standingRaw = region === "urban"
    ? (plan.standingUrban ?? plan.standingRural)
    : (plan.standingRural ?? plan.standingUrban)
  const annualStanding = normalizeStanding(standingRaw, plan.standingPeriod)

  const finalEnergy = componentTotal(energyBase, plan.ratesIncludeVat, plan.vatRate)
  const finalStanding = componentTotal(annualStanding, plan.standingIncludesVat, plan.vatRate)

  return finalEnergy + finalStanding
}

export function buildTariffResults(
  plans: TariffPlan[],
  profile: AnalysisProfile,
  annualKwh: number,
  region: Region,
  meterFilter?: string,
): PlanResult[] {
  const filtered = meterFilter && meterFilter !== "All meter types"
    ? (() => {
        // Handle normalized meter type filter
        if (isValidNormalizedMeterType(meterFilter)) {
          const rawTypes = getRawMeterTypesForClean(meterFilter)
          return plans.filter((plan) =>
            rawTypes.some((rt) => rt.toLowerCase() === plan.meterType.toLowerCase())
          )
        }
        // Fallback: exact match for legacy/raw values
        return plans.filter((plan) => plan.meterType === meterFilter)
      })()
    : plans

  const computed = filtered.map((plan) => {
    const baseTotal = calculateAnnualCost(plan, annualKwh, profile.hourlyShares, region)
    let year1Total = baseTotal
    let year2Total = baseTotal

    if (plan.promotional && plan.promoDurationMonths && plan.promoDurationMonths > 0) {
      const fallback = findFallbackPlan(filtered, plan)
      if (fallback) {
        const fallbackTotal = calculateAnnualCost(fallback, annualKwh, profile.hourlyShares, region)
        const promoFraction = Math.max(0, Math.min(12, plan.promoDurationMonths)) / 12
        year1Total = (baseTotal * promoFraction) + (fallbackTotal * (1 - promoFraction))
        year2Total = fallbackTotal
      }
    }

    return {
      rank: 0,
      providerName: plan.providerName,
      tariffName: plan.tariffName,
      meterType: plan.meterType,
      year1Total,
      year2Total,
      savingsVsBest: 0,
      promotional: plan.promotional,
    }
  })

  computed.sort((a, b) => {
    if (a.year1Total !== b.year1Total) return a.year1Total - b.year1Total
    if (a.year2Total !== b.year2Total) return a.year2Total - b.year2Total
    if (a.providerName !== b.providerName) return a.providerName.localeCompare(b.providerName)
    return a.tariffName.localeCompare(b.tariffName)
  })

  const best = computed[0]?.year1Total ?? 0
  return computed.map((row, index) => ({
    ...row,
    rank: index + 1,
    savingsVsBest: row.year1Total - best,
  }))
}

