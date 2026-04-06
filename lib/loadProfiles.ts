import "server-only"
import fs from "node:fs"
import * as XLSX from "xlsx"
import { AnalysisProfile } from "@/lib/types"
import { getProjectFilePath } from "@/lib/files"

interface ParsedProfiles {
  occupancyGroups: string[]
  dwellingGroups: string[]
  profilesByKey: Map<string, AnalysisProfile>
}

function toFloat(value: unknown): number | null {
  if (value === null || value === undefined) return null
  if (typeof value === "number") return Number.isFinite(value) ? value : null
  const parsed = Number(String(value).trim())
  return Number.isFinite(parsed) ? parsed : null
}

function getField(row: Record<string, unknown>, candidates: string[]): unknown {
  for (const key of candidates) {
    if (key in row) return row[key]
  }
  return null
}

function calcHourlyWeightsFrom48(slotShares: Map<number, number>): Record<string, number> {
  const byHour: Record<string, number> = {}
  for (let hour = 0; hour < 24; hour += 1) {
    byHour[String(hour).padStart(2, "0")] = 0
  }

  for (let slot = 1; slot <= 48; slot += 1) {
    const share = slotShares.get(slot) ?? 0
    const hour = Math.floor((slot - 1) / 2)
    byHour[String(hour).padStart(2, "0")] += share
  }

  const total = Object.values(byHour).reduce((sum, value) => sum + value, 0)
  if (total > 0) {
    Object.keys(byHour).forEach((hour) => {
      byHour[hour] = byHour[hour] / total
    })
  }
  return byHour
}

export function parseLoadProfiles(filename: string): ParsedProfiles {
  const filePath = getProjectFilePath(filename)

  // Read file with fs first to ensure it exists and is readable
  console.log("[loadProfiles] Reading file with fs:", filePath)
  const fileBuffer = fs.readFileSync(filePath)
  console.log("[loadProfiles] File read successfully, size:", fileBuffer.length, "bytes")

  // Now parse with XLSX
  const workbook = XLSX.read(fileBuffer, { type: "buffer" })

  console.log("[loadProfiles] available sheets:", workbook.SheetNames)

  const preferredSheetNames = [
    "combined_profiles_long",
    "combined_long",
    "combined_share",
  ]

  let sheetName: string | undefined

  for (const candidate of preferredSheetNames) {
    if (workbook.SheetNames.includes(candidate)) {
      sheetName = candidate
      break
    }
  }

  if (!sheetName) {
    throw new Error(
      `No supported profile sheet found in ${filename}. Available sheets: ${workbook.SheetNames.join(", ")}`
    )
  }

  const sheet = workbook.Sheets[sheetName]
  if (!sheet) {
    throw new Error(`Sheet '${sheetName}' could not be opened in ${filename}`)
  }

  console.log("[loadProfiles] using sheet:", sheetName)

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null })

  console.log("[loadProfiles] row count:", rows.length)
  if (rows.length > 0) {
    console.log("[loadProfiles] first row keys:", Object.keys(rows[0]))
    console.log("[loadProfiles] first row sample:", rows[0])
  }

  const groupedSlots = new Map<string, Map<number, number>>()
  const groupedBands = new Map<string, Map<string, number>>()
  const occupancy = new Set<string>()
  const dwelling = new Set<string>()

  rows.forEach((row) => {
    const occupancyGroup = String(
      getField(row, ["occupancy_group", "occupancy"]) ?? ""
    ).trim()

    const dwellingGroup = String(
      getField(row, ["dwelling_group", "dwelling"]) ?? ""
    ).trim()

    const slot = toFloat(getField(row, ["slot"]))

    const finalShare = toFloat(
      getField(row, ["final_share", "share", "avg_kwh"])
    )

    const tariffBand = String(
      getField(row, ["tariff_band", "band_3", "band"]) ?? ""
    ).trim().toLowerCase()

    if (!occupancyGroup || !dwellingGroup || slot === null || finalShare === null) return
    if (slot < 1 || slot > 48) return

    const key = `${occupancyGroup}::${dwellingGroup}`
    const slotInt = Math.floor(slot)

    occupancy.add(occupancyGroup)
    dwelling.add(dwellingGroup)

    if (!groupedSlots.has(key)) groupedSlots.set(key, new Map<number, number>())
    if (!groupedBands.has(key)) groupedBands.set(key, new Map<string, number>())

    const slotMap = groupedSlots.get(key) as Map<number, number>
    slotMap.set(slotInt, (slotMap.get(slotInt) ?? 0) + finalShare)

    if (tariffBand) {
      const bandMap = groupedBands.get(key) as Map<string, number>
      bandMap.set(tariffBand, (bandMap.get(tariffBand) ?? 0) + finalShare)
    }
  })

  const profilesByKey = new Map<string, AnalysisProfile>()
  groupedSlots.forEach((slotShares, key) => {
    const [occupancyGroup, dwellingGroup] = key.split("::")
    const bandMap = groupedBands.get(key) ?? new Map<string, number>()

    const day = bandMap.get("day") ?? 0
    const night = bandMap.get("night") ?? 0
    const peak = bandMap.get("peak") ?? 0
    const total = day + night + peak

    profilesByKey.set(key, {
      occupancyGroup,
      dwellingGroup,
      hourlyShares: calcHourlyWeightsFrom48(slotShares),
      bands:
        total > 0
          ? { day: day / total, night: night / total, peak: peak / total }
          : { day: 0, night: 0, peak: 0 },
    })
  })

  return {
    occupancyGroups: Array.from(occupancy).sort(),
    dwellingGroups: Array.from(dwelling).sort(),
    profilesByKey,
  }
}