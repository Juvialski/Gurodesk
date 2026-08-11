import type { ReactNode } from 'react'

export type TaskProgressProps = {
  current: number
  total: number
  label?: string
  detail?: ReactNode
  className?: string
}

export function TaskProgress({ current, total, label = 'Progress', detail, className = '' }: TaskProgressProps) {
  const safeTotal = Math.max(0, total)
  const safeCurrent = Math.max(0, Math.min(current, safeTotal || current))
  const percentage = safeTotal > 0 ? Math.round((safeCurrent / safeTotal) * 100) : 0

  return (
    <div className={`task-progress ${className}`.trim()}>
      <div className="task-progress-heading">
        <span>{label}</span>
        <strong>{safeTotal > 0 ? `${safeCurrent} of ${safeTotal}` : `${safeCurrent}`}</strong>
      </div>
      <div className="task-progress-track" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={safeTotal || 1} aria-valuenow={safeTotal > 0 ? safeCurrent : 0}>
        <span style={{ width: `${percentage}%` }} />
      </div>
      {detail && <div className="task-progress-detail">{detail}</div>}
    </div>
  )
}

