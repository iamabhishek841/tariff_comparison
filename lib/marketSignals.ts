import "server-only"
import fs from "node:fs"
import Papa from "papaparse"
import { MarketHalfHourRow, MarketSignal } from "@/lib/types"
import { getProjectFilePath } from "@/lib/files"

function toFloat(value: unknown): number | null {
  if (value === null || value === undefined) return null
  if (typeof value === "number") return Number.isFinite(value) ? value : null
  const parsed = Number(String(value).trim())
  return Number.isFinite(parsed) ? parsed : null
}

function normalize(values: number[]): number[] {
  if (values.length === 0) return []
  const min = Math.min(...values)
  const max = Math.max(...values)
  if (max <= min) return values.map(() => 0)
  return values.map((value) => (value - min) / (max - min))
}

export function parseMarketHalfHourRows(filename: string): MarketHalfHourRow[] {
  const filePath = getProjectFilePath(filename)
  const raw = fs.readFileSync(filePath, "utf8")
  const parsed = Papa.parse<Record<string, string>>(raw, {
    header: true,
    skipEmptyLines: true,
  })

  return (parsed.data ?? [])
    .map((row) => {
      const halfHour = toFloat(row.half_hour)
      const damPriceKwh = toFloat(row["dam_price/kwh"])
      const settlementPriceKwh = toFloat(row["target_settlement/kwh"])
      const spreadKwh = toFloat(row["spread/kwh"])

      if (halfHour === null || damPriceKwh === null || settlementPriceKwh === null || spreadKwh === null) {
        return null
      }
      if (halfHour < 0 || halfHour > 47) return null

      return {
        halfHour: Math.floor(halfHour),
        hour: Math.floor(halfHour / 2),
        damPriceKwh,
        settlementPriceKwh,
        spreadKwh,
      }
    })
    .filter((row): row is MarketHalfHourRow => row !== null)
}

function buildHourlyVolatility(rows: MarketHalfHourRow[]): Map<number, number> {
  const grouped = new Map<number, number[]>()
  rows.forEach((row) => {
    if (!grouped.has(row.hour)) grouped.set(row.hour, [])
    ;(grouped.get(row.hour) as number[]).push(row.spreadKwh)
  })

  const result = new Map<number, number>()
  grouped.forEach((values, hour) => {
    if (values.length === 0) {
      result.set(hour, 0)
      return
    }
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length
    const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length
    result.set(hour, Math.sqrt(variance))
  })
  return result
}

export function buildHourlyMarketSignals(rows: MarketHalfHourRow[]): MarketSignal[] {
  const grouped = new Map<number, MarketHalfHourRow[]>()
  for (let hour = 0; hour < 24; hour += 1) {
    grouped.set(hour, [])
  }

  rows.forEach((row) => {
    ;(grouped.get(row.hour) as MarketHalfHourRow[]).push(row)
  })

  const volatilityByHour = buildHourlyVolatility(rows)

  const signals: MarketSignal[] = []
  for (let hour = 0; hour < 24; hour += 1) {
    const hourRows = grouped.get(hour) as MarketHalfHourRow[]
    if (hourRows.length === 0) {
      signals.push({
        hour,
        damPrice: 0,
        settlementPrice: 0,
        spread: 0,
        volatility: volatilityByHour.get(hour) ?? 0,
      })
      continue
    }

    const damPrice = hourRows.reduce((sum, row) => sum + row.damPriceKwh, 0) / hourRows.length
    const settlementPrice = hourRows.reduce((sum, row) => sum + row.settlementPriceKwh, 0) / hourRows.length
    const spread = hourRows.reduce((sum, row) => sum + row.spreadKwh, 0) / hourRows.length

    signals.push({
      hour,
      damPrice,
      settlementPrice,
      spread,
      volatility: volatilityByHour.get(hour) ?? 0,
    })
  }

  return signals
}

export function normalizeSeries(values: number[]): number[] {
  return normalize(values)
}

