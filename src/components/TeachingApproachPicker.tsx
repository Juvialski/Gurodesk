import { Plus, X } from 'lucide-react'
import { useId, useState } from 'react'
import { APPROACH_OPTIONS } from '../types/teachingSetup'

type Props = {
  value: string[]
  onChange: (approaches: string[]) => void
  disabled?: boolean
  label?: string
  helpText?: string
}

function normalizeKey(text: string) {
  return text.trim().toLowerCase().replace(/\s+/g, ' ')
}

export function TeachingApproachPicker({
  value = [],
  onChange,
  disabled = false,
  label = 'Teaching approaches',
  helpText,
}: Props) {
  const [customInput, setCustomInput] = useState('')
  const inputId = useId()

  const canonicalSet = new Set<string>(APPROACH_OPTIONS)
  const currentSet = new Set(value)

  // Separate custom approaches that are currently selected or in historical data
  const customItems = value.filter((item) => !canonicalSet.has(item as typeof APPROACH_OPTIONS[number]))

  function toggleApproach(approach: string) {
    if (disabled) return
    if (currentSet.has(approach)) {
      onChange(value.filter((item) => item !== approach))
    } else {
      onChange([...value, approach])
    }
  }

  function addCustom() {
    const trimmed = customInput.trim().replace(/\s+/g, ' ')
    if (!trimmed || disabled) return

    const exists = value.some((item) => normalizeKey(item) === normalizeKey(trimmed))
    if (!exists) {
      onChange([...value, trimmed])
    }
    setCustomInput('')
  }

  function removeCustom(itemToRemove: string) {
    if (disabled) return
    onChange(value.filter((item) => item !== itemToRemove))
  }

  return (
    <div className="teaching-approach-picker">
      {label && <span className="workflow-field-label">{label}</span>}
      {helpText && <small className="field-help">{helpText}</small>}

      <div className="approach-chips-container" role="group" aria-label={label}>
        {APPROACH_OPTIONS.map((option) => {
          const isSelected = currentSet.has(option)
          return (
            <button
              key={option}
              type="button"
              disabled={disabled}
              aria-pressed={isSelected}
              className={`workflow-chip approach-chip ${isSelected ? 'selected' : ''}`}
              onClick={() => toggleApproach(option)}
            >
              {option}
            </button>
          )
        })}

        {customItems.map((custom) => (
          <span key={custom} className="workflow-chip approach-chip custom selected">
            <span>{custom}</span>
            <button
              type="button"
              disabled={disabled}
              className="custom-approach-remove"
              aria-label={`Remove custom approach ${custom}`}
              onClick={() => removeCustom(custom)}
            >
              <X size={13} />
            </button>
          </span>
        ))}
      </div>

      <div className="custom-approach-add-row">
        <input
          id={inputId}
          type="text"
          value={customInput}
          disabled={disabled}
          placeholder="Add custom approach (e.g., Station Rotation, Flipped Classroom)"
          onChange={(e) => setCustomInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              addCustom()
            }
          }}
          className="custom-approach-input"
        />
        <button
          type="button"
          disabled={disabled || !customInput.trim()}
          className="button secondary custom-approach-button"
          onClick={addCustom}
        >
          <Plus size={15} /> Add
        </button>
      </div>
    </div>
  )
}
