interface StepPillProps {
  number: number
  title: string
  active: boolean
  done: boolean
  onClick: () => void
}

export function StepPill({ number, title, active, done, onClick }: StepPillProps) {
  return (
    <button
      className={`step-pill ${active ? "active" : ""} ${done ? "done" : ""}`}
      onClick={onClick}
      type="button"
    >
      <span className="step-pill__dot">{done ? "✓" : number}</span>
      <span>{title}</span>
    </button>
  )
}
