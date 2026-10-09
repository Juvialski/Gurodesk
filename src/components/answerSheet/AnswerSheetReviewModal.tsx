import {
  AlertTriangle,
  Check,
  CircleAlert,
  HelpCircle,
  Sparkles,
  UserCheck,
  X,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import type { AssessmentResultSession, LearnerItemAnswer, ResultAssessmentItemSnapshot, ResultItemOutcome } from '../../types/results'
import type { OmrItemRecognition, OmrScanResult } from '../../types/omr'
import { omrRecognitionsToLearnerAnswers } from '../../lib/omr/omrResultsAdapter'
import { checkDuplicateScan, type DuplicateResolutionAction } from '../../lib/omr/duplicateSafety'
import { filterLearnerCandidates, matchScanToLearner } from '../../lib/omr/learnerMatching'
import { calculateResultTotals, formatScore, scoreAnswerSheet } from '../../lib/resultsScoring'
import { gradeSubjectiveResponse } from '../../lib/omr/subjectiveAutoGrader'

export type AnswerSheetReviewModalProps = {
  isOpen: boolean
  scanResult: OmrScanResult
  session: AssessmentResultSession
  existingOutcomes: ResultItemOutcome[]
  scannedFingerprints?: Set<string>
  aiAutoGradeConsent?: boolean
  onToggleAiConsent?: (consent: boolean) => void
  onConfirm: (learnerId: string, outcomes: ResultItemOutcome[]) => void
  onClose: () => void
}

export function AnswerSheetReviewModal({
  isOpen,
  scanResult,
  session,
  existingOutcomes,
  scannedFingerprints = new Set(),
  aiAutoGradeConsent = false,
  onToggleAiConsent,
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

  const [aiSuggestions, setAiSuggestions] = useState<
    Record<
      string,
      {
        transcript: string
        suggestedPoints: number
        feedback: string
        confidence: number
      }
    >
  >(() => {
    const map: Record<string, { transcript: string; suggestedPoints: number; feedback: string; confidence: number }> = {}
    for (const r of scanResult.recognizedItems) {
      if (r.aiGradingSuggestion) {
        map[r.itemId] = r.aiGradingSuggestion
      }
    }
    return map
  })

  const [teacherPoints, setTeacherPoints] = useState<Record<string, number | null>>(() => {
    const map: Record<string, number | null> = {}
    for (const r of scanResult.recognizedItems) {
      if (r.aiGradingSuggestion && typeof r.aiGradingSuggestion.suggestedPoints === 'number') {
        map[r.itemId] = r.aiGradingSuggestion.suggestedPoints
      }
    }
    return map
  })

  const [gradingInProgress, setGradingInProgress] = useState<Record<string, boolean>>({})
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

  async function handleRunItemAiGrading(item: ResultAssessmentItemSnapshot, recognition?: OmrItemRecognition) {
    if (!recognition?.writingCropBase64) {
      alert('No handwritten image crop available for this item.')
      return
    }

    if (!aiAutoGradeConsent) {
      const agreed = window.confirm(
        'Enable AI Auto-Grader?\n\n' +
        'Student handwritten responses will be analyzed by AI to generate suggested scores and feedback based on the answer key. ' +
        'In accordance with DepEd guidelines, all AI scores are drafts and remain subject to your review and confirmation.\n\n' +
        'Do you consent to proceed?',
      )
      if (!agreed) return
      onToggleAiConsent?.(true)
    }

    setGradingInProgress((prev) => ({ ...prev, [item.id]: true }))
    try {
      const res = await gradeSubjectiveResponse({
        teacherConsent: true,
        cropBase64: recognition.writingCropBase64,
        item,
        learningArea: session.assessmentSnapshot.learningArea,
        gradeLevel: session.assessmentSnapshot.gradeLevel,
      })

      if (res.success) {
        setAiSuggestions((prev) => ({
          ...prev,
          [item.id]: {
            transcript: res.transcript,
            suggestedPoints: res.suggestedPoints,
            feedback: res.feedback,
            confidence: res.confidence,
          },
        }))
        setTeacherPoints((prev) => ({
          ...prev,
          [item.id]: res.suggestedPoints,
        }))
      } else {
        alert(res.error || 'AI grading was unable to evaluate this item.')
      }
    } finally {
      setGradingInProgress((prev) => ({ ...prev, [item.id]: false }))
    }
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
          {/* Student Association Context Bar */}
          <div className="review-context-bar">
            <div>
              <label style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--foreground)', display: 'block', marginBottom: '6px' }}>
                {isPersonalized ? 'Roster Assigned Learner' : 'Select Learner from Class Roster'}
              </label>

              {isPersonalized ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 10px', background: 'var(--surface)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                  <UserCheck size={16} style={{ color: '#059669' }} />
                  <strong style={{ fontSize: '13px', color: 'var(--foreground)' }}>
                    {selectedLearner?.displayName || 'Unknown Student'}
                  </strong>
                  <span style={{ fontSize: '11px', color: 'var(--foreground-muted)' }}>
                    ({selectedLearner?.localReference || 'No ID'})
                  </span>
                </div>
              ) : (
                <div>
                  <select
                    className="review-learner-select"
                    value={selectedLearnerId}
                    onChange={(e) => setSelectedLearnerId(e.target.value)}
                  >
                    <option value="">-- Choose Student --</option>
                    {candidateList.map((c) => (
                      <option key={c.learnerId} value={c.learnerId}>
                        {c.displayName}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Score Preview Box */}
            <div className="review-score-summary">
              <div className="review-score-box">
                <small>Calculated Score</small>
                <strong>
                  {selectedLearnerId ? `${formatScore(liveTotals.rawScore)} / ${liveTotals.possiblePoints}` : '—'}
                </strong>
              </div>
              <div className="review-score-box">
                <small>Percentage</small>
                <strong style={{ color: liveTotals.percentage !== null && liveTotals.percentage >= 75 ? '#059669' : 'var(--foreground)' }}>
                  {selectedLearnerId && liveTotals.percentage !== null ? `${formatScore(liveTotals.percentage)}%` : '—'}
                </strong>
              </div>
            </div>
          </div>

          {/* Duplicate Collision Warning Banner */}
          {collision.hasCollision && (
            <div className="duplicate-collision-banner">
              <AlertTriangle size={18} style={{ color: '#d97706', flexShrink: 0, marginTop: '2px' }} />
              <div style={{ flex: 1 }}>
                <strong>Duplicate Scan Detected</strong>
                <p style={{ margin: '2px 0 0', lineHeight: 1.4 }}>
                  {collision.message}
                </p>
                <div className="duplicate-actions-group">
                  <button
                    type="button"
                    className={`duplicate-action-btn ${duplicateResolution === 'REPLACE' ? 'active' : ''}`}
                    onClick={() => setDuplicateResolution('REPLACE')}
                  >
                    Overwrite Existing
                  </button>
                  <button
                    type="button"
                    className={`duplicate-action-btn ${duplicateResolution === 'KEEP_CURRENT' ? 'active' : ''}`}
                    onClick={() => setDuplicateResolution('KEEP_CURRENT')}
                  >
                    Keep Existing (Discard Scan)
                  </button>
                  <button
                    type="button"
                    className={`duplicate-action-btn ${duplicateResolution === 'SKIP' ? 'active' : ''}`}
                    onClick={() => setDuplicateResolution('SKIP')}
                  >
                    Skip
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Question Items Review List */}
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

              const aiSuggestion = aiSuggestions[item.id]

              return (
                <div
                  key={item.id}
                  className={`review-item-card ${isAmbiguous ? 'needs-review' : ''}`}
                  style={{ flexDirection: 'column', alignItems: 'stretch' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
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

                    {/* Objective Bubbles */}
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

                    {/* Points Display for Objective */}
                    {!isSubjective && (
                      <div style={{ textAlign: 'right', minWidth: '60px', marginLeft: '12px' }}>
                        <strong style={{ fontSize: '13px', color: outcome?.isCorrect ? '#059669' : outcome?.earnedPoints ? 'var(--primary)' : 'var(--foreground)' }}>
                          {outcome ? `${formatScore(outcome.earnedPoints)} / ${outcome.possiblePoints}` : `— / ${item.points}`}
                        </strong>
                        <span style={{ display: 'block', fontSize: '10px', color: 'var(--foreground-muted)' }}>pts</span>
                      </div>
                    )}
                  </div>

                  {/* Subjective Item Scoring & AI Suggestions Section */}
                  {isSubjective && (
                    <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px dashed var(--border)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
                        {recognition?.writingCropBase64 && (
                          <div>
                            <span style={{ fontSize: '10.5px', color: 'var(--foreground-muted)', display: 'block', marginBottom: '3px', fontWeight: 600 }}>
                              Student Response Box:
                            </span>
                            <img
                              src={recognition.writingCropBase64}
                              alt={`Student answer for Q${item.itemNumber}`}
                              className="review-writing-crop"
                            />
                          </div>
                        )}

                        <div style={{ flex: 1, minWidth: '220px' }}>
                          {aiSuggestion ? (
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                                <span className="review-ai-badge">
                                  <Sparkles size={12} /> AI Suggested: {formatScore(aiSuggestion.suggestedPoints)} / {item.points} pts
                                </span>
                                <span style={{ fontSize: '10.5px', color: 'var(--foreground-muted)' }}>
                                  ({Math.round(aiSuggestion.confidence * 100)}% confidence)
                                </span>
                              </div>
                              {aiSuggestion.transcript && (
                                <p style={{ fontSize: '11.5px', color: 'var(--foreground)', margin: '3px 0', fontStyle: 'italic' }}>
                                  "{aiSuggestion.transcript}"
                                </p>
                              )}
                              {aiSuggestion.feedback && (
                                <div className="review-ai-feedback">
                                  <strong>AI Rationale:</strong> {aiSuggestion.feedback}
                                </div>
                              )}
                            </div>
                          ) : (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '6px 0' }}>
                              <span style={{ fontSize: '11.5px', color: 'var(--foreground-muted)' }}>
                                Teacher-Scored Item (Manual)
                              </span>
                              {recognition?.writingCropBase64 && (
                                <button
                                  type="button"
                                  className="review-ai-action-btn"
                                  disabled={gradingInProgress[item.id]}
                                  onClick={() => handleRunItemAiGrading(item, recognition)}
                                >
                                  <Sparkles size={12} />
                                  <span>{gradingInProgress[item.id] ? 'Evaluating...' : 'AI Auto-Grade'}</span>
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Manual Point Input & Accept Action */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '4px' }}>
                        <div className="review-manual-box">
                          <span style={{ fontWeight: 700 }}>Teacher Confirmed Score:</span>
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
                          {aiSuggestion && (
                            <button
                              type="button"
                              className="button ghost compact text-xs"
                              style={{ padding: '3px 8px', fontSize: '11px', border: '1px solid var(--border)' }}
                              onClick={() => setTeacherPoints((prev) => ({ ...prev, [item.id]: aiSuggestion.suggestedPoints }))}
                            >
                              Reset to AI ({aiSuggestion.suggestedPoints} pt)
                            </button>
                          )}
                        </div>

                        <div style={{ textAlign: 'right', minWidth: '60px' }}>
                          <strong style={{ fontSize: '13px', color: outcome?.isCorrect ? '#059669' : outcome?.earnedPoints ? 'var(--primary)' : 'var(--foreground)' }}>
                            {outcome ? `${formatScore(outcome.earnedPoints)} / ${outcome.possiblePoints}` : `— / ${item.points}`}
                          </strong>
                          <span style={{ display: 'block', fontSize: '10px', color: 'var(--foreground-muted)' }}>pts</span>
                        </div>
                      </div>
                    </div>
                  )}
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
