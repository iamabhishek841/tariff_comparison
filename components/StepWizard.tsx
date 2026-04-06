import { HouseholdForm, HouseholdInputs } from "@/components/HouseholdForm"
import { FlexibilityResults } from "@/components/FlexibilityResults"
import { RecommendationCard } from "@/components/RecommendationCard"
import { StepPill } from "@/components/StepPill"
import { TariffResults } from "@/components/TariffResults"
import { AnalysisOptions, AnalysisResponse } from "@/lib/types"

interface StepWizardProps {
  step: number
  options: AnalysisOptions
  inputs: HouseholdInputs
  running: boolean
  submitted: HouseholdInputs | null
  result: AnalysisResponse | null
  onChangeInputs: (next: HouseholdInputs) => void
  onRunAnalysis: () => void
  onStepChange: (step: number) => void
}

export function StepWizard({
  step,
  options,
  inputs,
  running,
  submitted,
  result,
  onChangeInputs,
  onRunAnalysis,
  onStepChange,
}: StepWizardProps) {
  const topFlex = result
    ? [...result.flexibilityResults].sort((a, b) => b.flexibilityIndex - a.flexibilityIndex)[0]
    : undefined

  return (
    <>
      <section className="stepper-row">
        <StepPill number={1} title="Household Setup" active={step === 1} done={step > 1} onClick={() => onStepChange(1)} />
        <StepPill number={2} title="Plan Comparison" active={step === 2} done={step > 2} onClick={() => submitted && onStepChange(2)} />
        <StepPill number={3} title="Usage Insights" active={step === 3} done={step > 3} onClick={() => submitted && onStepChange(3)} />
        <StepPill number={4} title="Recommendation" active={step === 4} done={false} onClick={() => submitted && onStepChange(4)} />
      </section>

      {step === 1 ? (
        <HouseholdForm
          inputs={inputs}
          options={options}
          running={running}
          onChange={onChangeInputs}
          onRunAnalysis={onRunAnalysis}
        />
      ) : null}

      {step === 2 && submitted && result ? (
        <TariffResults
          submitted={submitted}
          profile={result.profile}
          tariffResults={result.tariffResults}
          onBack={() => onStepChange(1)}
          onContinue={() => onStepChange(3)}
          onEditInputs={() => onStepChange(1)}
        />
      ) : null}

      {step === 3 && result ? (
        <FlexibilityResults
          flexibilityResults={result.flexibilityResults}
          marketSignals={result.marketSignals}
          onBack={() => onStepChange(2)}
          onContinue={() => onStepChange(4)}
        />
      ) : null}

      {step === 4 && submitted && result && result.tariffResults[0] ? (
        <RecommendationCard
          submitted={submitted}
          cheapestPlan={result.tariffResults[0]}
          topFlex={topFlex}
          recommendation={result.recommendation}
          onStartOver={() => onStepChange(1)}
          onReviewTariffs={() => onStepChange(2)}
        />
      ) : null}
    </>
  )
}

