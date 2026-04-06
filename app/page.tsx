"use client"

import { MapPin, Zap } from "lucide-react"
import { useEffect, useState } from "react"
import { HouseholdInputs } from "@/components/HouseholdForm"
import { StepWizard } from "@/components/StepWizard"
import { AnalysisInput, AnalysisOptions, AnalysisResponse } from "@/lib/types"

const defaultOptions: AnalysisOptions = {
  occupancyGroups: ["2_occ", "3_occ", "4_occ", "5_occ"],
  dwellingGroups: ["apartment", "bungalow", "detached", "semi_detached", "terraced"],
  meterTypes: ["All meter types"],
}

function buildDefaultInputs(options: AnalysisOptions): HouseholdInputs {
  return {
    occupancyGroup: options.occupancyGroups[0] ?? "2_occ",
    dwellingGroup: options.dwellingGroups.includes("detached") ? "detached" : options.dwellingGroups[0] ?? "detached",
    region: "urban",
    annualKwh: 4200,
    meterFilter: options.meterTypes[0] ?? "All meter types",
  }
}

export default function HomePage() {
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [options, setOptions] = useState<AnalysisOptions>(defaultOptions)
  const [inputs, setInputs] = useState<HouseholdInputs>(buildDefaultInputs(defaultOptions))
  const [submitted, setSubmitted] = useState<HouseholdInputs | null>(null)
  const [result, setResult] = useState<AnalysisResponse | null>(null)

  useEffect(() => {
    async function loadOptions() {
      try {
        setLoading(true)
        setError(null)

        const response = await fetch("/api/analysis-options")
        const payload = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(payload.error ?? "Could not load analysis options")

        const serverOptions = payload as AnalysisOptions
        setOptions(serverOptions)
        setInputs(buildDefaultInputs(serverOptions))
      } catch (loadError) {
        const message = loadError instanceof Error ? loadError.message : "Could not load analysis options"
        setError(message)
      } finally {
        setLoading(false)
      }
    }

    loadOptions()
  }, [])

  async function runAnalysis() {
    try {
      setRunning(true)
      setError(null)

      const payload: AnalysisInput = {
        occupancyGroup: inputs.occupancyGroup,
        dwellingGroup: inputs.dwellingGroup,
        region: inputs.region,
        annualKwh: inputs.annualKwh,
        meterFilter: inputs.meterFilter,
      }

      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error ?? "Analysis failed")

      setResult(data as AnalysisResponse)
      setSubmitted({ ...inputs })
      setStep(2)
    } catch (analysisError) {
      const message = analysisError instanceof Error ? analysisError.message : "Analysis failed"
      setError(message)
    } finally {
      setRunning(false)
    }
  }

  if (loading) {
    return (
      <main className="shell app-bg">
        <div className="bg-orb top-right" />
        <div className="bg-orb bottom-left" />
        <div className="shell-content">
          <div className="loading">Loading electricity plans...</div>
        </div>
      </main>
    )
  }

  return (
    <main className="shell app-bg">
      <div className="bg-orb top-right" />
      <div className="bg-orb bottom-left" />

      <div className="shell-content">
        <section className="hero">
          <div>
            <div className="eyebrow">Find Your Perfect Electricity Plan</div>
            <h1>Electric Tariff Comparison</h1>
            <p>
              Compare electricity plans, analyze your usage patterns, and find the most cost-effective option tailored to your household.
            </p>
          </div>
          <div className="hero-badge">
            <Zap size={22} />
            <span>Real-time plan comparison with instant results</span>
          </div>
        </section>

        {error ? <div className="error-box">{error}</div> : null}

        <StepWizard
          step={step}
          options={options}
          inputs={inputs}
          running={running}
          submitted={submitted}
          result={result}
          onChangeInputs={setInputs}
          onRunAnalysis={runAnalysis}
          onStepChange={setStep}
        />

        <footer className="footer-note">
          <MapPin size={15} />
          <span>Comparing real electricity plans with live market data.</span>
        </footer>
      </div>
    </main>
  )
}
