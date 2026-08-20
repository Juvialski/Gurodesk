import {
  AlertTriangle,
  Check,
  CircleAlert,
  HelpCircle,
  UserCheck,
  X,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import type { AssessmentResultSession, LearnerItemAnswer, ResultItemOutcome } from '../../types/results'
import type { OmrScanResult } from '../../types/omr'
import { omrRecognitionsToLearnerAnswers } from '../../lib/omr/omrResultsAdapter'
import { checkDuplicateScan, type DuplicateResolutionAction } from '../../lib/omr/duplicateSafety'
import { filterLearnerCandidates, matchScanToLearner } from '../../lib/omr/learnerMatching'
import { calculateResultTotals, formatScore, scoreAnswerSheet } from '../../lib/resultsScoring'

export type AnswerSheetReviewModalProps = {
  isOpen: boolean
  scanResult: OmrScanResult
  session: AssessmentResultSession
  existingOutcomes: ResultItemOutcome[]
  scannedFingerprints?: Set<string>
  onConfirm: (learnerId: string, outcomes: ResultItemOutcome[]) => void
  onClose: () => void
}

export function AnswerSheetReviewModal({
  isOpen,
  scanResult,
  session,
  existingOutcomes,
  scannedFingerprints = new Set(),
  onConfirm,
  onClose,
}: AnswerSheetReviewModalProps) {
  const matchResult = useMemo(
    () => matchScanToLearner(scanResult, session.learners),
    [scanResult, session.learners],
  )

  // Never auto-select the first student on generic scans: require explicit selection
  const [selectedLearnerId, setSelectedLearnerId] = useState<string>(
    matchResult.matchedLearner?.learnerId || '',
  )
  const [learnerSearch, setLearnerSearch] = useState('')
  const [answers, setAnswers] = useState<Record<string, LearnerItemAnswer | null>>(() =>
    omrRecognitionsToLearnerAnswers(scanResult.recognizedItems),
  )
  const [teacherPoints, setTeacherPoints] = useState<Record<string, number | null>>({})
  const [duplicateResolution, setDuplicateResolution] = useState<DuplicateResolutionAction>('REPLACE')

  if (!isOpen) return null

  const selectedLearner = session.learners.find((l) => l.learnerId === selectedLearnerId)
  const candidateList = filterLearnerCandidates(matchResult.availableCandidates, learnerSearch)

  // Compute live outcomes and totals
  const liveOutcomes = selectedLearner
    ? scoreAnswerSheet(
        session,
        { participantId: selectedLearner.participantId, learnerId: selectedLearner.learnerId },
        answers,
        session.assessmentSnapshot.items,
        teacherPoints,
      )
    : []

  const liveTotals = calculateResultTotals(liveOutcomes)

  // Check duplicate collision (excluding self if fingerprint already in set)
  const collision = checkDuplicateScan(
    scanResult,
    selectedLearnerId,
    selectedLearner?.displayName,
    liveOutcomes,
    existingOutcomes,
    scannedFingerprints,
    scanResult.imageFingerprint,
  )

  function handleSelectBubble(itemId: string, choiceId: string, questionType: string) {
    setAnswers((prev) => {
      const current = prev[itemId]

      if (questionType === 'multiple_choice') {
        const nextChoice = current?.type === 'multiple_choice' && current.choiceId === choiceId ? null : choiceId
        return {
          ...prev,
          [itemId]: nextChoice ? { type: 'multiple_choice', choiceId: nextChoice } : null,
        }
      }

      if (questionType === 'true_false') {
        const val = choiceId === 'T'
        const nextVal = current?.type === 'true_false' && current.value === val ? null : val
        return {
          ...prev,
          [itemId]: nextVal !== null ? { type: 'true_false', value: nextVal } : null,
        }
      }

      if (questionType === 'multiple_select') {
        const currentIds = current?.type === 'multiple_select' ? current.choiceIds : []
        const nextIds = currentIds.includes(choiceId)
          ? currentIds.filter((id) => id !== choiceId)
          : [...currentIds, choiceId]
        return {
          ...prev,
          [itemId]: nextIds.length > 0 ? { type: 'multiple_select', choiceIds: nextIds } : null,
        }
      }

      return prev
    })
  }

  function handleTeacherPointsChange(itemId: string, maxPoints: number, valStr: string) {
    const val = valStr === '' ? null : Math.max(0, Math.min(maxPoints, Number(valStr) || 0))
    setTeacherPoints((prev) => ({ ...prev, [itemId]: val }))
  }

  function handleConfirmSave() {
    if (!selectedLearnerId || !selectedLearner) return

    if (collision.hasCollision && duplicateResolution === 'SKIP') {
      onClose()
      return
    }

    onConfirm(selectedLearnerId, liveOutcomes)
  }

  const isPersonalized = scanResult.mode === 'personalized'

  return (
    <div className="modal-backdrop answer-sheet-review-backdrop" role="dialog" aria-modal="true" aria-labelledby="review-modal-title">
      <div className="modal-content answer-sheet-review-modal panel">
        {/* Modal Header */}
        <div className="review-modal-header">
          <div>
            <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 800, color: 'var(--primary)' }}>
              Smart Answer Sheet · Scan Review
            </span>
            <h2 id="review-modal-title">
              {session.assessmentSnapshot.assessmentTitle}
            </h2>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close review modal">
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="review-modal-body">
          {/* Learner Selector & Live Score Banner */}
          <div className="review-context-bar">
            {/* Learner Info */}
            <div>
              <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--foreground-muted)', display: 'block', marginBottom: '4px' }}>
                Student / Examinee {isPersonalized ? '(Matched from QR)' : '(Select from Class Roster)'}
              </label>
              {isPersonalized ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, color: 'var(--foreground)', padding: '4px 0' }}>
                  <UserCheck size={18} style={{ color: 'var(--primary)' }} />
                  <span>{selectedLearner?.displayName || scanResult.learnerId || 'Unknown Learner'}</span>
                  {selectedLearner?.localReference && (
                    <span style={{ fontSize: '12px', fontWeight: 400, color: 'var(--foreground-muted)' }}>
                      ({selectedLearner.localReference})
                    </span>
                  )}
                </div>
              ) : (
                <select
                  className="review-learner-select"
                  value={selectedLearnerId}
                  onChange={(e) => setSelectedLearnerId(e.target.value)}
                >
                  <option value="">-- Choose Student from Roster --</option>
                  {session.learners.map((l) => (
                    <option key={l.learnerId} value={l.learnerId}>
                      {l.displayName} {l.localReference ? `(${l.localReference})` : ''}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Live Score Summary */}
            <div className="review-score-summary">
              <div className="review-score-box">
                <small>Live Score</small>
                <strong>
                  {formatScore(liveTotals.rawScore)} / {liveTotals.possiblePoints}
                </strong>
              </div>
              <div className="review-score-box" style={{ borderLeft: '1px solid var(--border)', paddingLeft: '14px' }}>
                <small>Percentage</small>
                <strong style={{ color: 'var(--foreground)' }}>
                  {liveTotals.percentage !== null ? `${(liveTotals.percentage * 100).toFixed(1)}%` : '—'}
                </strong>
              </div>
            </div>
          </div>

          {/* Duplicate Collision Warning Banner */}
          {collision.hasCollision && (
            <div className="duplicate-collision-banner">
              <AlertTriangle style={{ color: '#d97706', flexShrink: 0, marginTop: '2px' }} size={18} />
              <div style={{ flex: 1 }}>
                <strong>Duplicate Scan Collision Detected</strong>
                <p style={{ margin: '4px 0 8px', fontSize: '12px' }}>{collision.message}</p>
                <div className="duplicate-actions-group">
                  <button
                    type="button"
                    className={`duplicate-action-btn ${duplicateResolution === 'REPLACE' ? 'active' : ''}`}
                    onClick={() => setDuplicateResolution('REPLACE')}
                  >
                    Replace ({collision.existingTotalScore} pts → {collision.newTotalScore} pts)
                  </button>
                  <button
                    type="button"
                    className={`duplicate-action-btn ${duplicateResolution === 'KEEP_CURRENT' ? 'active' : ''}`}
                    onClick={() => setDuplicateResolution('KEEP_CURRENT')}
                  >
                    Keep Existing ({collision.existingTotalScore} pts)
                  </button>
                  <button
                    type="button"
                    className={`duplicate-action-btn ${duplicateResolution === 'SKIP' ? 'active' : ''}`}
                    onClick={() => setDuplicateResolution('SKIP')}
                  >
                    Skip Scan
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Recognized Items List */}
          <div className="review-items-list">
            {session.assessmentSnapshot.items.map((item) => {
              const recognition = scanResult.recognizedItems.find((r) => r.itemId === item.id)
              const outcome = liveOutcomes.find((o) => o.itemId === item.id)
              const currentAnswer = answers[item.id]
              const isAmbiguous = recognition?.needsReview
              const isSubjective =
                item.questionType === 'short_answer' ||
                item.questionType === 'constructed_response' ||
                item.questionType === 'essay' ||
                item.questionType === 'problem_solving'

              return (
                <div
                  key={item.id}
                  className={`review-item-card ${isAmbiguous ? 'needs-review' : ''}`}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <span className="review-item-number">Q{item.itemNumber}</span>
                      <span style={{ fontSize: '11px', padding: '2px 6px', borderRadius: '4px', background: 'var(--surface-muted)', color: 'var(--foreground-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                        {item.questionType.replace('_', ' ')}
                      </span>
                      {isAmbiguous && (
                        <span style={{ fontSize: '11px', padding: '2px 6px', borderRadius: '4px', background: '#fef3c7', color: '#b45309', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <CircleAlert size={12} /> {recognition?.reviewReason || 'Review Required'}
                        </span>
                      )}
                    </div>
                    <p style={{ fontSize: '12px', color: 'var(--foreground-muted)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.prompt}
                    </p>
                  </div>

                  {/* Multiple Choice & True/False Interactive Bubbles */}
                  {(item.questionType === 'multiple_choice' || item.questionType === 'true_false' || item.questionType === 'multiple_select') && (
                    <div className="review-bubbles-group">
                      {recognition?.bubbles.map((b) => {
                        const isSelected =
                          item.questionType === 'multiple_choice'
                            ? currentAnswer?.type === 'multiple_choice' && currentAnswer.choiceId === b.choiceId
                            : item.questionType === 'true_false'
                            ? currentAnswer?.type === 'true_false' && currentAnswer.value === (b.label === 'T')
                            : item.questionType === 'multiple_select'
                            ? currentAnswer?.type === 'multiple_select' && currentAnswer.choiceIds.includes(b.choiceId)
                            : false

                        return (
                          <button
                            key={b.choiceId}
                            type="button"
                            className={`review-bubble-btn ${isSelected ? 'selected' : ''}`}
                            onClick={() => handleSelectBubble(item.id, b.choiceId, item.questionType)}
                            title={`Fill: ${b.fillPercentage}%, Contrast: ${b.contrast}%`}
                          >
                            {b.label}
                          </button>
                        )
                      })}
                    </div>
                  )}

                  {/* Subjective Teacher Scoring Area */}
                  {isSubjective && (
                    <div className="review-manual-box">
                      <span>Score:</span>
                      <input
                        type="number"
                        min="0"
                        max={item.points}
                        step="0.5"
                        className="review-manual-input"
                        value={teacherPoints[item.id] !== undefined && teacherPoints[item.id] !== null ? String(teacherPoints[item.id]) : ''}
                        placeholder="0"
                        onChange={(e) => handleTeacherPointsChange(item.id, item.points, e.target.value)}
                      />
                      <span>/ {item.points} pt</span>
                    </div>
                  )}

                  {/* Points Display */}
                  <div style={{ textAlign: 'right', minWidth: '60px' }}>
                    <strong style={{ fontSize: '13px', color: outcome?.isCorrect ? '#059669' : outcome?.earnedPoints ? 'var(--primary)' : 'var(--foreground)' }}>
                      {outcome ? `${formatScore(outcome.earnedPoints)} / ${outcome.possiblePoints}` : `— / ${item.points}`}
                    </strong>
                    <span style={{ display: 'block', fontSize: '10px', color: 'var(--foreground-muted)' }}>pts</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="review-modal-footer">
          <button type="button" className="button ghost" onClick={onClose}>
            Discard Scan
          </button>
          <button
            type="button"
            className="button primary"
            disabled={!selectedLearnerId}
            onClick={handleConfirmSave}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Check size={16} />
            <span>Confirm & Save Results</span>
          </button>
        </div>
      </div>
    </div>
  )
}
