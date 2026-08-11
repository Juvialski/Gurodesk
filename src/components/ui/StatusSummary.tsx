import type { ReactNode } from 'react'

export type StatusTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger'

export function StatusSummary({
  label,
  detail,
  tone = 'neutral',
  icon,
  className = '',
}: {
  label: string
  detail?: ReactNode
  tone?: StatusTone
  icon?: ReactNode
  className?: string
}) {
  return (
    <div className={`status-summary ${tone} ${className}`.trim()} role="status">
      {icon && <span className="status-summary-icon" aria-hidden="true">{icon}</span>}
      <span className="status-summary-copy"><strong>{label}</strong>{detail && <span>{detail}</span>}</span>
    </div>
  )
}

