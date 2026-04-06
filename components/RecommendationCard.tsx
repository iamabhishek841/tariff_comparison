import { Lightbulb } from "lucide-react"
import { MetricCard } from "@/components/MetricCard"
import { HouseholdInputs } from "@/components/HouseholdForm"
import { FlexibilityRow, PlanResult } from "@/lib/types"
import { formatMeterType } from "@/lib/meterTypeNormalization"

interface RecommendationCardProps {
  submitted: HouseholdInputs
  cheapestPlan: PlanResult
  topFlex?: FlexibilityRow
  recommendation: string
  onStartOver: () => void
  onReviewTariffs: () => void
}

export function RecommendationCard({
  submitted,
  cheapestPlan,
  topFlex,
  recommendation,
  onStartOver,
  onReviewTariffs,
}: RecommendationCardProps) {
  return (
     <section className="panel recommendation-panel">
       <div className="panel-header">
         <div>
           <h2>Step 4 - Your Personalized Plan</h2>
           <p className="muted">Based on your household details and market analysis, here's our tailored recommendation.</p>
         </div>
       </div>

       <div className="metrics-grid four">
         <MetricCard label="Occupants" value={submitted.occupancyGroup} />
         <MetricCard label="Recommended plan" value={cheapestPlan.providerName} hint={cheapestPlan.tariffName} />
         <MetricCard label="First year cost" value={`EUR ${cheapestPlan.year1Total.toFixed(2)}`} />
         <MetricCard label="Peak usage hour" value={`${String(topFlex?.hour ?? 0).padStart(2, "0")}:00`} hint={topFlex?.flexibilityLevel} />
       </div>

       <div className="summary-card">
         <div className="summary-icon"><Lightbulb size={24} /></div>
         <div>
           <h3>Your best option</h3>
           <p>{recommendation}</p>
         </div>
       </div>

       <div className="chart-two-col">
         <div className="table-card compact">
           <div className="section-title">Your household</div>
           <div className="mini-list">
             <div className="mini-row"><strong>Occupants</strong><span>{submitted.occupancyGroup}</span></div>
             <div className="mini-row"><strong>Property</strong><span>{submitted.dwellingGroup}</span></div>
             <div className="mini-row"><strong>Area</strong><span>{submitted.region}</span></div>
             <div className="mini-row"><strong>Annual usage</strong><span>{submitted.annualKwh.toLocaleString()} kWh</span></div>
             <div className="mini-row"><strong>Meter type</strong><span>{submitted.meterFilter}</span></div>
           </div>
         </div>
         <div className="table-card compact">
           <div className="section-title">Recommended plan</div>
            <div className="mini-list">
             <div className="mini-row"><strong>Rank</strong><span>#{cheapestPlan.rank}</span></div>
             <div className="mini-row"><strong>Meter type</strong><span>{formatMeterType(cheapestPlan.meterType)}</span></div>
             <div className="mini-row"><strong>Year 2 cost</strong><span>EUR {cheapestPlan.year2Total.toFixed(2)}</span></div>
             <div className="mini-row"><strong>Flexibility level</strong><span>{topFlex?.flexibilityLevel ?? "-"}</span></div>
           </div>
        </div>
      </div>

      <div className="button-row">
        <button className="ghost-btn" onClick={onStartOver}>Start over</button>
        <button className="primary-btn" onClick={onReviewTariffs}>Review tariff table</button>
      </div>
    </section>
  )
}

