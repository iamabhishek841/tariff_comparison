/**
 * Meter Type Normalization
 *
 * Normalizes raw meter type values from data into clean, user-facing categories.
 * Provides bidirectional mapping between clean labels and raw values.
 */

/** Mapping of clean display labels to raw values from the data */
export const METER_TYPE_MAPPING: Record<string, string[]> = {
  "24 Hour Meter": [
    "24 Hour Meter",
    "24 Hour Standard Meter",
    "24hr Meter",
    "Standard 24hr Meter",
  ],
  "Day/Night Meter": [
    "Day/Night Meter",
    "NightSaver Meter",
    "24hr NightSaver Meter",
  ],
  "Smart Meter": [
    "Smart Meter",
    "Smart Meter (SST)",
  ],
  "Smart EV Meter": [
    "Smart EV Meter",
  ],
}

/**
 * Get the clean category for a raw meter type value
 * @param rawValue - Raw meter type value from data
 * @returns Clean display label, or the raw value if no mapping exists
 */
export function getNormalizedMeterType(rawValue: string): string {
  for (const [cleanLabel, rawValues] of Object.entries(METER_TYPE_MAPPING)) {
    if (rawValues.some((rv) => rv.toLowerCase() === rawValue.toLowerCase())) {
      return cleanLabel
    }
  }
  // Return raw value if no mapping found
  return rawValue
}

/**
 * Get all raw values for a clean meter type category
 * @param cleanLabel - Clean display label
 * @returns Array of raw values that map to this label
 */
export function getRawMeterTypesForClean(cleanLabel: string): string[] {
  return METER_TYPE_MAPPING[cleanLabel] ?? [cleanLabel]
}

/**
 * Get all unique normalized meter type categories
 * @param rawMeterTypes - Array of raw meter type values
 * @returns Array of unique clean display labels, sorted
 */
export function getNormalizedMeterTypes(rawMeterTypes: string[]): string[] {
  const normalized = new Set(rawMeterTypes.map(getNormalizedMeterType))
  return Array.from(normalized).sort()
}

/**
 * Check if a clean meter type label matches any raw meter type
 * Case-insensitive comparison
 * @param cleanLabel - Clean display label
 * @param rawValue - Raw meter type value
 * @returns true if they match
 */
export function isMeterTypeMatch(cleanLabel: string, rawValue: string): boolean {
  if (cleanLabel === "All meter types") return true // Special case: matches all

  const rawValuesForClean = getRawMeterTypesForClean(cleanLabel)
  return rawValuesForClean.some((rv) => rv.toLowerCase() === rawValue.toLowerCase())
}

/**
 * Filter meter types by a clean category
 * @param meterTypes - Array of raw meter types
 * @param cleanLabel - Clean display label to filter by
 * @returns Filtered array of raw meter types
 */
export function filterByNormalizedType(meterTypes: string[], cleanLabel: string): string[] {
  if (cleanLabel === "All meter types") return meterTypes

  const rawValues = getRawMeterTypesForClean(cleanLabel)
  return meterTypes.filter((mt) => rawValues.some((rv) => rv.toLowerCase() === mt.toLowerCase()))
}

/**
 * Get user-facing display options for the meter type dropdown
 * @param rawMeterTypes - Array of raw meter types from data
 * @returns Array of clean labels ready for dropdown display, with "All meter types" first
 */
export function getMeterTypeOptions(rawMeterTypes: string[]): string[] {
  const normalized = getNormalizedMeterTypes(rawMeterTypes)
  return ["All meter types", ...normalized]
}

/**
 * Format a raw meter type for display (normalized version)
 * @param rawValue - Raw meter type value
 * @returns Clean display label
 */
export function formatMeterType(rawValue: string): string {
  return getNormalizedMeterType(rawValue)
}

/**
 * Validate that a clean meter type label is valid
 * @param cleanLabel - Clean display label
 * @returns true if the label exists in the mapping
 */
export function isValidNormalizedMeterType(cleanLabel: string): boolean {
  return cleanLabel === "All meter types" || cleanLabel in METER_TYPE_MAPPING
}

