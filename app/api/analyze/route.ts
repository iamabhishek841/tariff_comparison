import { NextResponse } from "next/server"
import { AnalysisInput } from "@/lib/types"
import { runAnalysisAsync } from "@/lib/server/analysis-runtime"

export const runtime = "nodejs"

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<AnalysisInput>

    const payload: AnalysisInput = {
      occupancyGroup: String(body.occupancyGroup ?? "").trim(),
      dwellingGroup: String(body.dwellingGroup ?? "").trim(),
      region: body.region === "rural" ? "rural" : "urban",
      annualKwh: Number(body.annualKwh ?? 0),
      meterFilter: body.meterFilter ? String(body.meterFilter) : "All meter types",
    }

    if (!payload.occupancyGroup || !payload.dwellingGroup) {
      return NextResponse.json(
        { error: "occupancyGroup and dwellingGroup are required" },
        { status: 400 },
      )
    }

    const result = await runAnalysisAsync(payload)
    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Analysis failed"
    console.error("[api/analyze] ERROR:", message)
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
