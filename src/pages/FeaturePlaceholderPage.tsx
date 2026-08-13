import type { LucideIcon } from 'lucide-react'
import { EmptyState } from '../components/EmptyState'
import { PageHeader } from '../components/PageHeader'

export function FeaturePlaceholderPage({
  eyebrow,
  title,
  description,
  icon,
  bullets,
}: {
  eyebrow: string
  title: string
  description: string
  phase?: string
  icon: LucideIcon
  bullets: string[]
}) {
  return (
    <>
      <PageHeader eyebrow={eyebrow} title={title} description={description} />
      <EmptyState
        icon={icon}
        title={`${title} is not available yet`}
        description="This workspace is reserved for a future update. Current teaching workflows remain available from the main navigation."
      >
        <div className="placeholder-list">{bullets.map((bullet) => <span key={bullet}>✓ {bullet}</span>)}</div>
      </EmptyState>
    </>
  )
}
