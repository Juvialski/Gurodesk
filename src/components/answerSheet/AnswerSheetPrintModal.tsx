import { Check, CheckCircle2, Copy, FileText, Info, Printer, QrCode, Sparkles, Users, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../../contexts/AppContext'
import { calculateAnswerSheetCompatibility } from '../../lib/answerSheet/compatibility'
import { loadClassLearners } from '../../lib/resultsRepository'
import type { AssessmentRecord } from '../../types/assessment'
import type { AnswerSheetMode, AnswerSheetPaperSize } from '../../types/answerSheet'
import type { ClassLearner } from '../../types/results'

export type AnswerSheetPrintModalProps = {
  assessment: AssessmentRecord
  isOpen: boolean
  onClose: () => void
}

export function AnswerSheetPrintModal({ assessment, isOpen, onClose }: AnswerSheetPrintModalProps) {
  const { user, assignments, isDemo } = useApp()
  const navigate = useNavigate()

  const [mode, setMode] = useState<AnswerSheetMode>('generic')
  const [paperSize, setPaperSize] = useState<AnswerSheetPaperSize>('a4')
  const [sectionName, setSectionName] = useState('')
  const [learners, setLearners] = useState<ClassLearner[]>([])
  const [selectedLearnerIds, setSelectedLearnerIds] = useState<string[]>([])
  const [loadingRoster, setLoadingRoster] = useState(false)
  const [copies, setCopies] = useState<number>(30)

  const compatibility = useMemo(() => calculateAnswerSheetCompatibility(assessment), [assessment])

  const assignedAssignment = useMemo(() => {
    if (!assessment.assignmentId) return null
    return assignments.find((a) => a.id === assessment.assignmentId) ?? null
  }, [assessment.assignmentId, assignments])

  const availableSections = useMemo(() => assignedAssignment?.sections ?? [], [assignedAssignment])

  useEffect(() => {
    if (availableSections.length > 0 && !availableSections.includes(sectionName)) {
      setSectionName(availableSections[0])
    }
  }, [availableSections, sectionName])

  useEffect(() => {
    if (!user || !assessment.assignmentId || !sectionName || mode !== 'personalized') {
      setLearners([])
      setSelectedLearnerIds([])
      return
    }

    let active = true
    setLoadingRoster(true)
    loadClassLearners(user.id, assessment.assignmentId, sectionName, isDemo)
      .then((roster) => {
        if (!active) return
        const activeLearners = roster.filter((l) => l.status === 'active')
        setLearners(activeLearners)
        setSelectedLearnerIds(activeLearners.map((l) => l.id))
      })
      .catch((err) => {
        console.error('Failed to load roster for answer sheets:', err)
      })
      .finally(() => {
        if (active) setLoadingRoster(false)
      })

    return () => {
      active = false
    }
  }, [user?.id, assessment.assignmentId, sectionName, mode, isDemo])

  if (!isOpen) return null

  function handleSelectAll() {
    if (selectedLearnerIds.length === learners.length) {
      setSelectedLearnerIds([])
    } else {
      setSelectedLearnerIds(learners.map((l) => l.id))
    }
  }

  function handleToggleLearner(id: string) {
    setSelectedLearnerIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    )
  }

  function handleProceedToPrint() {
    const params = new URLSearchParams()
    params.set('mode', mode)
    params.set('paperSize', paperSize)
    if (mode === 'personalized') {
      if (sectionName) params.set('section', sectionName)
      if (selectedLearnerIds.length > 0) params.set('learners', selectedLearnerIds.join(','))
    } else {
      params.set('copies', String(Math.max(1, copies)))
    }
    navigate(`/assessments/${assessment.id}/answer-sheet?${params.toString()}`)
  }

  return (
    <div className="modal-backdrop answer-sheet-print-modal-backdrop" onClick={onClose}>
      <div className="modal-content answer-sheet-print-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-group">
            <QrCode className="modal-icon" size={24} />
            <div>
              <h3>Print Smart Answer Sheets</h3>
              <p>{assessment.title} · Version {assessment.versionNumber || 1}</p>
            </div>
          </div>
          <button type="button" className="button ghost icon-only modal-close-btn" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          {/* Compatibility Summary Banner */}
          <div className={`compatibility-badge-card ${compatibility.isFullyMachineCheckable ? 'scan-ready' : 'is-mixed'}`}>
            {compatibility.isFullyMachineCheckable ? (
              <CheckCircle2 className="compatibility-icon auto" size={20} />
            ) : (
              <Info className="compatibility-icon manual" size={20} />
            )}
            <div className="compatibility-details">
              <strong>
                {compatibility.isFullyMachineCheckable
                  ? '100% Machine Scannable'
                  : `Scan-Ready: ${compatibility.machineCheckableCount} of ${compatibility.totalQuestions} items auto-checkable (${compatibility.machineCheckablePercentage}%)`}
              </strong>
              <div className="compatibility-pill-list">
                {compatibility.typesBreakdown.map((t) => (
                  <span
                    key={t.questionType}
                    className={`compatibility-pill ${t.isMachineCheckable ? 'auto' : 'manual'}`}
                  >
                    {t.count} {t.label} ({t.isMachineCheckable ? 'Automatic' : 'Manual'})
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Mode Selection */}
          <div className="modal-section">
            <label className="modal-section-label">Select Sheet Format</label>
            <div className="choice-card-grid">
              <button
                type="button"
                className={`choice-card ${mode === 'generic' ? 'selected' : ''}`}
                onClick={() => setMode('generic')}
              >
                <div className="choice-card-top">
                  <FileText size={18} className={mode === 'generic' ? 'text-primary' : 'text-slate'} />
                  {mode === 'generic' && <Check size={16} className="choice-check" />}
                </div>
                <strong>Generic Sheets</strong>
                <p>Blank student name line. Teacher matches learner when scanning.</p>
              </button>

              <button
                type="button"
                className={`choice-card ${mode === 'personalized' ? 'selected' : ''}`}
                onClick={() => setMode('personalized')}
              >
                <div className="choice-card-top">
                  <Users size={18} className={mode === 'personalized' ? 'text-primary' : 'text-slate'} />
                  {mode === 'personalized' && <Check size={16} className="choice-check" />}
                </div>
                <strong>Personalized Roster</strong>
                <p>Pre-printed student names with individual opaque QR codes.</p>
              </button>
            </div>
          </div>

          {/* Paper Size */}
          <div className="modal-form-row">
            <label>Paper Size:</label>
            <select
              className="select-input"
              value={paperSize}
              onChange={(e) => setPaperSize(e.target.value as AnswerSheetPaperSize)}
            >
              <option value="a4">A4 (210 × 297 mm)</option>
              <option value="letter">Letter (8.5 × 11 in)</option>
              <option value="legal">Legal (8.5 × 14 in)</option>
              <option value="folio">Folio / Long (8.5 × 13 in)</option>
            </select>
          </div>

          {/* Personalized Roster Controls */}
          {mode === 'personalized' ? (
            <div className="personalized-section">
              <div className="roster-section-head">
                <label>Class Section:</label>
                {availableSections.length > 1 ? (
                  <select
                    className="select-input"
                    value={sectionName}
                    onChange={(e) => setSectionName(e.target.value)}
                  >
                    {availableSections.map((sec) => (
                      <option key={sec} value={sec}>
                        {sec}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span>{sectionName || 'All Students'}</span>
                )}
              </div>

              {loadingRoster ? (
                <div className="roster-loading-state">Loading class roster…</div>
              ) : learners.length === 0 ? (
                <div className="roster-empty-state">
                  No active students found in this section. Add students in Classes &amp; Rosters.
                </div>
              ) : (
                <div className="roster-list-container">
                  <div className="roster-list-header">
                    <span>
                      Students ({selectedLearnerIds.length} of {learners.length} selected)
                    </span>
                    <button
                      type="button"
                      className="button ghost small"
                      onClick={handleSelectAll}
                    >
                      {selectedLearnerIds.length === learners.length ? 'Deselect All' : 'Select All'}
                    </button>
                  </div>
                  <div className="roster-picker-list">
                    {learners.map((learner) => {
                      const isChecked = selectedLearnerIds.includes(learner.id)
                      return (
                        <label
                          key={learner.id}
                          className="roster-picker-item"
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleToggleLearner(learner.id)}
                          />
                          <span>{learner.displayName}</span>
                          {learner.localReference && (
                            <small>({learner.localReference})</small>
                          )}
                        </label>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="generic-copies-row">
              <label>Number of generic copies to print:</label>
              <input
                type="number"
                min="1"
                max="200"
                className="input-number"
                value={copies}
                onChange={(e) => setCopies(Math.max(1, Number(e.target.value) || 1))}
              />
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button type="button" className="button ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="button primary"
            disabled={mode === 'personalized' && selectedLearnerIds.length === 0}
            onClick={handleProceedToPrint}
          >
            <Printer size={16} />
            {mode === 'personalized'
              ? `Print ${selectedLearnerIds.length} Student Sheets`
              : `Print ${copies} Answer Sheets`}
          </button>
        </div>
      </div>
    </div>
  )
}
