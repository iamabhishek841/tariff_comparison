import { NextResponse } from "next/server"
import { getAnalysisOptionsAsync } from "@/lib/server/analysis-runtime"

export const runtime = "nodejs"

function sanitizeOptionsError(error: unknown): string {
  if (!(error instanceof Error)) return "Could not load analysis options"

  const message = error.message || ""

  // Legacy XLSX errors may include absolute paths; keep UI output filename-only.
  if (message.toLowerCase().startsWith("cannot access file ")) {
    const rawPath = message.slice("Cannot access file ".length).trim()
    const fileName = rawPath.split(/[\\/]/).pop() || "data file"
    return `File ${fileName} not found in data folder`
  }

  if (message.toLowerCase().startsWith("file ") && message.toLowerCase().includes("not found at ")) {
    return message
  }

  return "Could not load analysis options"
}

export async function GET() {
  try {
    console.info("[api/analysis-options] GET request received")
    const options = await getAnalysisOptionsAsync()
    console.info("[api/analysis-options] Successfully loaded options")
    return NextResponse.json(options)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    const stack = error instanceof Error ? error.stack : ""
    
    console.error("[api/analysis-options] ERROR:", errorMessage)
    console.error("[api/analysis-options] STACK:", stack)
    
    const message = sanitizeOptionsError(error)
    
    // Include detailed debug info in response for development
    const isProduction = process.env.NODE_ENV === "production"
    const debugInfo = !isProduction ? { 
      rawError: errorMessage,
      stack: stack,
      cwd: process.cwd()
    } : {}
    
    return NextResponse.json({ 
      error: message,
      ...(Object.keys(debugInfo).length > 0 ? { debug: debugInfo } : {})
    }, { status: 500 })
  }
}
