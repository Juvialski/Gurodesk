import { Check, ChevronDown, RotateCcw } from 'lucide-react'
import type { TeacherAssignment } from '../../types/app'
import {
  DEFAULT_WORKSPACE_SELECTION,
  type WorkspaceSelection,
} from '../../hooks/useWorkspaceSelection'

export type WorkspaceOption = {
  id: string
  label: string
}

export type WorkspaceContextPickerProps = {
  assignments: TeacherAssignment[]
  selection: WorkspaceSelection
  onChange: (selection: WorkspaceSelection) => void
  onClose?: () => void
  gradingTerms?: WorkspaceOption[]
  curriculumPeriods?: WorkspaceOption[]
  className?: string
  modal?: boolean
}

function optionLabel(options: WorkspaceOption[], id: string | null) {
  return options.find((option) => option.id === id)?.label ?? id ?? ''
}

/**
 * A deliberately explicit context picker. It can remember a class and section
 * but never chooses a competency or maps a grading term to a curriculum
 * period on the teacher's behalf.
 */
export function WorkspaceContextPicker({
  assignments,
  selection,
  onChange,
  onClose,
  gradingTerms,
  curriculumPeriods,
  className = '',
  modal = false,
}: WorkspaceContextPickerProps) {
  const activeAssignments = assignments.filter((assignment) => assignment.isActive)
  const selectedAssignment = activeAssignments.find((assignment) => assignment.id === selection.assignmentId) ?? null
  const selectedAssignmentId = selectedAssignment?.id ?? ''
  const sections = selectedAssignment?.sections ?? []
  const selectedSection = selection.section && sections.includes(selection.section) ? selection.section : null
  const hasGradingTerms = Boolean(gradingTerms?.length)
  const hasCurriculumPeriods = Boolean(curriculumPeriods?.length)

  function changeAssignment(assignmentId: string) {
    onChange({
      ...selection,
      assignmentId: assignmentId || null,
      section: null,
    })
  }

  function changeSection(section: string) {
    onChange({ ...selection, section: section || null })
  }

  function changeTerm(gradingTermId: string) {
    onChange({ ...selection, gradingTermId: gradingTermId || null })
  }

  function changePeriod(curriculumPeriodId: string) {
    onChange({ ...selection, curriculumPeriodId: curriculumPeriodId || null })
  }

  return (
    <div className={`workspace-context-picker ${className}`.trim()} role="dialog" aria-modal={modal || undefined} aria-labelledby="workspace-context-title">
      <div className="workspace-picker-heading">
        <div>
          <span className="eyebrow">Workspace context</span>
          <h2 id="workspace-context-title">Choose where you are working</h2>
          <p>This helps prefill related forms. Competencies and period mappings always remain your choice.</p>
        </div>
        {onClose && <button className="icon-button" type="button" onClick={onClose} aria-label="Close context picker">×</button>}
      </div>

      <div className="workspace-picker-grid">
        <label>
          Class or assignment
          <span className="workspace-picker-control">
            <select value={selectedAssignmentId} onChange={(event) => changeAssignment(event.target.value)}>
              <option value="">Choose an assignment</option>
              {activeAssignments.map((assignment) => <option key={assignment.id} value={assignment.id}>{assignment.gradeLevel} · {assignment.learningArea}</option>)}
            </select>
            <ChevronDown size={16} aria-hidden="true" />
          </span>
        </label>

        <label>
          Section <span className="field-optional">(optional)</span>
          <span className="workspace-picker-control">
            <select value={selectedSection ?? ''} onChange={(event) => changeSection(event.target.value)} disabled={!selectedAssignment}>
              <option value="">Choose a section</option>
              {sections.map((section) => <option key={section} value={section}>{section}</option>)}
            </select>
            <ChevronDown size={16} aria-hidden="true" />
          </span>
        </label>

        {hasGradingTerms && <label>
          Grading term <span className="field-optional">(optional)</span>
          <span className="workspace-picker-control">
            <select value={gradingTerms?.some((option) => option.id === selection.gradingTermId) ? selection.gradingTermId ?? '' : ''} onChange={(event) => changeTerm(event.target.value)}>
              <option value="">Choose a grading term</option>
              {gradingTerms?.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
            </select>
            <ChevronDown size={16} aria-hidden="true" />
          </span>
        </label>}

        {hasCurriculumPeriods && <label>
          Curriculum period <span className="field-optional">(optional)</span>
          <span className="workspace-picker-control">
            <select value={curriculumPeriods?.some((option) => option.id === selection.curriculumPeriodId) ? selection.curriculumPeriodId ?? '' : ''} onChange={(event) => changePeriod(event.target.value)}>
              <option value="">Choose a curriculum period</option>
              {curriculumPeriods?.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
            </select>
            <ChevronDown size={16} aria-hidden="true" />
          </span>
        </label>}
      </div>

      <div className="workspace-picker-footer">
        <span><Check size={15} aria-hidden="true" /> Saved on this device</span>
        <button className="button ghost" type="button" onClick={() => onChange(DEFAULT_WORKSPACE_SELECTION)}><RotateCcw size={15} /> Clear choices</button>
      </div>
    </div>
  )
}

export function getWorkspaceOptionLabel(options: WorkspaceOption[], id: string | null) {
  return optionLabel(options, id)
}
