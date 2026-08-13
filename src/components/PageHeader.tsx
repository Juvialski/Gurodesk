import type { ReactNode } from 'react'

export function normalizePageEyebrow(eyebrow?: string) {
  if (!eyebrow) return undefined
  if (/^Assessment Generation V2$/iu.test(eyebrow.trim())) return 'Assessment studio'

  const cleaned = eyebrow
    .split('·')
    .map((part) => part.trim())
    .filter((part) => part && !/^Phase\s+\d+(?:\.\d+)*(?:\+)?$/iu.test(part))
    .join(' · ')
    .trim()

  return cleaned || undefined
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string
  title: string
  description?: string
  actions?: ReactNode
}) {
  const displayEyebrow = normalizePageEyebrow(eyebrow)

  return (
    <header className="page-header">
      <div>
        {displayEyebrow && <span className="eyebrow">{displayEyebrow}</span>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  )
}
