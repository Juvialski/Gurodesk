import type { ReactNode } from 'react'

export function ResultMetric({ label, value, hint, tone = 'blue', icon }: {
  label: string
  value: ReactNode
  hint?: string
  tone?: 'blue' | 'green' | 'amber' | 'slate'
  icon?: ReactNode
}) {
  return <div className={`results-metric results-metric-${tone}`}>
    {icon && <span className="results-metric-icon" aria-hidden="true">{icon}</span>}
    <div><small>{label}</small><strong>{value}</strong>{hint && <span>{hint}</span>}</div>
  </div>
}

