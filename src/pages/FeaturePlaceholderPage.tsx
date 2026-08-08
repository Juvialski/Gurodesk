import type { LucideIcon } from 'lucide-react'
import { EmptyState } from '../components/EmptyState'
import { PageHeader } from '../components/PageHeader'

export function FeaturePlaceholderPage({
  eyebrow,
  title,
  description,
  phase,
  icon,
  bullets,
}: {
  eyebrow: string
  title: string
  description: string
  phase: string
  icon: LucideIcon
  bullets: string[]
}) {
  return (
    <>
      <PageHeader eyebrow={eyebrow} title={title} description={description} />
      <EmptyState icon={icon} title={`${title} is scheduled for ${phase}`} description="The navigation and data architecture are reserved now so later phases can add the feature without restructuring the app.">
        <div className="placeholder-list">{bullets.map((bullet) => <span key={bullet}>✓ {bullet}</span>)}</div>
      </EmptyState>
    </>
  )
}
