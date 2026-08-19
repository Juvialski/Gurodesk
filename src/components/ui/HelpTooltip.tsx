import { Info } from 'lucide-react'
import { useEffect, useId, useRef, useState, type ReactNode } from 'react'

export interface HelpTooltipProps {
  content: ReactNode
  label?: string
  id?: string
  className?: string
  iconSize?: number
  align?: 'left' | 'right' | 'center'
}

/**
 * Compact, accessible information/help tooltip and popover.
 * - Desktop: Opens on hover and keyboard focus.
 * - Touch (Mobile/Tablet): Toggles on tap.
 * - Accessible: Button with aria-label, aria-expanded, aria-describedby, role="tooltip", and Escape/outside dismissal.
 */
export function HelpTooltip({
  content,
  label = 'More information',
  id: customId,
  className = '',
  iconSize = 13.5,
  align = 'left',
}: HelpTooltipProps) {
  const generatedId = useId()
  const tooltipId = customId || `help-tooltip-${generatedId.replace(/:/g, '')}`
  const [isToggled, setIsToggled] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  const [isFocused, setIsFocused] = useState(false)
  const containerRef = useRef<HTMLSpanElement>(null)

  const isOpen = isToggled || isHovered || isFocused

  useEffect(() => {
    if (!isToggled) return

    const handlePointerDown = (event: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsToggled(false)
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsToggled(false)
        setIsHovered(false)
        setIsFocused(false)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isToggled])

  const handleTriggerKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'Escape' && isOpen) {
      setIsToggled(false)
      setIsHovered(false)
      setIsFocused(false)
      event.stopPropagation()
      event.preventDefault()
    }
  }

  return (
    <span
      className={`help-tooltip-container align-${align} ${className}`.trim()}
      ref={containerRef}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <button
        type="button"
        className={`help-tooltip-trigger ${isOpen ? 'active' : ''}`}
        aria-label={label}
        aria-expanded={isOpen}
        aria-describedby={tooltipId}
        onClick={() => setIsToggled((prev) => !prev)}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        onKeyDown={handleTriggerKeyDown}
      >
        <Info size={iconSize} aria-hidden="true" />
      </button>
      <div
        id={tooltipId}
        role="tooltip"
        aria-hidden={!isOpen}
        className={`help-tooltip-bubble ${isOpen ? 'is-open' : ''}`}
      >
        {content}
      </div>
    </span>
  )
}
