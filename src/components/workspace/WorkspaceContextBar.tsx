import { ChevronDown, Layers3, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { TeacherAssignment } from '../../types/app'
import type { WorkspaceSelection } from '../../hooks/useWorkspaceSelection'
import { WorkspaceContextPicker, type WorkspaceOption } from './WorkspaceContextPicker'

export type WorkspaceContextBarProps = {
  assignments: TeacherAssignment[]
  selection: WorkspaceSelection
  onChange: (selection: WorkspaceSelection) => void
  gradingTerms?: WorkspaceOption[]
  curriculumPeriods?: WorkspaceOption[]
  className?: string
}

function selectedAssignment(assignments: TeacherAssignment[], assignmentId: string | null) {
  return assignments.find((assignment) => assignment.id === assignmentId && assignment.isActive) ?? null
}

export function WorkspaceContextBar({
  assignments,
  selection,
  onChange,
  gradingTerms,
  curriculumPeriods,
  className = '',
}: WorkspaceContextBarProps) {
  const [open, setOpen] = useState(false)
  const [modal, setModal] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const assignment = selectedAssignment(assignments, selection.assignmentId)
  const validSection = assignment?.sections.includes(selection.section ?? '') ? selection.section : null
  const validTerm = gradingTerms?.find((option) => option.id === selection.gradingTermId)
  const validPeriod = curriculumPeriods?.find((option) => option.id === selection.curriculumPeriodId)
  const contextTitle = assignment ? `${assignment.gradeLevel} ${assignment.learningArea}` : 'Choose a class context'
  const detail = [validSection ?? 'Section not selected', validTerm?.label, validPeriod?.label].filter(Boolean).join(' · ')

  useEffect(() => {
    if (!open) return
    const popover = popoverRef.current
    const isModal = window.matchMedia('(max-width: 780px)').matches
    const originalOverflow = document.body.style.overflow
    setModal(isModal)
    if (isModal) document.body.style.overflow = 'hidden'

    const frame = window.requestAnimationFrame(() => {
      popover?.querySelector<HTMLElement>('select, button')?.focus()
    })

    function handleDialogKeys(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        setOpen(false)
        return
      }
      if (!isModal || event.key !== 'Tab' || !popover) return
      const focusable = Array.from(popover.querySelectorAll<HTMLElement>('select:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])'))
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && (document.activeElement === first || !popover.contains(document.activeElement))) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleDialogKeys)
    return () => {
      window.cancelAnimationFrame(frame)
      document.removeEventListener('keydown', handleDialogKeys)
      if (isModal) document.body.style.overflow = originalOverflow
      triggerRef.current?.focus()
    }
  }, [open])

  return (
    <div className={`workspace-context-shell ${open ? 'context-open' : ''} ${className}`.trim()}>
      <div className="workspace-context-bar">
        <span className="workspace-context-icon"><Layers3 size={18} aria-hidden="true" /></span>
        <div className="workspace-context-copy">
          <span className="eyebrow">Working context</span>
          <strong>{contextTitle}</strong>
          <span>{assignment ? `${detail} · SY ${assignment.schoolYear}` : 'Choose a class when a workflow needs one.'}</span>
        </div>
        <button ref={triggerRef} className="workspace-context-change" type="button" onClick={() => setOpen((current) => !current)} aria-expanded={open} aria-controls="workspace-context-picker" aria-haspopup="dialog">
          {open ? 'Close' : 'Change'} <ChevronDown size={16} aria-hidden="true" className={open ? 'rotated' : ''} />
        </button>
        {open && <button className="workspace-context-dismiss" type="button" onClick={() => setOpen(false)} aria-label="Close workspace context picker"><X size={16} /></button>}
      </div>
      {open && (
        <>
        <div className="workspace-context-backdrop" aria-hidden="true" onClick={() => setOpen(false)} />
        <div id="workspace-context-picker" className="workspace-context-popover" ref={popoverRef}>
          <WorkspaceContextPicker
            assignments={assignments}
            selection={selection}
            onChange={onChange}
            onClose={() => setOpen(false)}
            gradingTerms={gradingTerms}
            curriculumPeriods={curriculumPeriods}
            modal={modal}
          />
        </div>
        </>
      )}
    </div>
  )
}
