export type Region = "urban" | "rural"

export interface AnalysisInput {
  occupancyGroup: string
  dwellingGroup: string
  region: Region
  annualKwh: number
  meterFilter?: string
}

export interface SlotShare {
  slot: number
  timeLabel: string
  tariffBand: string
  share: number
}

export interface ProfileData {
  id: string
  occupancyGroup: string
  dwellingGroup: string
  slots: SlotShare[]
  hourlyShares: Record<string, number>
  bands: Record<string, number>
}

export interface PlanData {
  id: string
  providerName: string
  tariffName: string
  meterType: string
  standingUrban: number
  standingRural: number
  standingPeriod: string
  standingIncludesVat: boolean
  ratesIncludeVat: boolean
  vatRate: number
  hourlyRates: Record<string, number>
  promotional: boolean
  promoDurationMonths: number
  reversionTariffName: string
}

export interface MarketSignal {
  hour: number
  damPrice: number
  settlementPrice: number
  spread: number
  volatility: number
}

export interface PlanResult {
  rank: number
  providerName: string
  tariffName: string
  meterType: string
  year1Total: number
  year2Total: number
  savingsVsBest: number
  promotional: boolean
}

export interface FlexibilityRow {
  hour: number
  spreadScore: number
  volatilityScore: number
  loadScore: number
  flexibilityIndex: number
  flexibilityLevel: "High" | "Medium" | "Low"
}

export interface AnalysisProfile {
  occupancyGroup: string
  dwellingGroup: string
  hourlyShares: Record<string, number>
  bands: Record<string, number>
}

export interface TariffPlan {
  providerName: string
  meterType: string
  tariffName: string
  reversionTariffName: string
  standingUrban: number | null
  standingRural: number | null
  standingPeriod: string
  standingIncludesVat: boolean
  ratesIncludeVat: boolean
  vatRate: number
  hourlyRates: Record<string, number>
  promotional: boolean
  promoDurationMonths: number | null
}

export interface MarketHalfHourRow {
  halfHour: number
  hour: number
  damPriceKwh: number
  settlementPriceKwh: number
  spreadKwh: number
}

export interface AnalysisResponse {
  profile: AnalysisProfile
  tariffResults: PlanResult[]
  flexibilityResults: FlexibilityRow[]
  marketSignals: MarketSignal[]
  recommendation: string
}

export interface AnalysisOptions {
  occupancyGroups: string[]
  dwellingGroups: string[]
  meterTypes: string[]
}

