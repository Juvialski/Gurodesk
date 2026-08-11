import type { HTMLAttributes } from 'react'

export type WorkspaceViewMode = 'simple' | 'advanced'

export type SimpleAdvancedToggleProps = Omit<HTMLAttributes<HTMLDivElement>, 'onChange'> & {
  mode: WorkspaceViewMode
  onChange: (mode: WorkspaceViewMode) => void
}

/** A small, keyboard-friendly disclosure control shared by guided workflows. */
export function SimpleAdvancedToggle({ mode, onChange, className = '', ...props }: SimpleAdvancedToggleProps) {
  return (
    <div className={`simple-advanced-toggle ${className}`.trim()} role="group" aria-label="Editing mode" {...props}>
      <button
        type="button"
        className={mode === 'simple' ? 'active' : ''}
        aria-pressed={mode === 'simple'}
        onClick={() => onChange('simple')}
      >
        Simple
      </button>
      <button
        type="button"
        className={mode === 'advanced' ? 'active' : ''}
        aria-pressed={mode === 'advanced'}
        onClick={() => onChange('advanced')}
      >
        Customize
      </button>
    </div>
  )
}

