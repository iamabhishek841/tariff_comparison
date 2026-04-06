import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { MetricCard } from "@/components/MetricCard"
import { HouseholdInputs } from "@/components/HouseholdForm"
import { AnalysisProfile, PlanResult } from "@/lib/types"
import { formatMeterType } from "@/lib/meterTypeNormalization"

const COLORS = ["#57d5ff", "#8b5cf6", "#ff8a5b"]

interface TariffResultsProps {
  submitted: HouseholdInputs
  profile: AnalysisProfile
  tariffResults: PlanResult[]
  onBack: () => void
  onContinue: () => void
  onEditInputs: () => void
}

export function TariffResults({
  submitted,
  profile,
  tariffResults,
  onBack,
  onContinue,
  onEditInputs,
}: TariffResultsProps) {
  const cheapestPlan = tariffResults[0]
  const topPlans = tariffResults.slice(0, 3)
  const profileBandData = [
    { name: "Day", value: profile.bands.day * 100 },
    { name: "Night", value: profile.bands.night * 100 },
    { name: "Peak", value: profile.bands.peak * 100 },
  ]

   return (
     <section className="panel">
       <div className="panel-header">
         <div>
           <h2>Step 2 - Your Best Plan Options</h2>
           <p className="muted">Ranked by lowest total cost for year 1. Prices include standing charges and regional variations.</p>
         </div>
         <button className="ghost-btn" onClick={onEditInputs}>Adjust inputs</button>
       </div>

       <div className="metrics-grid four">
         <MetricCard label="Occupants" value={submitted.occupancyGroup} />
         <MetricCard label="Property" value={submitted.dwellingGroup} />
         <MetricCard label="Usage" value={`${submitted.annualKwh.toLocaleString()} kWh`} />
         <MetricCard label="Best price (year 1)" value={cheapestPlan ? `EUR ${cheapestPlan.year1Total.toFixed(2)}` : "-"} />
       </div>

       <div className="chart-card">
         <div className="section-title">Your usage pattern (day / night / peak)</div>
        <div className="chart-two-col">
          <div className="donut-wrap">
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={profileBandData} dataKey="value" nameKey="name" innerRadius={70} outerRadius={105} paddingAngle={4}>
                  {profileBandData.map((entry, index) => <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(value: number) => `${value.toFixed(1)}%`} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="metrics-grid">
            <MetricCard label="Day share" value={`${(profile.bands.day * 100).toFixed(1)}%`} />
            <MetricCard label="Night share" value={`${(profile.bands.night * 100).toFixed(1)}%`} />
            <MetricCard label="Peak share" value={`${(profile.bands.peak * 100).toFixed(1)}%`} />
          </div>
        </div>
      </div>

      {cheapestPlan ? (
        <div className="winner-card">
          <div>
            <div className="winner-label">Cheapest tariff for submitted inputs</div>
            <h3>{cheapestPlan.providerName}</h3>
            <p>{cheapestPlan.tariffName}</p>
          </div>
          <div className="winner-metrics">
            <MetricCard label="Year 1" value={`EUR ${cheapestPlan.year1Total.toFixed(2)}`} />
            <MetricCard label="Year 2" value={`EUR ${cheapestPlan.year2Total.toFixed(2)}`} />
          </div>
        </div>
      ) : null}

      <div className="top-cards">
        {topPlans.map((plan) => (
          <div key={`${plan.providerName}-${plan.tariffName}`} className="top-plan-card">
            <div className="top-plan-rank">#{plan.rank}</div>
            <h4>{plan.providerName}</h4>
            <p>{plan.tariffName}</p>
            <div className="top-plan-price">EUR {plan.year1Total.toFixed(2)}</div>
          </div>
        ))}
      </div>

      <div className="chart-card">
        <div className="section-title">Top 3 yearly cost comparison</div>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={topPlans}>
            <CartesianGrid vertical={false} stroke="#e2e8f0" />
            <XAxis dataKey="providerName" stroke="#64748b" />
            <YAxis stroke="#64748b" />
            <Tooltip formatter={(value: number) => `EUR ${value.toFixed(2)}`} />
            <Bar dataKey="year1Total" fill="#57d5ff" radius={[10, 10, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="table-card">
        <div className="section-title">All ranked tariffs</div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Rank</th>
                <th>Provider</th>
                <th>Tariff</th>
                <th>Meter type</th>
                <th>Year 1</th>
                <th>Year 2</th>
                <th>Savings vs best</th>
              </tr>
            </thead>
            <tbody>
              {tariffResults.map((row) => (
                <tr key={`${row.providerName}-${row.tariffName}`}>
                  <td>{row.rank}</td>
                  <td>{row.providerName}</td>
                  <td>{row.tariffName}</td>
                  <td>{formatMeterType(row.meterType)}</td>
                  <td>EUR {row.year1Total.toFixed(2)}</td>
                  <td>EUR {row.year2Total.toFixed(2)}</td>
                  <td>{row.rank === 1 ? "Best" : `EUR ${row.savingsVsBest.toFixed(2)}`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="button-row">
        <button className="ghost-btn" onClick={onBack}>Back</button>
        <button className="primary-btn" onClick={onContinue}>Continue to flexibility</button>
      </div>
    </section>
  )
}

