import { BookOpenCheck } from 'lucide-react'

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="brand">
      <span className="brand-mark"><BookOpenCheck size={compact ? 20 : 24} /></span>
      <span className="brand-copy">
        <strong>GuroDesk</strong>
        {!compact && <small>DepEd teacher workspace</small>}
      </span>
    </div>
  )
}
