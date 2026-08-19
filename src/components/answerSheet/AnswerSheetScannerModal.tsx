import { AlertTriangle, Camera, Check, ChevronUp, ChevronDown, CircleAlert, FileImage, Flashlight, FlashlightOff, Layers, ListChecks, Play, RefreshCw, Save, Sparkles, Trash2, Upload, UserCheck, X, Zap } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { AssessmentResultSession, ResultItemOutcome } from '../../types/results'
import type { BatchScanItem, BatchScanSession } from '../../types/batchScan'
import type { OmrImageBuffer, OmrScanResult } from '../../types/omr'
import { useCameraStream } from '../../hooks/useCameraStream'
import { detectFiducialCorners } from '../../lib/omr/cornerDetection'
import { processAnswerSheetImage } from '../../lib/omr/omrEngine'
import { matchScanToLearner } from '../../lib/omr/learnerMatching'
import { omrRecognitionsToLearnerAnswers } from '../../lib/omr/omrResultsAdapter'
import { checkDuplicateScan, resolveDuplicateOutcomes } from '../../lib/omr/duplicateSafety'
import { triggerScanSuccessFeedback, triggerScanWarningFeedback } from '../../lib/omr/scanFeedback'
import { calculateBatchSummary, clearBatchScanSession, loadBatchScanSession, saveBatchScanSession } from '../../lib/omr/batchScanStorage'
import { calculateResultTotals, formatScore, scoreAnswerSheet } from '../../lib/resultsScoring'
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

  const [isScanningActive, setIsScanningActive] = useState(true)
  const [feedbackMessage, setFeedbackMessage] = useState<string>('Position answer sheet within camera frame')
  const [feedbackStatus, setFeedbackStatus] = useState<'idle' | 'detecting' | 'scanned' | 'error'>('idle')
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [reviewingItem, setReviewingItem] = useState<BatchScanItem | null>(null)
  const [isProcessingFrame, setIsProcessingFrame] = useState(false)

  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const stableFrameCountRef = useRef(0)
  const cooldownRef = useRef(false)
  const timerRef = useRef<number | null>(null)

  const {
    isStreaming,
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
        expectedAssessmentId: session.assessmentSnapshot.assessmentId,
        expectedVersionNumber: session.assessmentSnapshot.assessmentVersionNumber,
      })

      if (!scanResult.success) {
        triggerScanWarningFeedback()
        setFeedbackStatus('error')
        setFeedbackMessage(scanResult.errorMessage || 'Scan failed. Please adjust lighting and try again.')
        return
      }

      // Match learner
      const match = matchScanToLearner(scanResult, session.learners, scannedLearnerIds)
      const learner = match.matchedLearner || session.learners.find((l) => !scannedLearnerIds.has(l.learnerId)) || null

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
        status: duplicateCheck.hasCollision
          ? 'DUPLICATE'
          : scanResult.needsReview
          ? 'NEEDS_REVIEW'
          : 'CLEAN',
        reviewReason: duplicateCheck.hasCollision ? duplicateCheck.message : undefined,
      }

      // Add to batch session
      setBatchSession((prev) => ({
        ...prev,
        updatedAt: new Date().toISOString(),
        items: [newItem, ...prev.items],
      }))

      triggerScanSuccessFeedback()
      setFeedbackStatus('scanned')
      setFeedbackMessage(`✓ Scanned: ${learner?.displayName || 'Student Sheet'} (${totals.rawScore}/${totals.possiblePoints} pts)`)

      // Set cooldown before next sheet
      cooldownRef.current = true
      setTimeout(() => {
        cooldownRef.current = false
        setFeedbackStatus('idle')
        setFeedbackMessage('Ready for next paper')
      }, 1400)
    } catch (err) {
      console.error('[AnswerSheetScannerModal] Frame processing error', err)
      setFeedbackStatus('error')
      setFeedbackMessage('Unable to process sheet. Ensure proper lighting.')
    }
  }, [session, scannedLearnerIds, scannedFingerprints])

  // Continuous frame processing loop
  const processLiveFrame = useCallback(() => {
    if (!isOpen || !isScanningActive || !isStreaming || isProcessingFrame || cooldownRef.current) {
      return
    }

    // 1. Quick downscaled check for 4 corners (fast and power-efficient)
    const downscaled = captureFrame(2)
    if (!downscaled) return

    const cornerCheck = detectFiducialCorners(downscaled)

    if (!cornerCheck.success || !cornerCheck.corners) {
      stableFrameCountRef.current = 0
      setFeedbackStatus('idle')
      setFeedbackMessage('Align all 4 corner markers inside the frame')
      return
    }

    stableFrameCountRef.current++
    setFeedbackStatus('detecting')
    setFeedbackMessage('Markers aligned! Hold steady…')

    // When aligned for 2 consecutive ticks, trigger full capture
    if (stableFrameCountRef.current >= 2) {
      stableFrameCountRef.current = 0
      setIsProcessingFrame(true)

      const fullFrame = captureFrame(1)
      if (!fullFrame) {
        setIsProcessingFrame(false)
        return
      }

      try {
        handleProcessImageBuffer(fullFrame)
      } finally {
        setIsProcessingFrame(false)
      }
    }
  }, [
    isOpen,
    isScanningActive,
    isStreaming,
    isProcessingFrame,
    captureFrame,
    handleProcessImageBuffer,
  ])

  useEffect(() => {
    if (!isOpen || !isScanningActive) return

    timerRef.current = window.setInterval(processLiveFrame, 160)

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
    }
  }, [isOpen, isScanningActive, processLiveFrame])

  function handleFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width = img.naturalWidth || img.width
        canvas.height = img.naturalHeight || img.height

        const ctx = canvas.getContext('2d')
        if (!ctx) return

        ctx.drawImage(img, 0, 0)
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const rgba = imgData.data
        const grayscale = new Uint8Array(canvas.width * canvas.height)

        for (let i = 0, j = 0; i < rgba.length; i += 4, j++) {
          grayscale[j] = Math.round(0.299 * rgba[i] + 0.587 * rgba[i + 1] + 0.114 * rgba[i + 2])
        }

        handleProcessImageBuffer({
          width: canvas.width,
          height: canvas.height,
          data: grayscale,
        })
      }
      img.src = String(event.target?.result || '')
    }
    reader.readAsDataURL(file)

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  function handleRemoveItem(itemId: string) {
    setBatchSession((prev) => ({
      ...prev,
      items: prev.items.filter((i) => i.id !== itemId),
    }))
  }

  function handleCommitBatch() {
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
        <div className="scanner-header flex items-center justify-between p-3 bg-neutral-900 text-white">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs px-2 py-0.5 rounded bg-primary text-primary-foreground font-bold uppercase tracking-wider">
                Burst Mode
              </span>
              <strong className="text-sm font-semibold">{session.sectionName} · Smart Scan</strong>
            </div>
            <span className="text-xs text-neutral-400 block mt-0.5">
              {session.assessmentSnapshot.assessmentTitle}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              className="button ghost compact text-white hover:bg-neutral-800 text-xs flex items-center gap-1.5"
              onClick={() => fileInputRef.current?.click()}
              title="Upload photo or take with native camera"
            >
              <Upload size={16} />
              <span>Upload Photo</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              style={{ display: 'none' }}
              onChange={handleFileInputChange}
            />

            {hasTorch && (
              <button
                type="button"
                className="icon-button text-white hover:bg-neutral-800"
                onClick={() => void toggleTorch()}
                aria-label={isTorchOn ? 'Turn flashlight off' : 'Turn flashlight on'}
              >
                {isTorchOn ? <Flashlight size={20} className="text-amber-400" /> : <FlashlightOff size={20} />}
              </button>
            )}
            <button
              type="button"
              className="icon-button text-white hover:bg-neutral-800"
              onClick={onClose}
              aria-label="Close scanner"
            >
              <X size={22} />
            </button>
          </div>
        </div>

        {/* Live Camera Viewfinder or Camera Fallback */}
        <div className="scanner-viewfinder-container relative flex-1 bg-black flex items-center justify-center overflow-hidden">
          {cameraError ? (
            <div className="camera-fallback-panel p-6 text-center text-white max-w-sm">
              <CircleAlert size={48} className="text-amber-400 mx-auto mb-3" />
              <strong className="text-lg block font-bold">Camera Access Unavailable</strong>
              <p className="text-sm text-neutral-400 my-2">
                {cameraError}. You can still upload photos of the answer sheet directly from your device.
              </p>
              <button
                type="button"
                className="button primary mt-4 w-full flex items-center justify-center gap-2"
                onClick={() => fileInputRef.current?.click()}
              >
                <FileImage size={18} />
                <span>Select / Capture Photo</span>
              </button>
            </div>
          ) : (
            <>
              <video
                ref={videoRef}
                className="scanner-video-preview w-full h-full object-cover"
                playsInline
                muted
                autoPlay
              />

              {/* Corner Alignment Overlay Guide */}
              <div className="viewfinder-alignment-guide pointer-events-none absolute inset-6 md:inset-12 border-2 border-dashed border-white/60 rounded-xl flex flex-col justify-between p-2">
                {/* Top Corners */}
                <div className="flex justify-between">
                  <div className="w-8 h-8 border-t-4 border-l-4 border-primary rounded-tl" />
                  <div className="w-8 h-8 border-t-4 border-r-4 border-primary rounded-tr" />
                </div>
                {/* Bottom Corners */}
                <div className="flex justify-between">
                  <div className="w-8 h-8 border-b-4 border-l-4 border-primary rounded-bl" />
                  <div className="w-8 h-8 border-b-4 border-r-4 border-primary rounded-br" />
                </div>
              </div>

              {/* Live Status Toast Banner */}
              <div
                className={`scanner-status-pill absolute top-4 px-4 py-2 rounded-full text-xs font-semibold text-white shadow-lg transition-all flex items-center gap-2 ${
                  feedbackStatus === 'scanned'
                    ? 'bg-emerald-600 scale-105'
                    : feedbackStatus === 'detecting'
                    ? 'bg-amber-600 animate-pulse'
                    : feedbackStatus === 'error'
                    ? 'bg-rose-600'
                    : 'bg-neutral-900/80 backdrop-blur'
                }`}
              >
                {feedbackStatus === 'scanned' ? (
                  <Check size={16} />
                ) : feedbackStatus === 'detecting' ? (
                  <RefreshCw size={14} className="spin" />
                ) : feedbackStatus === 'error' ? (
                  <CircleAlert size={16} />
                ) : (
                  <Camera size={14} />
                )}
                <span>{feedbackMessage}</span>
              </div>
            </>
          )}
        </div>

        {/* Bottom Tray / Batch Summary Counter */}
        <div className="scanner-bottom-tray bg-surface border-t border-border p-3">
          {/* Metrics summary bar */}
          <div className="flex items-center justify-between pb-2 border-b border-border text-xs">
            <div className="flex items-center gap-3">
              <div>
                <span className="text-foreground-muted block">Scanned</span>
                <strong className="text-sm font-bold text-foreground">
                  {summary.totalScanned} / {summary.totalRosterCount}
                </strong>
              </div>
              <div className="border-l border-border pl-3">
                <span className="text-foreground-muted block">Clean</span>
                <strong className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                  {summary.cleanCount}
                </strong>
              </div>
              {summary.needsReviewCount > 0 && (
                <div className="border-l border-border pl-3">
                  <span className="text-foreground-muted block">Review</span>
                  <strong className="text-sm font-bold text-amber-600 dark:text-amber-400">
                    {summary.needsReviewCount}
                  </strong>
                </div>
              )}
            </div>

            <button
              type="button"
              className="button ghost text-xs flex items-center gap-1"
              onClick={() => setIsDrawerOpen(!isDrawerOpen)}
            >
              <ListChecks size={14} />
              <span>{isDrawerOpen ? 'Hide Queue' : `Queue (${batchSession.items.length})`}</span>
              {isDrawerOpen ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
            </button>
          </div>

          {/* Collapsible Scanned Items Queue */}
          {isDrawerOpen && (
            <div className="scanned-queue-list max-h-48 overflow-y-auto my-2 space-y-1.5 pr-1">
              {batchSession.items.length === 0 ? (
                <p className="text-xs text-foreground-muted text-center py-3">No answer sheets scanned yet.</p>
              ) : (
                batchSession.items.map((item) => (
                  <div
                    key={item.id}
                    className="scanned-queue-card flex items-center justify-between p-2 rounded bg-surface-muted border border-border text-xs"
                  >
                    <div>
                      <strong className="text-foreground block">{item.learnerName || 'Generic Sheet'}</strong>
                      <span className="text-foreground-muted">
                        Score: {formatScore(item.totals.rawScore)} / {item.totals.possiblePoints} pts
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="button ghost text-xs py-1 px-2"
                        onClick={() => setReviewingItem(item)}
                      >
                        Inspect
                      </button>
                      <button
                        type="button"
                        className="icon-button text-rose-500"
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

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-2">
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
              Clear
            </button>

            <button
              type="button"
              className="button primary flex items-center gap-1.5"
              disabled={batchSession.items.length === 0}
              onClick={handleCommitBatch}
            >
              <Save size={16} />
              <span>Commit {batchSession.items.length} Scans to Session</span>
            </button>
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
