import type { ReactNode } from 'react'

export function TechnicalDetails({
  children,
  summary = 'Technical details',
  className = '',
}: {
  children: ReactNode
  summary?: string
  className?: string
}) {
  return (
    <details className={`technical-details ${className}`.trim()}>
      <summary>{summary}</summary>
      <div className="technical-details-body">{children}</div>
    </details>
  )
}

