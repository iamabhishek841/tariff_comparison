import { Area, AreaChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { MetricCard } from "@/components/MetricCard"
import { FlexibilityRow, MarketSignal } from "@/lib/types"

interface FlexibilityResultsProps {
  flexibilityResults: FlexibilityRow[]
  marketSignals: MarketSignal[]
  onBack: () => void
  onContinue: () => void
}

export function FlexibilityResults({ flexibilityResults, marketSignals, onBack, onContinue }: FlexibilityResultsProps) {
  const topFlex = [...flexibilityResults].sort((a, b) => b.flexibilityIndex - a.flexibilityIndex).slice(0, 3)
  const lowFlex = [...flexibilityResults].sort((a, b) => a.flexibilityIndex - b.flexibilityIndex).slice(0, 3)

  return (
     <section className="panel">
       <div className="panel-header">
         <div>
           <h2>Step 3 - Market Insights & Savings Opportunities</h2>
           <p className="muted">Discover the best times to use electricity and potential savings through flexible consumption.</p>
         </div>
       </div>

       <div className="metrics-grid four">
         <MetricCard label="Best time to use electricity" value={`${String(topFlex[0]?.hour ?? 0).padStart(2, "0")}:00`} hint={topFlex[0]?.flexibilityLevel} />
         <MetricCard label="Savings potential" value={topFlex[0]?.flexibilityIndex.toFixed(2) ?? "-"} />
         <MetricCard label="Market price (avg)" value={`EUR ${(marketSignals.reduce((sum, row) => sum + row.damPrice, 0) / (marketSignals.length || 1)).toFixed(3)}`} />
         <MetricCard label="Price variation" value={`EUR ${(marketSignals.reduce((sum, row) => sum + row.spread, 0) / (marketSignals.length || 1)).toFixed(3)}`} />
       </div>

       <div className="chart-card">
         <div className="section-title">Best hours for flexible usage</div>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={flexibilityResults}>
            <defs>
              <linearGradient id="flexLine" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.8} />
                <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.1} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="#e2e8f0" />
            <XAxis dataKey="hour" stroke="#64748b" />
            <YAxis stroke="#64748b" domain={[0, 1]} />
            <Tooltip formatter={(value: number) => value.toFixed(2)} />
            <Area type="monotone" dataKey="flexibilityIndex" stroke="#9f7aea" fillOpacity={1} fill="url(#flexLine)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="chart-two-col">
        <div className="table-card compact">
          <div className="section-title">Top 3 flexible hours</div>
          <div className="mini-list">
            {topFlex.map((row) => (
              <div key={row.hour} className="mini-row">
                <strong>{String(row.hour).padStart(2, "0")}:00</strong>
                <span>{row.flexibilityLevel}</span>
                <span>{row.flexibilityIndex.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="table-card compact">
          <div className="section-title">Bottom 3 flexible hours</div>
          <div className="mini-list">
            {lowFlex.map((row) => (
              <div key={row.hour} className="mini-row">
                <strong>{String(row.hour).padStart(2, "0")}:00</strong>
                <span>{row.flexibilityLevel}</span>
                <span>{row.flexibilityIndex.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="chart-card">
        <div className="section-title">Market signal summary</div>
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={marketSignals}>
            <CartesianGrid vertical={false} stroke="#e2e8f0" />
            <XAxis dataKey="hour" stroke="#64748b" />
            <YAxis stroke="#64748b" />
            <Tooltip formatter={(value: number) => `EUR ${value.toFixed(3)}`} />
            <Line type="monotone" dataKey="damPrice" stroke="#57d5ff" strokeWidth={3} dot={false} />
            <Line type="monotone" dataKey="settlementPrice" stroke="#8b5cf6" strokeWidth={3} dot={false} />
            <Line type="monotone" dataKey="spread" stroke="#ff7d61" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="button-row">
        <button className="ghost-btn" onClick={onBack}>Back</button>
        <button className="primary-btn" onClick={onContinue}>View recommendation</button>
      </div>
    </section>
  )
}

