import {
  Camera,
  Check,
  ChevronDown,
  ChevronUp,
  CircleAlert,
  FileImage,
  Flashlight,
  FlashlightOff,
  ListChecks,
  RefreshCw,
  Save,
  Sparkles,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { AssessmentResultSession, ResultItemOutcome } from '../../types/results'
import type { BatchScanItem, BatchScanSession } from '../../types/batchScan'
import type { OmrImageBuffer, OmrScanResult } from '../../types/omr'
import { useCameraStream } from '../../hooks/useCameraStream'
import { detectFiducialCorners } from '../../lib/omr/cornerDetection'
import { processAnswerSheetImage } from '../../lib/omr/omrEngine'
import { matchScanToLearner } from '../../lib/omr/learnerMatching'
import { omrRecognitionsToLearnerAnswers } from '../../lib/omr/omrResultsAdapter'
import { checkDuplicateScan } from '../../lib/omr/duplicateSafety'
import { triggerScanSuccessFeedback, triggerScanWarningFeedback } from '../../lib/omr/scanFeedback'
import { calculateBatchSummary, clearBatchScanSession, loadBatchScanSession, saveBatchScanSession } from '../../lib/omr/batchScanStorage'
import { calculateResultTotals, formatScore, scoreAnswerSheet } from '../../lib/resultsScoring'
import { gradeSubjectiveResponse, type SubjectiveGradingResult } from '../../lib/omr/subjectiveAutoGrader'
import { AnswerSheetReviewModal } from './AnswerSheetReviewModal'

export type AnswerSheetScannerModalProps = {
  isOpen: boolean
  session: AssessmentResultSession
  onCommit: (allOutcomes: ResultItemOutcome[]) => void
  onClose: () => void
}

export function AnswerSheetScannerModal({
  isOpen,
  session,
  onCommit,
  onClose,
}: AnswerSheetScannerModalProps) {
  const [batchSession, setBatchSession] = useState<BatchScanSession>(() => {
    const saved = loadBatchScanSession(session.id)
    if (saved && saved.assessmentId === session.assessmentSnapshot.assessmentId) {
      return saved
    }
    return {
      sessionId: session.id,
      assessmentId: session.assessmentSnapshot.assessmentId,
      assessmentTitle: session.assessmentSnapshot.assessmentTitle,
      sectionName: session.sectionName,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      items: [],
    }
  })

  const [isScanningActive] = useState(true)
  const [feedbackMessage, setFeedbackMessage] = useState<string>('Position answer sheet within camera frame')
  const [feedbackStatus, setFeedbackStatus] = useState<'idle' | 'detecting' | 'scanned' | 'error'>('idle')
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [reviewingItem, setReviewingItem] = useState<BatchScanItem | null>(null)

  const [aiAutoGradeConsent, setAiAutoGradeConsent] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('gurodesk_ai_autograder_consent') === 'true'
    }
    return false
  })

  const hasSubjectiveQuestions = useMemo(() => {
    return session.assessmentSnapshot.items.some(
      (it) =>
        it.questionType === 'essay' ||
        it.questionType === 'problem_solving' ||
        it.questionType === 'constructed_response' ||
        it.questionType === 'short_answer',
    )
  }, [session.assessmentSnapshot.items])

  function handleToggleAiConsent(checked: boolean) {
    setAiAutoGradeConsent(checked)
    if (typeof window !== 'undefined') {
      localStorage.setItem('gurodesk_ai_autograder_consent', checked ? 'true' : 'false')
    }
  }

  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const stableFrameCountRef = useRef(0)
  const cooldownRef = useRef(false)
  const timerRef = useRef<number | null>(null)

  const {
    isLoading: isCameraLoading,
    error: cameraError,
    hasTorch,
    isTorchOn,
    toggleTorch,
    captureFrame,
    videoRef,
  } = useCameraStream(isOpen && isScanningActive)

  // Save session updates locally
  useEffect(() => {
    if (batchSession.items.length > 0) {
      saveBatchScanSession(batchSession)
    }
  }, [batchSession])

  const summary = useMemo(
    () => calculateBatchSummary(batchSession, session.learners.length),
    [batchSession, session.learners.length],
  )

  const scannedLearnerIds = useMemo(
    () => new Set(batchSession.items.map((i) => i.learnerId).filter(Boolean) as string[]),
    [batchSession.items],
  )

  const scannedFingerprints = useMemo(
    () => new Set(batchSession.items.map((i) => i.scanResult.imageFingerprint)),
    [batchSession.items],
  )

  const handleProcessImageBuffer = useCallback((fullFrame: OmrImageBuffer) => {
    try {
      const scanResult: OmrScanResult = processAnswerSheetImage(fullFrame, {
        expectedAssessmentSnapshot: session.assessmentSnapshot,
        expectedAssessmentId: session.assessmentSnapshot.assessmentId,
        expectedVersionNumber: session.assessmentSnapshot.assessmentVersionNumber,
      })

      if (!scanResult.success) {
        triggerScanWarningFeedback()
        setFeedbackStatus('error')
        setFeedbackMessage(scanResult.errorMessage || 'Scan failed. Please adjust lighting and try again.')
        return
      }

      // Match learner from QR (personalized) or require explicit teacher selection (generic)
      const match = matchScanToLearner(scanResult, session.learners, scannedLearnerIds)
      const learner = match.matchedLearner || null // NEVER auto-assign to first student

      // Convert answers and score
      const learnerAnswers = omrRecognitionsToLearnerAnswers(scanResult.recognizedItems)
      const outcomes = learner
        ? scoreAnswerSheet(
            session,
            { participantId: learner.participantId, learnerId: learner.learnerId },
            learnerAnswers,
            session.assessmentSnapshot.items,
          )
        : []

      const totals = calculateResultTotals(outcomes)

      // Check duplicate
      const duplicateCheck = checkDuplicateScan(
        scanResult,
        learner?.learnerId,
        learner?.displayName,
        outcomes,
        session.itemOutcomes,
        scannedFingerprints,
      )

      let itemStatus: BatchScanItem['status'] = 'CLEAN'
      let reviewReason: string | undefined

      if (!learner) {
        itemStatus = 'NEEDS_REVIEW'
        reviewReason = 'Select student from roster'
      } else if (duplicateCheck.hasCollision) {
        itemStatus = 'DUPLICATE'
        reviewReason = duplicateCheck.message
      } else if (scanResult.needsReview) {
        itemStatus = 'NEEDS_REVIEW'
        reviewReason = scanResult.errorMessage || 'Review required'
      }

      const newItem: BatchScanItem = {
        id: `batch-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        scanTimestamp: new Date().toISOString(),
        learnerId: learner?.learnerId || null,
        participantId: learner?.participantId,
        learnerName: learner?.displayName,
        scanResult,
        answers: learnerAnswers,
        teacherPoints: {},
        outcomes,
        totals,
        status: itemStatus,
        reviewReason,
      }

      // Add to batch session
      setBatchSession((prev) => ({
        ...prev,
        updatedAt: new Date().toISOString(),
        items: [newItem, ...prev.items],
      }))

      // If AI auto-grader consent is active, run AI auto-grader in background for subjective items
      if (aiAutoGradeConsent) {
        const subjectiveRecs = scanResult.recognizedItems.filter(
          (r) => !r.isMachineCheckable && r.writingCropBase64,
        )

        if (subjectiveRecs.length > 0) {
          Promise.all(
            subjectiveRecs.map(async (rec) => {
              const itemSnapshot = session.assessmentSnapshot.items.find((it) => it.id === rec.itemId)
              if (!itemSnapshot || !rec.writingCropBase64) return null
              const res = await gradeSubjectiveResponse({
                cropBase64: rec.writingCropBase64,
                item: itemSnapshot,
                learningArea: session.assessmentSnapshot.learningArea,
                gradeLevel: session.assessmentSnapshot.gradeLevel,
              })
              return { itemId: rec.itemId, res }
            }),
          )
            .then((results) => {
              const successfulGrades = results.filter(Boolean) as {
                itemId: string
                res: SubjectiveGradingResult
              }[]
              if (successfulGrades.length === 0) return

              setBatchSession((prev) => ({
                ...prev,
                items: prev.items.map((it) => {
                  if (it.id !== newItem.id) return it

                  const updatedRecognitions = it.scanResult.recognizedItems.map((r) => {
                    const matchGrade = successfulGrades.find((g) => g.itemId === r.itemId && g.res.success)
                    if (matchGrade) {
                      return {
                        ...r,
                        aiGradingSuggestion: {
                          transcript: matchGrade.res.transcript,
                          suggestedPoints: matchGrade.res.suggestedPoints,
                          feedback: matchGrade.res.feedback,
                          confidence: matchGrade.res.confidence,
                        },
                      }
                    }
                    return r
                  })

                  const updatedTeacherPoints = { ...it.teacherPoints }
                  for (const g of successfulGrades) {
                    if (g.res.success && updatedTeacherPoints[g.itemId] === undefined) {
                      updatedTeacherPoints[g.itemId] = g.res.suggestedPoints
                    }
                  }

                  const updatedOutcomes =
                    it.learnerId && it.participantId
                      ? scoreAnswerSheet(
                          session,
                          { participantId: it.participantId, learnerId: it.learnerId },
                          it.answers,
                          session.assessmentSnapshot.items,
                          updatedTeacherPoints,
                        )
                      : it.outcomes

                  const updatedTotals = calculateResultTotals(updatedOutcomes)

                  return {
                    ...it,
                    scanResult: { ...it.scanResult, recognizedItems: updatedRecognitions },
                    teacherPoints: updatedTeacherPoints,
                    outcomes: updatedOutcomes,
                    totals: updatedTotals,
                  }
                }),
              }))
            })
            .catch((err) => {
              console.warn('Background AI grading error:', err)
            })
        }
      }

      triggerScanSuccessFeedback()
      setFeedbackStatus('scanned')
      setFeedbackMessage(
        `✓ Scanned: ${learner?.displayName || 'Generic Sheet (Requires Assignment)'} (${totals.rawScore}/${totals.possiblePoints} pts)`,
      )

      // Set cooldown before next sheet
      cooldownRef.current = true
      setTimeout(() => {
        cooldownRef.current = false
        setFeedbackStatus('idle')
        setFeedbackMessage('Position next answer sheet within camera frame')
      }, 1400)
    } catch (err) {
      console.error('Scan processing error:', err)
      triggerScanWarningFeedback()
      setFeedbackStatus('error')
      setFeedbackMessage('Unable to process image. Ensure good lighting.')
    }
  }, [session, scannedLearnerIds, scannedFingerprints, aiAutoGradeConsent])

  const handleFrameLoop = useCallback(() => {
    if (!isOpen || !isScanningActive || cooldownRef.current) {
      timerRef.current = window.setTimeout(handleFrameLoop, 200)
      return
    }

    const frame = captureFrame(480) // 480px width for fast 15-20fps fiducial detection
    if (!frame) {
      timerRef.current = window.setTimeout(handleFrameLoop, 200)
      return
    }

    const cornerCheck = detectFiducialCorners(frame)
    if (cornerCheck.success && cornerCheck.corners) {
      stableFrameCountRef.current += 1
      setFeedbackStatus('detecting')
      setFeedbackMessage('Hold steady...')

      // When 2 consecutive stable frames detect fiducials, capture high-res frame
      if (stableFrameCountRef.current >= 2) {
        stableFrameCountRef.current = 0
        const fullFrame = captureFrame(1050)
        if (fullFrame) {
          handleProcessImageBuffer(fullFrame)
        }
      }
    } else {
      stableFrameCountRef.current = Math.max(0, stableFrameCountRef.current - 1)
      if (feedbackStatus === 'detecting') {
        setFeedbackStatus('idle')
        setFeedbackMessage('Position answer sheet within camera frame')
      }
    }

    timerRef.current = window.setTimeout(handleFrameLoop, 150)
  }, [isOpen, isScanningActive, captureFrame, feedbackStatus, handleProcessImageBuffer])

  useEffect(() => {
    if (isOpen && isScanningActive) {
      timerRef.current = window.setTimeout(handleFrameLoop, 400)
    }
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }
  }, [isOpen, isScanningActive, handleFrameLoop])

  function handleFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const maxDim = 1400
        let w = img.width
        let h = img.height
        if (w > maxDim || h > maxDim) {
          if (w > h) {
            h = Math.round((h * maxDim) / w)
            w = maxDim
          } else {
            w = Math.round((w * maxDim) / h)
            h = maxDim
          }
        }
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')
        if (!ctx) return
        ctx.drawImage(img, 0, 0, w, h)
        const imgData = ctx.getImageData(0, 0, w, h)

        // Convert RGBA to Grayscale
        const gray = new Uint8Array(w * h)
        for (let i = 0, j = 0; i < imgData.data.length; i += 4, j++) {
          gray[j] = Math.round(
            imgData.data[i] * 0.299 +
            imgData.data[i + 1] * 0.587 +
            imgData.data[i + 2] * 0.114,
          )
        }

        handleProcessImageBuffer({
          data: gray,
          width: w,
          height: h,
        })
      }
      img.src = reader.result as string
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  function handleRemoveItem(itemId: string) {
    setBatchSession((prev) => ({
      ...prev,
      items: prev.items.filter((i) => i.id !== itemId),
    }))
  }

  const hasUnresolvedItems = batchSession.items.some(
    (i) => i.status !== 'CLEAN' || !i.learnerId || i.outcomes.length === 0,
  )

  function handleCommitBatch() {
    if (hasUnresolvedItems) return

    // Collect all outcomes from batch items
    const allOutcomes: ResultItemOutcome[] = []
    for (const item of batchSession.items) {
      if (item.outcomes.length > 0) {
        allOutcomes.push(...item.outcomes)
      }
    }

    clearBatchScanSession(session.id)
    onCommit(allOutcomes)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="modal-backdrop answer-sheet-scanner-backdrop" role="dialog" aria-modal="true">
      <div className="modal-content answer-sheet-scanner-modal full-screen-modal">
        {/* Top Header */}
        <div className="scanner-header">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="scanner-badge">Burst Mode</span>
              <strong style={{ fontSize: '14px', fontWeight: 700 }}>{session.sectionName} · Smart Scan</strong>
            </div>
            <span style={{ fontSize: '11.5px', color: '#94a3b8', display: 'block', marginTop: '2px' }}>
              {session.assessmentSnapshot.assessmentTitle}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              className="button ghost compact"
              style={{ color: '#ffffff', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}
              onClick={() => fileInputRef.current?.click()}
              title="Upload photo or take with native camera"
            >
              <Upload size={15} />
              <span>Upload Photo</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleFileInputChange}
            />

            {hasTorch && (
              <button
                type="button"
                className="icon-button"
                style={{ color: '#ffffff' }}
                onClick={() => void toggleTorch()}
                aria-label={isTorchOn ? 'Turn flashlight off' : 'Turn flashlight on'}
              >
                {isTorchOn ? <Flashlight size={18} style={{ color: '#fbbf24' }} /> : <FlashlightOff size={18} />}
              </button>
            )}
            <button
              type="button"
              className="icon-button"
              style={{ color: '#ffffff' }}
              onClick={onClose}
              aria-label="Close scanner"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Teacher Consent Notice for AI Auto-Grading */}
        {hasSubjectiveQuestions && (
          <div className="scanner-consent-card">
            <div className="scanner-consent-header">
              <div className="scanner-consent-title">
                <Sparkles size={16} />
                <span>Optional AI Auto-Grader for Essay & Problem Solving</span>
              </div>
              <label className="scanner-consent-toggle">
                <input
                  type="checkbox"
                  checked={aiAutoGradeConsent}
                  onChange={(e) => handleToggleAiConsent(e.target.checked)}
                />
                <span>Enable AI grading suggestions</span>
              </label>
            </div>
            <p className="scanner-consent-description">
              Student handwritten responses will be analyzed by AI to draft suggested scores and rubric-aligned feedback.
              In accordance with DepEd Teacher Primacy guidelines (DepEd Order No. 015, s. 2026), all AI scores are drafts and require your review and confirmation before finalizing.
            </p>
          </div>
        )}

        {/* Live Camera Viewfinder or Camera Fallback */}
        <div className="scanner-viewfinder-container">
          {cameraError ? (
            <div className="camera-fallback-panel">
              <CircleAlert size={44} style={{ color: '#f59e0b', margin: '0 auto 12px' }} />
              <strong style={{ fontSize: '16px', display: 'block', fontWeight: 800 }}>Camera Access Unavailable</strong>
              <p style={{ fontSize: '12.5px', color: '#94a3b8', margin: '8px 0 16px', lineHeight: 1.5 }}>
                {cameraError}. You can still upload photos of the answer sheet directly from your device.
              </p>
              <button
                type="button"
                className="button primary"
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                onClick={() => fileInputRef.current?.click()}
              >
                <FileImage size={17} />
                <span>Select / Capture Photo</span>
              </button>
            </div>
          ) : (
            <>
              <video
                ref={videoRef}
                className="scanner-video-preview"
                playsInline
                muted
                autoPlay
              />

              {/* Corner Alignment Overlay Guide */}
              <div className="viewfinder-alignment-guide">
                {/* Top Corners */}
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <div className="viewfinder-guide-corner" style={{ borderTop: '4px solid #3b82f6', borderLeft: '4px solid #3b82f6', borderTopLeftRadius: '4px' }} />
                  <div className="viewfinder-guide-corner" style={{ borderTop: '4px solid #3b82f6', borderRight: '4px solid #3b82f6', borderTopRightRadius: '4px' }} />
                </div>
                {/* Bottom Corners */}
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <div className="viewfinder-guide-corner" style={{ borderBottom: '4px solid #3b82f6', borderLeft: '4px solid #3b82f6', borderBottomLeftRadius: '4px' }} />
                  <div className="viewfinder-guide-corner" style={{ borderBottom: '4px solid #3b82f6', borderRight: '4px solid #3b82f6', borderBottomRightRadius: '4px' }} />
                </div>
              </div>

              {/* Live Status Toast Banner */}
              <div className={`scanner-status-pill ${feedbackStatus}`}>
                {feedbackStatus === 'scanned' ? (
                  <Check size={15} />
                ) : feedbackStatus === 'detecting' ? (
                  <RefreshCw size={13} className="spin" />
                ) : feedbackStatus === 'error' ? (
                  <CircleAlert size={15} />
                ) : (
                  <Camera size={13} />
                )}
                <span>{feedbackMessage}</span>
              </div>
            </>
          )}
        </div>

        {/* Bottom Tray / Batch Summary Counter */}
        <div className="scanner-bottom-tray">
          {/* Metrics summary bar */}
          <div className="scanner-metrics-bar">
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div>
                <span style={{ color: 'var(--foreground-muted)', display: 'block', fontSize: '11px' }}>Scanned</span>
                <strong style={{ fontSize: '14px', fontWeight: 800, color: 'var(--foreground)' }}>
                  {summary.totalScanned} / {summary.totalRosterCount}
                </strong>
              </div>
              <div style={{ borderLeft: '1px solid var(--border)', paddingLeft: '12px' }}>
                <span style={{ color: 'var(--foreground-muted)', display: 'block', fontSize: '11px' }}>Clean</span>
                <strong style={{ fontSize: '14px', fontWeight: 800, color: '#059669' }}>
                  {summary.cleanCount}
                </strong>
              </div>
              {summary.needsReviewCount > 0 && (
                <div style={{ borderLeft: '1px solid var(--border)', paddingLeft: '12px' }}>
                  <span style={{ color: 'var(--foreground-muted)', display: 'block', fontSize: '11px' }}>Review</span>
                  <strong style={{ fontSize: '14px', fontWeight: 800, color: '#d97706' }}>
                    {summary.needsReviewCount}
                  </strong>
                </div>
              )}
            </div>

            <button
              type="button"
              className="button ghost text-xs"
              style={{ display: 'flex', alignItems: 'center', gap: '5px' }}
              onClick={() => setIsDrawerOpen(!isDrawerOpen)}
            >
              <ListChecks size={14} />
              <span>{isDrawerOpen ? 'Hide Queue' : `Queue (${batchSession.items.length})`}</span>
              {isDrawerOpen ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
            </button>
          </div>

          {/* Collapsible Scanned Items Queue */}
          {isDrawerOpen && (
            <div className="scanned-queue-list">
              {batchSession.items.length === 0 ? (
                <p style={{ fontSize: '12px', color: 'var(--foreground-muted)', textAlign: 'center', padding: '12px 0' }}>
                  No answer sheets scanned yet.
                </p>
              ) : (
                batchSession.items.map((item) => (
                  <div
                    key={item.id}
                    className={`scanned-queue-card ${item.status !== 'CLEAN' ? 'flagged' : ''}`}
                  >
                    <div>
                      <strong style={{ color: 'var(--foreground)', display: 'block' }}>
                        {item.learnerName || 'Generic Sheet (Requires Assignment)'}
                      </strong>
                      <span style={{ color: 'var(--foreground-muted)', fontSize: '11px' }}>
                        Score: {formatScore(item.totals.rawScore)} / {item.totals.possiblePoints} pts
                        {item.reviewReason ? ` · [${item.reviewReason}]` : ''}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button
                        type="button"
                        className="button ghost text-xs"
                        style={{ padding: '3px 8px' }}
                        onClick={() => setReviewingItem(item)}
                      >
                        Inspect
                      </button>
                      <button
                        type="button"
                        className="icon-button"
                        style={{ color: '#ef4444' }}
                        onClick={() => handleRemoveItem(item.id)}
                        aria-label="Delete scan"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Action Buttons & Commit Gate */}
          <div className="scanner-actions-bar">
            <button
              type="button"
              className="button ghost text-xs"
              onClick={() => {
                if (window.confirm('Clear all uncommitted scans in this batch?')) {
                  setBatchSession((prev) => ({ ...prev, items: [] }))
                  clearBatchScanSession(session.id)
                }
              }}
              disabled={batchSession.items.length === 0}
            >
              Clear Batch
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {hasUnresolvedItems && (
                <span style={{ fontSize: '11.5px', fontWeight: 600, color: '#d97706' }}>
                  Resolve all flagged sheets before committing
                </span>
              )}
              <button
                type="button"
                className="button primary"
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                disabled={batchSession.items.length === 0 || hasUnresolvedItems}
                onClick={handleCommitBatch}
              >
                <Save size={15} />
                <span>Commit {batchSession.items.length} Scans to Session</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Review Modal for Individual Sheet Inspection */}
      {reviewingItem && (
        <AnswerSheetReviewModal
          isOpen={Boolean(reviewingItem)}
          scanResult={reviewingItem.scanResult}
          session={session}
          existingOutcomes={session.itemOutcomes}
          scannedFingerprints={scannedFingerprints}
          aiAutoGradeConsent={aiAutoGradeConsent}
          onToggleAiConsent={handleToggleAiConsent}
          onConfirm={(learnerId, updatedOutcomes) => {
            const totals = calculateResultTotals(updatedOutcomes)
            const learner = session.learners.find((l) => l.learnerId === learnerId)

            setBatchSession((prev) => ({
              ...prev,
              items: prev.items.map((i) =>
                i.id === reviewingItem.id
                  ? {
                      ...i,
                      learnerId,
                      participantId: learner?.participantId,
                      learnerName: learner?.displayName,
                      outcomes: updatedOutcomes,
                      totals,
                      status: 'CLEAN',
                      reviewReason: undefined,
                    }
                  : i,
              ),
            }))
            setReviewingItem(null)
          }}
          onClose={() => setReviewingItem(null)}
        />
      )}
    </div>
  )
}
