import {
  AnalysisInput,
  AnalysisOptions,
  AnalysisResponse,
  AnalysisProfile,
  TariffPlan,
  MarketHalfHourRow,
} from "@/lib/types"
import { buildFlexibilityRows, buildRecommendation } from "@/lib/calculations"
import { parseLoadProfiles } from "@/lib/loadProfiles"
import { buildHourlyMarketSignals, parseMarketHalfHourRows } from "@/lib/marketSignals"
import { buildTariffResults, parseTariffPlans } from "@/lib/tariffs"
import { getProjectFilePath } from "@/lib/files"
import { getMeterTypeOptions } from "@/lib/meterTypeNormalization"

interface DatasetCache {
  occupancyGroups: string[]
  dwellingGroups: string[]
  profilesByKey: Map<string, AnalysisProfile>
  tariffs: TariffPlan[]
  marketRows: MarketHalfHourRow[]
}

const LOAD_PROFILE_FILE = "task2_load_profiles.xlsx"
const TARIFF_FILE = "Tarrifs_validated.csv"
const MARKET_FILE = "full_year_halfhour_profile.csv"

let cached: DatasetCache | null = null
let loadingPromise: Promise<DatasetCache> | null = null
let loadingStarted = false

async function ensureDatasetAsync(): Promise<DatasetCache> {
  // Return cached result if available
  if (cached) return cached
  
  // Prevent concurrent loading attempts
  if (loadingPromise) return loadingPromise

  loadingPromise = (async () => {
    try {
      const cwd = process.cwd()
      console.info(`[analysis-runtime] START - process.cwd(): ${cwd}`)

      // Check files exist
      const requiredFiles = [LOAD_PROFILE_FILE, TARIFF_FILE, MARKET_FILE]
      for (const filename of requiredFiles) {
        try {
          console.info(`[analysis-runtime] Checking file: ${filename}`)
          const filePath = getProjectFilePath(filename)
          console.info(`[analysis-runtime] ✓ ${filename} found at ${filePath}`)
        } catch (e) {
          console.error(`[analysis-runtime] ✗ ${filename} NOT found:`, e instanceof Error ? e.message : String(e))
          throw new Error(`Required file missing: ${filename}`)
        }
      }

      // Parse files with detailed logging
      console.info(`[analysis-runtime] Parsing ${LOAD_PROFILE_FILE}...`)
      const startProfiles = Date.now()
      const profiles = parseLoadProfiles(LOAD_PROFILE_FILE)
      console.info(`[analysis-runtime] ✓ Parsed profiles in ${Date.now() - startProfiles}ms - ${profiles.occupancyGroups.length} groups`)

      console.info(`[analysis-runtime] Parsing ${TARIFF_FILE}...`)
      const startTariffs = Date.now()
      const tariffs = parseTariffPlans(TARIFF_FILE)
      console.info(`[analysis-runtime] ✓ Parsed tariffs in ${Date.now() - startTariffs}ms - ${tariffs.length} plans`)

      console.info(`[analysis-runtime] Parsing ${MARKET_FILE}...`)
      const startMarket = Date.now()
      const marketRows = parseMarketHalfHourRows(MARKET_FILE)
      console.info(`[analysis-runtime] ✓ Parsed market in ${Date.now() - startMarket}ms - ${marketRows.length} rows`)

      cached = {
        occupancyGroups: profiles.occupancyGroups,
        dwellingGroups: profiles.dwellingGroups,
        profilesByKey: profiles.profilesByKey,
        tariffs,
        marketRows,
      }

      console.info(`[analysis-runtime] READY - All datasets loaded successfully`)
      return cached
    } catch (error) {
      console.error(`[analysis-runtime] FATAL ERROR:`, error)
      loadingPromise = null // Reset so next attempt can try again
      throw error
    }
  })()

  return loadingPromise
}

export function getAnalysisOptions(): AnalysisOptions {
  // SYNC version - will fail if called before cache is ready
  if (!cached) {
    throw new Error("Datasets not loaded yet - call getAnalysisOptionsAsync or wait for bootstrap")
  }
  const meterTypes = getMeterTypeOptions(cached.tariffs.map((plan) => plan.meterType))
  return {
    occupancyGroups: cached.occupancyGroups,
    dwellingGroups: cached.dwellingGroups,
    meterTypes,
  }
}

export async function getAnalysisOptionsAsync(): Promise<AnalysisOptions> {
  const dataset = await ensureDatasetAsync()
  const meterTypes = getMeterTypeOptions(dataset.tariffs.map((plan) => plan.meterType))
  return {
    occupancyGroups: dataset.occupancyGroups,
    dwellingGroups: dataset.dwellingGroups,
    meterTypes,
  }
}

export async function runAnalysisAsync(input: AnalysisInput): Promise<AnalysisResponse> {
  const dataset = await ensureDatasetAsync()

  const profileKey = `${input.occupancyGroup}::${input.dwellingGroup}`
  const profile = dataset.profilesByKey.get(profileKey)
  if (!profile) {
    throw new Error(`No profile found for occupancy=${input.occupancyGroup} and dwelling=${input.dwellingGroup}`)
  }

  const annualKwh = Number(input.annualKwh)
  if (!Number.isFinite(annualKwh) || annualKwh <= 0) {
    throw new Error("annualKwh must be a positive number")
  }

  const tariffResults = buildTariffResults(
    dataset.tariffs,
    profile,
    annualKwh,
    input.region,
    input.meterFilter,
  )
  if (tariffResults.length === 0) {
    throw new Error("No tariffs matched your selected meter type")
  }

  const marketSignals = buildHourlyMarketSignals(dataset.marketRows)
  const flexibilityResults = buildFlexibilityRows(profile, marketSignals)
  const topFlex = [...flexibilityResults].sort((a, b) => b.flexibilityIndex - a.flexibilityIndex)[0]

  return {
    profile,
    tariffResults,
    flexibilityResults,
    marketSignals,
    recommendation: buildRecommendation(profile, tariffResults[0], topFlex),
  }
}

// Bootstrap datasets on first API call - do NOT block module load
// The ensureDatasetAsync() function is idempotent and caches results

