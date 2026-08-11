import { useCallback, useMemo } from 'react'
import type { AssessmentGenerationFailure } from '../lib/assessmentGenerationResume'
import type { AssessmentPreparationStage } from '../pages/assessmentUi'
import { assessmentPreparationStageLabel } from '../pages/assessmentUi'

export type AssessmentPreparationProgress = {
  processed: number
  total: number
  succeeded: number
  failed: number
  cancelled: number
  remaining: number
}

export type UseAssessmentPreparationOptions = {
  working: boolean
  stage: AssessmentPreparationStage
  progress: AssessmentPreparationProgress
  message?: string
  failures?: AssessmentGenerationFailure[]
  /** Existing page orchestration callback; this hook never reimplements it. */
  onPrepare: () => void | Promise<void>
  onCancel: () => void
}

export type AssessmentPreparationController = {
  working: boolean
  stage: AssessmentPreparationStage
  phaseLabel: string
  progress: AssessmentPreparationProgress
  progressLabel: string
  message: string
  failures: AssessmentGenerationFailure[]
  prepare: () => void | Promise<void>
  cancel: () => void
}

/**
 * UI-facing adapter for the assessment preparation workflow.
 *
 * Generation, checkpointing, visual enrichment, QA, and finalization remain
 * authoritative in AssessmentEditorPage and the existing domain libraries.
 * The page currently has tightly coupled persistence/resume callbacks, so a
 * full extraction would risk changing business behavior. This hook deliberately
 * exposes only translated phase/progress state and guarded actions for Simple
 * and Advanced views.
 */
export function useAssessmentPreparation({
  working,
  stage,
  progress,
  message = '',
  failures = [],
  onPrepare,
  onCancel,
}: UseAssessmentPreparationOptions) {
  const phaseLabel = assessmentPreparationStageLabel(stage)
  const progressLabel = useMemo(() => {
    if (!working) return ''
    if (!progress.total) return phaseLabel
    return `${progress.succeeded} of ${progress.total} complete`
  }, [phaseLabel, progress.succeeded, progress.total, working])

  const prepare = useCallback(() => {
    if (working) return
    return onPrepare()
  }, [onPrepare, working])

  const cancel = useCallback(() => {
    if (!working) return
    onCancel()
  }, [onCancel, working])

  return {
    working,
    stage,
    phaseLabel,
    progress,
    progressLabel,
    message,
    failures,
    prepare,
    cancel,
  } satisfies AssessmentPreparationController
}
