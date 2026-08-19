import { AlertTriangle, Check, ChevronDown, CircleAlert, HelpCircle, Info, Loader2, RefreshCw, Save, ShieldAlert, Sparkles, UserCheck, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { AssessmentResultSession, LearnerItemAnswer, ResultAssessmentItemSnapshot, ResultItemOutcome } from '../../types/results'
import type { OmrBubbleMeasurement, OmrItemRecognition, OmrScanResult } from '../../types/omr'
import { omrRecognitionsToLearnerAnswers } from '../../lib/omr/omrResultsAdapter'
import { checkDuplicateScan, resolveDuplicateOutcomes, type DuplicateResolutionAction } from '../../lib/omr/duplicateSafety'
import { filterLearnerCandidates, matchScanToLearner } from '../../lib/omr/learnerMatching'
import { cropWritingArea, transcribeHandwrittenResponse } from '../../lib/omr/handwritingTranscription'
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

  const [selectedLearnerId, setSelectedLearnerId] = useState<string>(
    matchResult.matchedLearner?.learnerId || session.learners[0]?.learnerId || '',
  )
  const [learnerSearch, setLearnerSearch] = useState('')
  const [answers, setAnswers] = useState<Record<string, LearnerItemAnswer | null>>(() =>
    omrRecognitionsToLearnerAnswers(scanResult.recognizedItems),
  )
  const [teacherPoints, setTeacherPoints] = useState<Record<string, number | null>>({})
  const [duplicateResolution, setDuplicateResolution] = useState<DuplicateResolutionAction>('REPLACE')
  const [transcribingItemId, setTranscribingItemId] = useState<string | null>(null)
  const [transcriptionErrors, setTranscriptionErrors] = useState<Record<string, string>>({})

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

  // Check duplicate collision
  const collision = checkDuplicateScan(
    scanResult,
    selectedLearnerId,
    selectedLearner?.displayName,
    liveOutcomes,
    existingOutcomes,
    scannedFingerprints,
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

  function handleTranscriptTextChange(itemId: string, text: string) {
    setAnswers((prev) => ({
      ...prev,
      [itemId]: text.trim() ? { type: 'short_answer', text } : null,
    }))
  }

  async function handleTranscribeHandwriting(item: ResultAssessmentItemSnapshot) {
    setTranscribingItemId(item.id)
    setTranscriptionErrors((prev) => ({ ...prev, [item.id]: '' }))

    try {
      // Mock or actual crop
      const mockCrop = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBD'
      const result = await transcribeHandwrittenResponse(mockCrop, item.prompt, item.questionType)

      if (result.success && result.transcript) {
        handleTranscriptTextChange(item.id, result.transcript)
      } else if (result.error) {
        setTranscriptionErrors((prev) => ({ ...prev, [item.id]: result.error || 'Transcription unavailable.' }))
      }
    } catch (e) {
      setTranscriptionErrors((prev) => ({
        ...prev,
        [item.id]: e instanceof Error ? e.message : 'Transcription failed.',
      }))
    } finally {
      setTranscribingItemId(null)
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
        <div className="review-modal-header flex items-center justify-between pb-3 border-b border-border">
          <div>
            <span className="text-xs uppercase tracking-wider font-semibold text-primary">Smart Answer Sheet · Scan Review</span>
            <h2 id="review-modal-title" className="text-lg font-bold text-foreground">
              {session.assessmentSnapshot.assessmentTitle}
            </h2>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close review modal">
            <X size={20} />
          </button>
        </div>

        {/* Learner Selector & Live Score Banner */}
        <div className="review-context-bar grid grid-cols-1 md:grid-cols-2 gap-3 py-3 border-b border-border bg-surface-muted p-3 rounded-lg">
          {/* Learner Info */}
          <div>
            <label className="text-xs font-medium text-foreground-muted block mb-1">
              Student / Examinee {isPersonalized ? '(Matched from QR)' : '(Select from Roster)'}
            </label>
            {isPersonalized ? (
              <div className="flex items-center gap-2 font-semibold text-foreground py-1">
                <UserCheck size={18} className="text-primary" />
                <span>{selectedLearner?.displayName || scanResult.learnerId || 'Unknown Learner'}</span>
                {selectedLearner?.localReference && (
                  <span className="text-xs font-normal text-foreground-muted">({selectedLearner.localReference})</span>
                )}
              </div>
            ) : (
              <select
                className="w-full text-sm py-1.5 px-2.5 rounded border border-border bg-surface text-foreground"
                value={selectedLearnerId}
                onChange={(e) => setSelectedLearnerId(e.target.value)}
              >
                {session.learners.map((l) => (
                  <option key={l.learnerId} value={l.learnerId}>
                    {l.displayName} {l.localReference ? `(${l.localReference})` : ''}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Live Score Summary */}
          <div className="flex items-center justify-end gap-4">
            <div className="text-right">
              <span className="text-xs text-foreground-muted block">Live Score</span>
              <strong className="text-xl font-bold text-primary">
                {formatScore(liveTotals.rawScore)} / {liveTotals.possiblePoints}
              </strong>
            </div>
            <div className="text-right border-l border-border pl-3">
              <span className="text-xs text-foreground-muted block">Percentage</span>
              <strong className="text-lg font-semibold text-foreground">
                {liveTotals.percentage !== null ? `${(liveTotals.percentage * 100).toFixed(1)}%` : '—'}
              </strong>
            </div>
          </div>
        </div>

        {/* Duplicate Collision Warning Banner */}
        {collision.hasCollision && (
          <div className="duplicate-collision-banner bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 my-3 flex items-start gap-3">
            <AlertTriangle className="text-amber-500 shrink-0 mt-0.5" size={18} />
            <div className="flex-1 text-sm">
              <strong className="text-amber-600 dark:text-amber-400 block font-semibold">
                Duplicate Scan Collision Detected
              </strong>
              <p className="text-foreground-muted text-xs my-1">{collision.message}</p>
              <div className="flex items-center gap-2 mt-2">
                <label className="text-xs font-medium cursor-pointer flex items-center gap-1.5">
                  <input
                    type="radio"
                    name="duplicateResolution"
                    value="REPLACE"
                    checked={duplicateResolution === 'REPLACE'}
                    onChange={() => setDuplicateResolution('REPLACE')}
                  />
                  <span>Replace existing ({collision.existingTotalScore} pts → {collision.newTotalScore} pts)</span>
                </label>
                <label className="text-xs font-medium cursor-pointer flex items-center gap-1.5 ml-3">
                  <input
                    type="radio"
                    name="duplicateResolution"
                    value="KEEP_CURRENT"
                    checked={duplicateResolution === 'KEEP_CURRENT'}
                    onChange={() => setDuplicateResolution('KEEP_CURRENT')}
                  />
                  <span>Keep current ({collision.existingTotalScore} pts)</span>
                </label>
                <label className="text-xs font-medium cursor-pointer flex items-center gap-1.5 ml-3">
                  <input
                    type="radio"
                    name="duplicateResolution"
                    value="SKIP"
                    checked={duplicateResolution === 'SKIP'}
                    onChange={() => setDuplicateResolution('SKIP')}
                  />
                  <span>Skip this scan</span>
                </label>
              </div>
            </div>
          </div>
        )}

        {/* Recognized Items List */}
        <div className="review-items-scroll max-h-[50vh] overflow-y-auto pr-1 my-3 space-y-2.5">
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
                className={`review-item-card p-3 rounded-lg border text-sm ${
                  isAmbiguous
                    ? 'border-amber-500/40 bg-amber-500/5'
                    : outcome?.isCorrect === true
                    ? 'border-emerald-500/30 bg-surface'
                    : outcome?.isCorrect === false
                    ? 'border-rose-500/30 bg-surface'
                    : 'border-border bg-surface'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-foreground">Question {item.itemNumber}</span>
                      <span className="text-xs px-2 py-0.5 rounded bg-surface-muted text-foreground-muted uppercase font-medium">
                        {item.questionType.replace('_', ' ')}
                      </span>
                      {isAmbiguous && (
                        <span className="text-xs px-2 py-0.5 rounded bg-amber-500/20 text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1">
                          <CircleAlert size={12} /> {recognition?.reviewReason || 'Review Required'}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-foreground-muted line-clamp-2">{item.prompt}</p>
                  </div>

                  {/* Points Badge */}
                  <div className="text-right shrink-0">
                    <span className="text-xs font-semibold text-foreground">
                      {outcome ? `${formatScore(outcome.earnedPoints)} / ${outcome.possiblePoints}` : `— / ${item.points}`} pts
                    </span>
                  </div>
                </div>

                {/* Multiple Choice & True/False Interactive Bubbles */}
                {(item.questionType === 'multiple_choice' || item.questionType === 'true_false' || item.questionType === 'multiple_select') && (
                  <div className="bubble-options-row flex items-center gap-2 mt-2.5 pt-2 border-t border-border/50">
                    <span className="text-xs text-foreground-muted font-medium mr-1">Shaded Bubble:</span>
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
                          className={`bubble-pill px-3 py-1 text-xs rounded-full font-bold border transition-colors flex items-center gap-1.5 ${
                            isSelected
                              ? 'bg-primary text-primary-foreground border-primary'
                              : b.state === 'UNCERTAIN'
                              ? 'bg-amber-500/20 text-amber-600 border-amber-500/40'
                              : 'bg-surface hover:bg-surface-muted text-foreground border-border'
                          }`}
                          onClick={() => handleSelectBubble(item.id, b.choiceId, item.questionType)}
                          title={`Fill: ${b.fillPercentage}%, Contrast: ${b.contrast}%`}
                        >
                          <span>{b.label}</span>
                          {b.fillPercentage > 15 && (
                            <span className="text-[10px] opacity-75 font-normal">({b.fillPercentage}%)</span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                )}

                {/* Subjective Teacher Scoring & Optional Handwriting Transcription */}
                {isSubjective && (
                  <div className="subjective-response-section mt-2.5 pt-2 border-t border-border/50 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs text-foreground-muted font-medium">Student Written Response:</label>
                      <button
                        type="button"
                        className="button ghost text-xs py-0.5 px-2 text-primary flex items-center gap-1"
                        disabled={transcribingItemId === item.id}
                        onClick={() => void handleTranscribeHandwriting(item)}
                      >
                        {transcribingItemId === item.id ? (
                          <Loader2 size={12} className="spin" />
                        ) : (
                          <Sparkles size={12} />
                        )}
                        <span>{transcribingItemId === item.id ? 'Transcribing…' : 'Transcribe (AI)'}</span>
                      </button>
                    </div>

                    <textarea
                      rows={2}
                      className="w-full text-xs p-2 rounded border border-border bg-surface text-foreground placeholder:text-foreground-muted"
                      placeholder="Student's handwritten answer text (editable)..."
                      value={currentAnswer?.type === 'short_answer' ? currentAnswer.text : ''}
                      onChange={(e) => handleTranscriptTextChange(item.id, e.target.value)}
                    />

                    {transcriptionErrors[item.id] && (
                      <p className="text-[11px] text-amber-600 dark:text-amber-400">
                        {transcriptionErrors[item.id]}
                      </p>
                    )}

                    <div className="teacher-score-row flex items-center gap-3 pt-1">
                      <label className="text-xs text-foreground-muted font-medium">Award Points:</label>
                      <input
                        type="number"
                        min="0"
                        max={item.points}
                        step="0.5"
                        className="w-20 text-xs py-1 px-2 rounded border border-border bg-surface text-foreground font-bold"
                        value={teacherPoints[item.id] !== undefined && teacherPoints[item.id] !== null ? String(teacherPoints[item.id]) : ''}
                        placeholder="0"
                        onChange={(e) => handleTeacherPointsChange(item.id, item.points, e.target.value)}
                      />
                      <span className="text-xs text-foreground-muted">/ {item.points} possible pts</span>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Modal Actions */}
        <div className="review-modal-footer flex items-center justify-between pt-3 border-t border-border">
          <button type="button" className="button ghost" onClick={onClose}>
            Discard Scan
          </button>
          <button
            type="button"
            className="button primary flex items-center gap-1.5"
            disabled={!selectedLearnerId}
            onClick={handleConfirmSave}
          >
            <Check size={16} />
            <span>Confirm & Save Results</span>
          </button>
        </div>
      </div>
    </div>
  )
}
