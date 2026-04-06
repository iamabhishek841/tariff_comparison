import { ArrowRight, Home } from "lucide-react"
import { MetricCard } from "@/components/MetricCard"
import { AnalysisOptions, Region } from "@/lib/types"

export interface HouseholdInputs {
  occupancyGroup: string
  dwellingGroup: string
  region: Region
  annualKwh: number
  meterFilter: string
}

interface HouseholdFormProps {
  inputs: HouseholdInputs
  options: AnalysisOptions
  running: boolean
  onChange: (next: HouseholdInputs) => void
  onRunAnalysis: () => void
}

export function HouseholdForm({ inputs, options, running, onChange, onRunAnalysis }: HouseholdFormProps) {
  return (
    <section className="panel panel-grid">
      <div className="form-card">
        <h2>Step 1 - Tell Us About Your Home</h2>
         <p className="muted">Enter your household details to find electricity plans that match your needs and usage.</p>

        <div className="field-grid">
          <label>
            <span>Number of occupants</span>
            <select
              value={inputs.occupancyGroup}
              onChange={(e) => onChange({ ...inputs, occupancyGroup: e.target.value })}
            >
              {options.occupancyGroups.map((value) => <option key={value}>{value}</option>)}
            </select>
          </label>

          <label>
            <span>Property type</span>
            <select
              value={inputs.dwellingGroup}
              onChange={(e) => onChange({ ...inputs, dwellingGroup: e.target.value })}
            >
              {options.dwellingGroups.map((value) => <option key={value}>{value}</option>)}
            </select>
          </label>

          <div>
            <span className="field-label">Connection area</span>
            <div className="toggle-row">
              <button
                type="button"
                className={inputs.region === "urban" ? "toggle active" : "toggle"}
                onClick={() => onChange({ ...inputs, region: "urban" })}
              >
                Urban
              </button>
              <button
                type="button"
                className={inputs.region === "rural" ? "toggle active" : "toggle"}
                onClick={() => onChange({ ...inputs, region: "rural" })}
              >
                Rural
              </button>
            </div>
          </div>

          <label>
            <span>Annual electricity usage (kWh)</span>
            <input
              type="number"
              min={500}
              step={100}
              value={inputs.annualKwh}
              onChange={(e) => onChange({ ...inputs, annualKwh: Number(e.target.value) || 0 })}
            />
          </label>

          <label>
            <span>Meter type</span>
            <select
              value={inputs.meterFilter}
              onChange={(e) => onChange({ ...inputs, meterFilter: e.target.value })}
            >
              {options.meterTypes.map((value) => <option key={value}>{value}</option>)}
            </select>
          </label>
        </div>

        <button className="primary-btn" type="button" onClick={onRunAnalysis} disabled={running}>
          {running ? "Comparing plans..." : "Compare Plans"} <ArrowRight size={18} />
        </button>
      </div>

      <div className="preview-card">
        <div className="preview-head">
          <Home size={18} />
          <span>Your details</span>
        </div>
        <div className="preview-grid">
          <MetricCard label="Occupants" value={inputs.occupancyGroup} />
          <MetricCard label="Property" value={inputs.dwellingGroup} />
          <MetricCard label="Area" value={inputs.region} />
          <MetricCard label="Usage" value={`${inputs.annualKwh.toLocaleString()} kWh`} />
        </div>
        <div className="mini-card">
          <strong>How it works</strong>
          <p>We analyze your household details against real electricity plans to find your best options and potential savings.</p>
        </div>
      </div>
    </section>
  )
}

