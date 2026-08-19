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
            <QrCode className="modal-icon text-primary" size={24} />
            <div>
              <h3>Print Smart Answer Sheets</h3>
              <p className="text-muted text-sm">{assessment.title} · Version {assessment.versionNumber || 1}</p>
            </div>
          </div>
          <button type="button" className="button ghost icon-only" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <div className="modal-body space-y-4">
          {/* Compatibility Summary Banner */}
          <div className={`compatibility-badge-card ${compatibility.isScanReady ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'} p-3 rounded-lg border flex items-start gap-3`}>
            {compatibility.isFullyMachineCheckable ? (
              <CheckCircle2 className="text-emerald-600 shrink-0 mt-0.5" size={18} />
            ) : (
              <Info className="text-amber-600 shrink-0 mt-0.5" size={18} />
            )}
            <div className="text-sm">
              <strong className="block text-slate-800">
                {compatibility.isFullyMachineCheckable
                  ? '100% Machine Scannable'
                  : `Scan-Ready: ${compatibility.machineCheckableCount} of ${compatibility.totalQuestions} items auto-checkable (${compatibility.machineCheckablePercentage}%)`}
              </strong>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {compatibility.typesBreakdown.map((t) => (
                  <span
                    key={t.questionType}
                    className={`inline-flex items-center text-xs px-2 py-0.5 rounded-full font-medium ${
                      t.isMachineCheckable ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {t.count} {t.label} ({t.isMachineCheckable ? 'Automatic' : 'Manual'})
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Mode Selection */}
          <div className="form-group">
            <label className="form-label font-semibold">Select Sheet Format</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                className={`choice-card p-3 rounded-lg border text-left transition-all ${
                  mode === 'generic' ? 'border-primary bg-primary/5 ring-2 ring-primary/20' : 'border-slate-200 hover:border-slate-300'
                }`}
                onClick={() => setMode('generic')}
              >
                <div className="flex items-center justify-between mb-1">
                  <FileText size={18} className={mode === 'generic' ? 'text-primary' : 'text-slate-500'} />
                  {mode === 'generic' && <Check size={16} className="text-primary" />}
                </div>
                <strong className="block text-sm text-slate-900">Generic Sheets</strong>
                <p className="text-xs text-muted mt-0.5">Blank student name line. Teacher matches learner when scanning.</p>
              </button>

              <button
                type="button"
                className={`choice-card p-3 rounded-lg border text-left transition-all ${
                  mode === 'personalized' ? 'border-primary bg-primary/5 ring-2 ring-primary/20' : 'border-slate-200 hover:border-slate-300'
                }`}
                onClick={() => setMode('personalized')}
              >
                <div className="flex items-center justify-between mb-1">
                  <Users size={18} className={mode === 'personalized' ? 'text-primary' : 'text-slate-500'} />
                  {mode === 'personalized' && <Check size={16} className="text-primary" />}
                </div>
                <strong className="block text-sm text-slate-900">Personalized Roster</strong>
                <p className="text-xs text-muted mt-0.5">Pre-printed student names with individual opaque QR codes.</p>
              </button>
            </div>
          </div>

          {/* Paper Size */}
          <div className="form-row flex items-center justify-between gap-4">
            <label className="text-sm font-medium text-slate-700">Paper Size:</label>
            <select
              className="select-input text-sm"
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
            <div className="personalized-section space-y-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
              <div className="flex items-center justify-between">
                <label className="text-sm font-semibold text-slate-800">Class Section:</label>
                {availableSections.length > 1 ? (
                  <select
                    className="select-input text-sm"
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
                  <span className="text-sm font-medium text-slate-700">{sectionName || 'All Students'}</span>
                )}
              </div>

              {loadingRoster ? (
                <div className="text-center py-4 text-sm text-muted">Loading class roster…</div>
              ) : learners.length === 0 ? (
                <div className="text-center py-3 text-sm text-amber-700 bg-amber-50 rounded">
                  No active students found in this section. Add students in Classes &amp; Rosters.
                </div>
              ) : (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-slate-600">
                      Students ({selectedLearnerIds.length} of {learners.length} selected)
                    </span>
                    <button
                      type="button"
                      className="button ghost small text-xs"
                      onClick={handleSelectAll}
                    >
                      {selectedLearnerIds.length === learners.length ? 'Deselect All' : 'Select All'}
                    </button>
                  </div>
                  <div className="max-h-40 overflow-y-auto border border-slate-200 rounded bg-white p-2 space-y-1">
                    {learners.map((learner) => {
                      const isChecked = selectedLearnerIds.includes(learner.id)
                      return (
                        <label
                          key={learner.id}
                          className="flex items-center gap-2 text-xs py-1 px-1.5 rounded hover:bg-slate-50 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleToggleLearner(learner.id)}
                          />
                          <span className="font-medium text-slate-800">{learner.displayName}</span>
                          {learner.localReference && (
                            <span className="text-muted text-[11px]">({learner.localReference})</span>
                          )}
                        </label>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="generic-copies-row flex items-center justify-between bg-slate-50 p-3 rounded-lg border border-slate-200">
              <label className="text-sm font-medium text-slate-700">Number of generic copies to print:</label>
              <input
                type="number"
                min="1"
                max="200"
                className="input-number text-sm w-20 text-center"
                value={copies}
                onChange={(e) => setCopies(Math.max(1, Number(e.target.value) || 1))}
              />
            </div>
          )}
        </div>

        <div className="modal-footer flex items-center justify-end gap-2 pt-3 border-t">
          <button type="button" className="button ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="button primary flex items-center gap-1.5"
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
