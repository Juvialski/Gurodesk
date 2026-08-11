import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

export type ActionCardProps = {
  title: string
  description: string
  icon: LucideIcon
  to?: string
  onClick?: () => void
  actionLabel?: string
  tone?: 'blue' | 'green' | 'amber' | 'slate'
  className?: string
  children?: ReactNode
}

export function ActionCard({
  title,
  description,
  icon: Icon,
  to,
  onClick,
  actionLabel = 'Open',
  tone = 'blue',
  className = '',
  children,
}: ActionCardProps) {
  const content = (
    <>
      <span className={`action-card-icon ${tone}`}><Icon size={23} aria-hidden="true" /></span>
      <span className="action-card-copy">
        <strong>{title}</strong>
        <span>{description}</span>
        {children}
      </span>
      <span className="action-card-link">{actionLabel} <span aria-hidden="true">→</span></span>
    </>
  )

  if (to) {
    return <Link className={`action-card ${className}`.trim()} to={to}>{content}</Link>
  }

  return <button type="button" className={`action-card ${className}`.trim()} onClick={onClick}>{content}</button>
}

