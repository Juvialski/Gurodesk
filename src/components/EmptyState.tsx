import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

export function EmptyState({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: LucideIcon
  title: string
  description: string
  children?: ReactNode
}) {
  return (
    <div className="empty-state panel">
      <span className="empty-icon"><Icon size={26} /></span>
      <h3>{title}</h3>
      <p>{description}</p>
      {children}
    </div>
  )
}
