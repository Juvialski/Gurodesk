import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  CheckSquare,
  ClipboardCheck,
  Clock,
  FileCheck2,
  FileText,
  Layers,
  ListOrdered,
  PauseCircle,
  Plus,
  ShieldCheck,
  Sparkles,
  Table,
  Users,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { EmptyState } from '../components/EmptyState'
import { PageHeader } from '../components/PageHeader'
import { useApp } from '../contexts/AppContext'
import {
  applyAssessmentItemSuggestion,
  applyCheckpointedAssessmentItemSuggestion,
  assessmentItemNeedsQuestionGeneration,
  enrichAssessmentVisualsSequentially,
  generateAssessmentItemSuggestion,
  hasExistingAssessmentContent,
} from '../lib/assessmentGeneration'
import { createAssessmentMasterPlan } from '../lib/assessmentMasterPlanner'
import {
  minimumAssessmentV2Points,
  validateAssessmentV2Setup,
  type AssessmentV2Setup,
} from '../lib/assessmentGenerationV2'
import {
  createAssessmentFromLessonPlan,
  createAssessmentFromMasterPlan,
  createAssessmentPerformanceTask,
  createAssessmentFromUnitLessons,
  saveAssessmentDocument,
  saveAssessmentItemVisualCheckpoint,
} from '../lib/assessmentRepository'
import { loadLessonPlans } from '../lib/repository'
import { loadTosDocuments } from '../lib/tosRepository'
import { DEFAULT_ASSESSMENT_SETTINGS } from '../lib/assessmentBlueprint'
import { applyQuestionTypeDistributionToEmptySlots } from '../lib/assessmentDistribution'
import {
  ASSESSMENT_QUESTION_TYPES,
  type AssessmentCpdKey,
  type AssessmentMode,
  type AssessmentRecord,
  type AssessmentSettings,
  type AssessmentVisualPolicy,
  type PerformanceTaskGrouping,
  type QuestionType,
} from '../types/assessment'
import type { TeacherAssignment } from '../types/app'
import type { LessonPlanRecord } from '../types/lessonPlan'
import type { TosRecord } from '../types/tos'
import { extractErrorMessage, typeLabel } from './assessmentUi'

const DEFAULT_TYPES: QuestionType[] = [...ASSESSMENT_QUESTION_TYPES]
const CPD_ORDER: AssessmentCpdKey[] = [
  'remembering',
  'understanding',
  'applying',
  'analyzing',
  'evaluating',
  'creating',
  'other',
]
const CPD_LABELS: Record<AssessmentCpdKey, string> = {
  remembering: 'Remembering',
  understanding: 'Understanding',
  applying: 'Applying',
  analyzing: 'Analyzing',
  evaluating: 'Evaluating',
  creating: 'Creating',
  other: 'Other',
}

function getLessonGrade(lesson: LessonPlanRecord | null | undefined) {
  return lesson?.content?.gradeLevel || ''
}
function getLessonSubject(lesson: LessonPlanRecord | null | undefined) {
  return lesson?.content?.learningArea || ''
}
function getLessonCompetencies(lesson: LessonPlanRecord | null | undefined) {
  if (!lesson?.content) return []
  if (lesson.content.curriculumAlignments && lesson.content.curriculumAlignments.length > 0) {
    return lesson.content.curriculumAlignments
  }
  if (lesson.content.competency) {
    return [lesson.content.competency]
  }
  return []
}
function getLessonObjectives(lesson: LessonPlanRecord | null | undefined): string[] {
  const obj = lesson?.content?.intentions?.learningObjectives
  if (Array.isArray(obj)) return obj
  if (typeof obj === 'string' && obj.trim()) return [obj.trim()]
  return []
}

function assignmentLabel(assignment: TeacherAssignment | undefined, fallback = 'Linked teaching assignment') {
  if (!assignment) return fallback
  return [assignment.gradeLevel, assignment.learningArea, assignment.schoolYear].filter(Boolean).join(' · ')
}

function TeachingAssignmentField({
  assignments,
  assignmentId,
  linkedAssignmentId,
  linkedFallbackLabel,
  conflictMessage,
  onChange,
}: {
  assignments: TeacherAssignment[]
  assignmentId: string
  linkedAssignmentId?: string | null
  linkedFallbackLabel?: string
  conflictMessage?: string
  onChange: (assignmentId: string) => void
}) {
  if (conflictMessage) {
    return <div className="form-message error" role="alert">{conflictMessage}</div>
  }

  if (linkedAssignmentId) {
    const linkedAssignment = assignments.find((assignment) => assignment.id === linkedAssignmentId)
    return (
      <div className="form-group">
        <label className="field-label"><strong>Teaching Assignment</strong></label>
        <div className="form-message">
          <strong>{assignmentLabel(linkedAssignment, linkedFallbackLabel)}</strong>
          <br />This source is already linked to a teaching assignment, so the assessment will keep that class context.
        </div>
      </div>
    )
  }

  return (
    <div className="form-group">
      <label className="field-label" htmlFor="assessment-teaching-assignment">
        <strong>Teaching Assignment</strong>
        <span className="field-hint">This older source is not linked to a class yet. Choose where this assessment belongs.</span>
      </label>
      {assignments.length ? (
        <select
          id="assessment-teaching-assignment"
          className="select"
          value={assignmentId}
          onChange={(event) => onChange(event.target.value)}
        >
          <option value="">Choose teaching assignment</option>
          {assignments.map((assignment) => (
            <option key={assignment.id} value={assignment.id}>
              {assignmentLabel(assignment)}
            </option>
          ))}
        </select>
      ) : (
        <div className="form-message error" role="alert">
          No active teaching assignment is available. <Link to="/classes">Set up a class first.</Link>
        </div>
      )}
    </div>
  )
}

type SetupStep = 1 | 2 | 3
type GenerationStage = 'planning' | 'questions' | 'visuals' | 'finishing' | 'paused'
type GenerationState = {
  stage: GenerationStage
  current: number
  total: number
  message: string
  model?: string
}

type CreationMode = 'tos' | 'lesson_quiz' | 'unit_quiz' | 'performance_task'

function replaceItem(record: AssessmentRecord, item: AssessmentRecord['items'][number]): AssessmentRecord {
  return { ...record, items: record.items.map((candidate) => (candidate.id === item.id ? item : candidate)) }
}

export function AssessmentNewPage() {
  const { user, isDemo, assignments } = useApp()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  // Creation Mode
  const initialMode = (searchParams.get('mode') as CreationMode) || 'tos'
  const [mode, setMode] = useState<CreationMode>(initialMode)

  // Data sources
  const [tosDocuments, setTosDocuments] = useState<TosRecord[]>([])
  const [lessonPlans, setLessonPlans] = useState<LessonPlanRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  // TOS Mode State
  const [selectedTosId, setSelectedTosId] = useState(searchParams.get('tos') ?? '')
  const [tosTitle, setTosTitle] = useState('')
  const [tosInstructions, setTosInstructions] = useState('')
  const [generationInstructions, setGenerationInstructions] = useState('')
  const [totalPoints, setTotalPoints] = useState(40)
  const [pointsTouched, setPointsTouched] = useState(false)
  const [allowedTypes, setAllowedTypes] = useState<QuestionType[]>(DEFAULT_TYPES)
  const [visualPolicy, setVisualPolicy] = useState<AssessmentVisualPolicy>('off')
  const [step, setStep] = useState<SetupStep>(1)
  const [generation, setGeneration] = useState<GenerationState | null>(null)
  const [workingRecord, setWorkingRecord] = useState<AssessmentRecord | null>(null)
  const controllerRef = useRef<AbortController | null>(null)

  // Lesson Quiz State
  const [selectedLessonId, setSelectedLessonId] = useState(searchParams.get('lesson') ?? '')
  const [quizTitle, setQuizTitle] = useState('')
  const [quizItemCount, setQuizItemCount] = useState(10)
  const [quizInstructions, setQuizInstructions] = useState('')
  const [quizAllowedTypes, setQuizAllowedTypes] = useState<QuestionType[]>([
    'multiple_choice',
    'true_false',
    'short_answer',
    'identification',
    'fill_in_the_blank',
  ])

  const [lessonQuizAssignmentId, setLessonQuizAssignmentId] = useState('')

  // Unit Quiz State
  const [selectedUnitLessonIds, setSelectedUnitLessonIds] = useState<string[]>([])
  const [unitTitle, setUnitTitle] = useState('')
  const [unitTotalItems, setUnitTotalItems] = useState(20)
  const [unitInstructions, setUnitInstructions] = useState('')
  const [unitAllowedTypes, setUnitAllowedTypes] = useState<QuestionType[]>([
    'multiple_choice',
    'true_false',
    'short_answer',
    'identification',
    'fill_in_the_blank',
  ])

  const [unitQuizAssignmentId, setUnitQuizAssignmentId] = useState('')

  // Performance Task State
  const [ptSourceType, setPtSourceType] = useState<'lesson' | 'tos' | 'custom'>('lesson')
  const [ptSelectedLessonId, setPtSelectedLessonId] = useState('')
  const [ptSelectedTosId, setPtSelectedTosId] = useState('')
  const [ptTitle, setPtTitle] = useState('')
  const [ptScenario, setPtScenario] = useState('')
  const [ptExpectedOutput, setPtExpectedOutput] = useState('')
  const [ptGrouping, setPtGrouping] = useState<PerformanceTaskGrouping>('individual')
  const [ptDuration, setPtDuration] = useState('1-2 class sessions')
  const [ptInstructions, setPtInstructions] = useState('')

  const [performanceTaskAssignmentId, setPerformanceTaskAssignmentId] = useState('')

  useEffect(() => {
    if (!user) return
    let active = true
    setLoading(true)
    Promise.all([
      loadTosDocuments(user.id, isDemo),
      loadLessonPlans(user.id, isDemo),
    ])
      .then(([tosDocs, lessons]) => {
        if (!active) return
        const finals = tosDocs.filter((document) => document.status === 'final')
        setTosDocuments(finals)
        setLessonPlans(lessons)

        const requestedTos = finals.find((document) => document.id === searchParams.get('tos'))
        const defaultTosId = requestedTos?.id ?? finals[0]?.id ?? ''
        setSelectedTosId(defaultTosId)
        setPtSelectedTosId(defaultTosId)

        const requestedLesson = lessons.find((document) => document.id === searchParams.get('lesson'))
        if (requestedLesson) {
          setSelectedLessonId(requestedLesson.id)
          setPtSelectedLessonId(requestedLesson.id)
          if (searchParams.get('mode') === 'lesson_quiz') setMode('lesson_quiz')
          if (searchParams.get('mode') === 'performance_task') setMode('performance_task')
        } else if (lessons.length > 0) {
          setSelectedLessonId(lessons[0].id)
          setPtSelectedLessonId(lessons[0].id)
          if (lessons.length >= 2) {
            const firstLesson = lessons[0]
            const compatibleSecond = lessons.slice(1).find((lesson) =>
              !firstLesson.assignmentId || !lesson.assignmentId || lesson.assignmentId === firstLesson.assignmentId
            )
            setSelectedUnitLessonIds([firstLesson.id, (compatibleSecond ?? lessons[1]).id])
          }
        }
      })
      .catch((nextError) => {
        if (active) setError(extractErrorMessage(nextError, 'Unable to load curriculum sources.'))
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [user?.id, isDemo, searchParams])

  const selectedTos = useMemo(
    () => tosDocuments.find((document) => document.id === selectedTosId) ?? null,
    [tosDocuments, selectedTosId]
  )

  const selectedLesson = useMemo(
    () => lessonPlans.find((lesson) => lesson.id === selectedLessonId) ?? null,
    [lessonPlans, selectedLessonId]
  )

  const selectedUnitLessons = useMemo(
    () => lessonPlans.filter((lesson) => selectedUnitLessonIds.includes(lesson.id)),
    [lessonPlans, selectedUnitLessonIds]
  )

  const selectedPerformanceLesson = useMemo(
    () => lessonPlans.find((lesson) => lesson.id === ptSelectedLessonId) ?? null,
    [lessonPlans, ptSelectedLessonId]
  )

  const selectedPerformanceTos = useMemo(
    () => tosDocuments.find((tos) => tos.id === ptSelectedTosId) ?? null,
    [tosDocuments, ptSelectedTosId]
  )

  const unitLinkedAssignmentIds = useMemo(
    () => [...new Set(selectedUnitLessons.map((lesson) => lesson.assignmentId).filter((id): id is string => Boolean(id)))],
    [selectedUnitLessons]
  )
  const unitAssignmentConflict = unitLinkedAssignmentIds.length > 1
  const linkedUnitAssignmentId = unitLinkedAssignmentIds.length === 1 ? unitLinkedAssignmentIds[0] : null
  const linkedPerformanceAssignmentId = ptSourceType === 'lesson'
    ? selectedPerformanceLesson?.assignmentId ?? null
    : ptSourceType === 'tos'
      ? selectedPerformanceTos?.assignmentId ?? null
      : null

  const resolvedLessonQuizAssignmentId = selectedLesson?.assignmentId ?? lessonQuizAssignmentId
  const resolvedUnitQuizAssignmentId = linkedUnitAssignmentId ?? unitQuizAssignmentId
  const resolvedPerformanceTaskAssignmentId = linkedPerformanceAssignmentId ?? performanceTaskAssignmentId

  useEffect(() => {
    setLessonQuizAssignmentId(
      selectedLesson?.assignmentId ?? (assignments.length === 1 ? assignments[0].id : '')
    )
  }, [selectedLesson?.id, selectedLesson?.assignmentId, assignments])

  useEffect(() => {
    setUnitQuizAssignmentId(
      unitAssignmentConflict
        ? ''
        : linkedUnitAssignmentId ?? (assignments.length === 1 ? assignments[0].id : '')
    )
  }, [unitAssignmentConflict, linkedUnitAssignmentId, assignments])

  useEffect(() => {
    setPerformanceTaskAssignmentId(
      linkedPerformanceAssignmentId ?? (assignments.length === 1 ? assignments[0].id : '')
    )
  }, [ptSourceType, ptSelectedLessonId, ptSelectedTosId, linkedPerformanceAssignmentId, assignments])

  useEffect(() => {
    if (!selectedTos || pointsTouched || !allowedTypes.length) return
    const sourceSize = Number(selectedTos.content.totalItems)
    try {
      const minimum = minimumAssessmentV2Points(selectedTos, allowedTypes)
      const suggested = Math.max(Number.isSafeInteger(sourceSize) && sourceSize > 0 ? sourceSize : 1, minimum)
      setTotalPoints(suggested)
    } catch {
      if (Number.isSafeInteger(sourceSize) && sourceSize > 0) setTotalPoints(sourceSize)
    }
  }, [selectedTos?.id, pointsTouched, allowedTypes])

  const setup = useMemo<AssessmentV2Setup>(
    () => ({
      totalPoints,
      allowedTypes,
      visualPolicy: 'off',
      generationInstructions: generationInstructions.trim(),
    }),
    [totalPoints, allowedTypes, generationInstructions]
  )

  const setupValidation = useMemo(() => validateAssessmentV2Setup(selectedTos, setup), [selectedTos, setup])
  const cpdSummary = useMemo(() => {
    const totals = new Map<AssessmentCpdKey, number>()
    setupValidation.pointBuckets.forEach((bucket) =>
      totals.set(bucket.cpdKey, (totals.get(bucket.cpdKey) ?? 0) + bucket.pointsAllocated)
    )
    return CPD_ORDER.filter((key) => (totals.get(key) ?? 0) > 0).map((key) => ({
      key,
      label: CPD_LABELS[key],
      points: totals.get(key) ?? 0,
    }))
  }, [setupValidation.pointBuckets])

  function toggleType(type: QuestionType) {
    setAllowedTypes((current) =>
      current.includes(type) ? current.filter((entry) => entry !== type) : [...current, type]
    )
  }

  function toggleQuizType(type: QuestionType) {
    setQuizAllowedTypes((current) =>
      current.includes(type) ? current.filter((entry) => entry !== type) : [...current, type]
    )
  }

  function toggleUnitQuizType(type: QuestionType) {
    setUnitAllowedTypes((current) =>
      current.includes(type) ? current.filter((entry) => entry !== type) : [...current, type]
    )
  }

  function toggleUnitLesson(lessonId: string) {
    setSelectedUnitLessonIds((current) =>
      current.includes(lessonId) ? current.filter((id) => id !== lessonId) : [...current, lessonId]
    )
  }

  // --- Full Assessment Generation Pipeline ---
  async function runAssessmentGenerationPipeline(
    initialRecord: AssessmentRecord,
    options: { teacherContext?: string; modelLabel?: string } = {}
  ) {
    if (!user) return
    controllerRef.current?.abort()
    const controller = new AbortController()
    controllerRef.current = controller
    setError('')
    let working = initialRecord
    let activeQuestion: AssessmentRecord['items'][number] | null = null
    try {
      const pendingQuestions = working.items.filter(assessmentItemNeedsQuestionGeneration)
      let completedQuestions = working.items.length - pendingQuestions.length
      setGeneration({
        stage: 'questions',
        current: completedQuestions,
        total: working.items.length,
        message: pendingQuestions.length
          ? 'Generating questions from curriculum alignment…'
          : 'All questions are already saved.',
      })

      for (const pending of pendingQuestions) {
        if (controller.signal.aborted) throw new DOMException('Generation cancelled.', 'AbortError')
        const source = working.items.find((item) => item.id === pending.id) ?? pending
        activeQuestion = source
        setGeneration({
          stage: 'questions',
          current: completedQuestions,
          total: working.items.length,
          message: `Generating Question ${source.itemNumber} · ${typeLabel(source.questionType)}…`,
        })
        let checkpointedQuestion: AssessmentRecord['items'][number] | null = null
        const recoveringBlankMachineDraft = hasExistingAssessmentContent(source)
        const suggestion = await generateAssessmentItemSuggestion({
          assessment: working,
          item: source,
          demo: isDemo,
          alternative: recoveringBlankMachineDraft,
          teacherContext: options.teacherContext ?? '',
          signal: controller.signal,
          onQuestionReady: async (draftSuggestion) => {
            const savedDraftItem = applyAssessmentItemSuggestion(source, draftSuggestion, {
              alternative: recoveringBlankMachineDraft,
              source: 'generated',
            })
            checkpointedQuestion = savedDraftItem
            working = replaceItem(working!, savedDraftItem)
            working = await saveAssessmentDocument(working, isDemo)
            setWorkingRecord(working)
          },
        })
        const currentItem = working.items.find((item) => item.id === source.id) ?? source
        if (!checkpointedQuestion) {
          throw new Error('The generated question was not checkpointed before QA completed.')
        }
        const finishedItem = applyCheckpointedAssessmentItemSuggestion(currentItem, checkpointedQuestion, suggestion)
        working = replaceItem(working, finishedItem)
        working = await saveAssessmentDocument(working, isDemo)
        setWorkingRecord(working)
        completedQuestions += 1
        activeQuestion = null
        setGeneration({
          stage: 'questions',
          current: completedQuestions,
          total: working.items.length,
          message: `Question ${completedQuestions} of ${working.items.length} saved.`,
        })
        if (suggestion.quotaPaused) {
          throw new Error(
            'Generation paused after saving the current question because the active AI capacity was exhausted. Retry to continue from the saved checkpoint.'
          )
        }
      }

      // Assessment diagrams are temporarily disabled for every creation mode.
      // Keep this stage empty so question generation goes straight to review.
      const visualIds: string[] = []
      if (visualIds.length) {
        setGeneration({ stage: 'visuals', current: 0, total: visualIds.length, message: 'Creating planned diagrams…' })
        const visualSummary = await enrichAssessmentVisualsSequentially({
          assessment: working,
          demo: isDemo,
          itemIds: visualIds,
          signal: controller.signal,
          onItem: async (item) => {
            working = replaceItem(working!, item)
            working = await saveAssessmentItemVisualCheckpoint(working, item, isDemo)
            setWorkingRecord(working)
          },
          onProgress: (progress) =>
            setGeneration({
              stage: 'visuals',
              current: progress.processed,
              total: progress.total,
              message:
                progress.status === 'success'
                  ? `Diagram ${progress.processed} of ${progress.total} verified and saved.`
                  : `Diagram ${progress.processed} of ${progress.total} needs review.`,
            }),
        })
        if (visualSummary.providerPaused) {
          setGeneration({
            stage: 'finishing',
            current: 1,
            total: 1,
            message: 'Questions complete. Opening review with remaining diagram work flagged…',
          })
        }
      }

      setGeneration({
        stage: 'finishing',
        current: 1,
        total: 1,
        message: 'Preparing the completed assessment for teacher review…',
      })
      const finalSaved = await saveAssessmentDocument(working, isDemo)
      setWorkingRecord(finalSaved)
      navigate(`/assessments/${finalSaved.id}?generated=v2`)
    } catch (nextError) {
      if (controller.signal.aborted || (nextError instanceof DOMException && nextError.name === 'AbortError')) {
        setGeneration({ stage: 'paused', current: 0, total: 1, message: 'Generation stopped. Completed work remains saved.' })
        return
      }
      const detail = extractErrorMessage(nextError, 'Assessment generation paused. Completed work remains saved.')
      const message = activeQuestion
        ? `Question ${activeQuestion.itemNumber} · ${typeLabel(activeQuestion.questionType)}: ${detail}`
        : detail
      setError(message)
      setGeneration({ stage: 'paused', current: 0, total: 1, message })
    }
  }

  // --- Assessment Generator Entry Point ---
  async function generateAssessment(resumeRecord?: AssessmentRecord) {
    if (!user) return
    let working = resumeRecord ?? workingRecord
    if (working) {
      const teacherContext = working.mode === 'lesson_quiz'
        ? quizInstructions.trim()
        : working.mode === 'unit_quiz'
          ? unitInstructions.trim()
          : generationInstructions.trim()
      await runAssessmentGenerationPipeline(working, { teacherContext })
      return
    }

    if (mode === 'tos') {
      if (!selectedTos) return
      const currentValidation = validateAssessmentV2Setup(selectedTos, setup)
      if (!currentValidation.ready) {
        setError(currentValidation.errors[0]?.message ?? 'Complete the assessment setup before generating.')
        return
      }
      controllerRef.current?.abort()
      const controller = new AbortController()
      controllerRef.current = controller
      setError('')
      try {
        setGeneration({ stage: 'planning', current: 0, total: 1, message: 'Designing the full assessment plan…' })
        const planned = await createAssessmentMasterPlan({
          tos: selectedTos,
          setup,
          demo: isDemo,
          title: tosTitle.trim(),
          instructions: tosInstructions.trim(),
          signal: controller.signal,
        })
        setGeneration({
          stage: 'planning',
          current: 1,
          total: 1,
          message: `Master plan ready${planned.model ? ` · ${planned.model}` : ''}`,
          model: planned.model,
        })
        working = await createAssessmentFromMasterPlan(
          selectedTos,
          planned.plan,
          user.id,
          isDemo,
          tosTitle.trim() || undefined,
          tosInstructions.trim(),
          'off',
          generationInstructions.trim(),
          allowedTypes
        )
        setWorkingRecord(working)
        await runAssessmentGenerationPipeline(working, { teacherContext: generationInstructions.trim() })
      } catch (nextError) {
        if (controller.signal.aborted || (nextError instanceof DOMException && nextError.name === 'AbortError')) {
          setGeneration({ stage: 'paused', current: 0, total: 1, message: 'Generation stopped. Completed work remains saved.' })
          return
        }
        const detail = extractErrorMessage(nextError, 'Assessment planning paused.')
        setError(detail)
        setGeneration({ stage: 'paused', current: 0, total: 1, message: detail })
      }
    } else if (mode === 'lesson_quiz') {
      await handleCreateLessonQuiz(true)
    } else if (mode === 'unit_quiz') {
      await handleCreateUnitQuiz(true)
    }
  }

  // --- Lesson Quiz Creation ---
  async function handleCreateLessonQuiz(autoGenerate = true) {
    if (!user || !selectedLesson) return
    if (!resolvedLessonQuizAssignmentId) {
      setError('Choose a teaching assignment before creating this lesson quiz.')
      return
    }
    setCreating(true)
    setError('')
    try {
      let created = await createAssessmentFromLessonPlan(selectedLesson, user.id, isDemo, {
        totalItems: quizItemCount,
        title: quizTitle.trim() || `Quiz: ${selectedLesson.title}`,
        instructions: quizInstructions.trim(),
        assignmentId: resolvedLessonQuizAssignmentId,
      })
      if (quizAllowedTypes.length > 0) {
        const quizSettings: AssessmentSettings = {
          ...DEFAULT_ASSESSMENT_SETTINGS,
          allowedTypes: quizAllowedTypes,
          mode: 'auto_balanced',
        }
        const distribution = applyQuestionTypeDistributionToEmptySlots(created.items, quizSettings)
        created = {
          ...created,
          items: distribution.items,
          settings: {
            ...DEFAULT_ASSESSMENT_SETTINGS,
            ...created.settings,
            allowedTypes: quizAllowedTypes,
            visualPolicy: 'off',
          },
        }
        created = await saveAssessmentDocument(created, isDemo)
      }
      setWorkingRecord(created)
      if (!autoGenerate) {
        navigate(`/assessments/${created.id}`)
        return
      }
      await runAssessmentGenerationPipeline(created, { teacherContext: quizInstructions.trim() })
    } catch (nextError) {
      setError(extractErrorMessage(nextError, 'Unable to create lesson quiz.'))
    } finally {
      setCreating(false)
    }
  }

  // --- Unit Quiz Creation ---
  async function handleCreateUnitQuiz(autoGenerate = true) {
    if (!user || selectedUnitLessons.length < 2) return
    if (unitAssignmentConflict) {
      setError('Selected lessons belong to different teaching assignments. Choose lessons from the same class.')
      return
    }
    if (!resolvedUnitQuizAssignmentId) {
      setError('Choose a teaching assignment before creating this unit quiz.')
      return
    }
    setCreating(true)
    setError('')
    try {
      let created = await createAssessmentFromUnitLessons(selectedUnitLessons, user.id, isDemo, {
        totalItems: unitTotalItems,
        title: unitTitle.trim() || `Unit Assessment (${selectedUnitLessons.length} Lessons)`,
        instructions: unitInstructions.trim(),
        assignmentId: resolvedUnitQuizAssignmentId,
      })
      if (unitAllowedTypes.length > 0) {
        const unitSettings: AssessmentSettings = {
          ...DEFAULT_ASSESSMENT_SETTINGS,
          allowedTypes: unitAllowedTypes,
          mode: 'auto_balanced',
        }
        const distribution = applyQuestionTypeDistributionToEmptySlots(created.items, unitSettings)
        created = {
          ...created,
          items: distribution.items,
          settings: {
            ...DEFAULT_ASSESSMENT_SETTINGS,
            ...created.settings,
            allowedTypes: unitAllowedTypes,
            visualPolicy: 'off',
          },
        }
        created = await saveAssessmentDocument(created, isDemo)
      }
      setWorkingRecord(created)
      if (!autoGenerate) {
        navigate(`/assessments/${created.id}`)
        return
      }
      await runAssessmentGenerationPipeline(created, { teacherContext: unitInstructions.trim() })
    } catch (nextError) {
      setError(extractErrorMessage(nextError, 'Unable to create unit quiz.'))
    } finally {
      setCreating(false)
    }
  }

  // --- Performance Task Creation ---
  async function handleCreatePerformanceTask() {
    if (!user) return
    if (ptSourceType === 'lesson' && !selectedPerformanceLesson) {
      setError('Choose an anchor lesson plan before creating this performance task.')
      return
    }
    if (ptSourceType === 'tos' && !selectedPerformanceTos) {
      setError('Choose a finalized TOS before creating this performance task.')
      return
    }
    if (!resolvedPerformanceTaskAssignmentId) {
      setError('Choose a teaching assignment before creating this performance task.')
      return
    }
    setCreating(true)
    setError('')
    try {
      const sourceLesson = ptSourceType === 'lesson' ? selectedPerformanceLesson ?? undefined : undefined
      const sourceTosDoc = ptSourceType === 'tos' ? selectedPerformanceTos ?? undefined : undefined

      const defaultTaskTitle = ptTitle.trim() || (sourceLesson ? `Performance Task: ${sourceLesson.title}` : 'Authentic Performance Task')
      const created = await createAssessmentPerformanceTask(
        { lesson: sourceLesson, tos: sourceTosDoc },
        user.id,
        isDemo,
        {
          title: defaultTaskTitle,
          instructions: ptInstructions.trim(),
          assignmentId: resolvedPerformanceTaskAssignmentId,
          performanceTask: {
            title: defaultTaskTitle,
            scenario: ptScenario.trim(),
            expectedOutput: ptExpectedOutput.trim(),
            grouping: ptGrouping,
            duration: ptDuration.trim(),
            studentInstructions: ptInstructions.trim(),
            learningObjectives: getLessonObjectives(sourceLesson),
            competencyAlignment:
              getLessonCompetencies(sourceLesson).map((c) => ({
                id: c.id,
                code: c.code ?? null,
                text: c.text,
                sourcePage: c.sourcePage ?? null,
                academicPeriodId: c.academicPeriodId ?? null,
                curriculumPeriodId: c.academicPeriodId ?? null,
                curriculumPeriodLabel: c.curriculumPeriodLabel || '',
                contentStandards: c.contentStandards || [],
                performanceStandards: c.performanceStandards || [],
              })) || [],
          },
        }
      )
      navigate(`/assessments/${created.id}`)
    } catch (nextError) {
      setError(extractErrorMessage(nextError, 'Unable to create performance task.'))
    } finally {
      setCreating(false)
    }
  }

  function cancelGeneration() {
    controllerRef.current?.abort()
  }

  if (loading) {
    return (
      <div className="loading-screen">
        <span className="loader" />
        <strong>Loading assessment sources…</strong>
      </div>
    )
  }

  if (generation) {
    const stageFraction = generation.total > 0 ? Math.max(0, Math.min(1, generation.current / generation.total)) : 0
    const pct =
      generation.stage === 'planning'
        ? Math.max(4, Math.round(stageFraction * 10))
        : generation.stage === 'questions'
          ? Math.round(10 + stageFraction * 65)
          : generation.stage === 'visuals'
            ? Math.round(75 + stageFraction * 20)
            : generation.stage === 'finishing'
              ? 99
              : workingRecord
                ? Math.max(
                    10,
                    Math.round(
                      (workingRecord.items.filter((item) => item.prompt.trim()).length /
                        Math.max(1, workingRecord.items.length)) *
                        65 +
                        10
                    )
                  )
                : 4

    return (
      <main className="assessment-generation-focus" aria-live="polite">
        <div className="assessment-generation-card">
          <span className="assessment-generation-icon">
            <Sparkles size={28} />
          </span>
          <small>Assessment generation</small>
          <h1>{generation.stage === 'paused' ? 'Generation paused' : 'Creating your assessment'}</h1>
          <p>{generation.message}</p>
          <div className="assessment-generation-progress" aria-label="Generation progress">
            <span style={{ width: `${pct}%` }} />
          </div>
          {generation.stage !== 'planning' && generation.stage !== 'finishing' && generation.stage !== 'paused' && (
            <strong>
              {generation.current} / {generation.total}
            </strong>
          )}
          {error && (
            <div className="form-message error" role="alert">
              {error}
            </div>
          )}
          <div className="assessment-generation-actions">
            {generation.stage === 'paused' ? (
              <>
                <button
                  className="button primary"
                  type="button"
                  onClick={() => void generateAssessment(workingRecord ?? undefined)}
                >
                  <Sparkles size={16} /> Retry remaining
                </button>
                <Link className="button ghost" to="/assessments">
                  <ArrowLeft size={16} /> Exit
                </Link>
              </>
            ) : (
              <button className="button ghost" type="button" onClick={cancelGeneration}>
                <PauseCircle size={16} /> Stop safely
              </button>
            )}
          </div>
          <small>
            Question previews stay hidden until generation finishes. Completed questions and diagrams are checkpointed.
          </small>
        </div>
      </main>
    )
  }

  return (
    <>
      <PageHeader
        eyebrow="Assessment studio"
        title="Create assessment"
        description="Choose the assessment model for your classroom: quarterly exams from a Table of Specifications, lesson-aligned formative quizzes, or authentic performance tasks with rubrics."
        actions={
          <Link className="button ghost" to="/assessments">
            <ArrowLeft size={16} /> All assessments
          </Link>
        }
      />

      {/* Mode Selector Tabs */}
      <div className="assessment-mode-selector panel">
        <button
          type="button"
          className={`assessment-mode-card ${mode === 'tos' ? 'selected' : ''}`}
          onClick={() => {
            setMode('tos')
            setStep(1)
            setError('')
          }}
        >
          <span className="mode-icon-badge">
            <ShieldCheck size={20} />
          </span>
          <div className="mode-card-copy">
            <strong>Table of Specifications (TOS)</strong>
            <p>Periodic / Quarterly Exam with frozen DepEd cognitive distribution and competency weights.</p>
          </div>
        </button>

        <button
          type="button"
          className={`assessment-mode-card ${mode === 'lesson_quiz' ? 'selected' : ''}`}
          onClick={() => {
            setMode('lesson_quiz')
            setStep(1)
            setError('')
          }}
        >
          <span className="mode-icon-badge">
            <BookOpen size={20} />
          </span>
          <div className="mode-card-copy">
            <strong>Single-Lesson Quiz</strong>
            <p>Quick 5–15 item formative check generated directly from an active daily lesson plan.</p>
          </div>
        </button>

        <button
          type="button"
          className={`assessment-mode-card ${mode === 'unit_quiz' ? 'selected' : ''}`}
          onClick={() => {
            setMode('unit_quiz')
            setStep(1)
            setError('')
          }}
        >
          <span className="mode-icon-badge">
            <Layers size={20} />
          </span>
          <div className="mode-card-copy">
            <strong>Multi-Lesson Unit Quiz</strong>
            <p>Balanced unit assessment across multiple lessons using proportional item allocation.</p>
          </div>
        </button>

        <button
          type="button"
          className={`assessment-mode-card ${mode === 'performance_task' ? 'selected' : ''}`}
          onClick={() => {
            setMode('performance_task')
            setStep(1)
            setError('')
          }}
        >
          <span className="mode-icon-badge">
            <Table size={20} />
          </span>
          <div className="mode-card-copy">
            <strong>Authentic Performance Task</strong>
            <p>Real-world scenario with 4-level analytic scoring rubric, milestones, and student instructions.</p>
          </div>
        </button>
      </div>

      {error && (
        <div className="form-message error" role="alert" style={{ marginBottom: '1.5rem' }}>
          {error}
        </div>
      )}

      {/* MODE 1: TOS WIZARD */}
      {mode === 'tos' && (
        <div className="assessment-v2-wizard-shell">
          {!tosDocuments.length ? (
            <EmptyState
              icon={ShieldCheck}
              title="Finalize a TOS first"
              description="There are no finalized TOS documents available. Finalize a TOS in the TOS Builder before creating a standardized TOS exam."
            >
              <Link className="button primary" to="/tos">
                <ShieldCheck size={16} /> Open TOS Builder
              </Link>
            </EmptyState>
          ) : (
            <>
              <div className="assessment-v2-stepper" aria-label="Assessment setup progress">
                {([
                  [1, 'Source TOS'],
                  [2, 'Setup & Points'],
                  [3, 'Formats & Generate'],
                ] as const).map(([num, label]) => (
                  <div
                    key={num}
                    className={`assessment-v2-step ${step === num ? 'active' : step > num ? 'done' : ''}`}
                  >
                    <span>{step > num ? <Check size={14} /> : num}</span>
                    <strong>{label}</strong>
                  </div>
                ))}
              </div>

              {step === 1 && (
                <section className="panel assessment-v2-wizard-card">
                  <header className="assessment-v2-wizard-heading">
                    <span className="assessment-v2-wizard-number">1</span>
                    <div>
                      <h2>Choose assessment source</h2>
                      <p>Select the finalized Table of Specifications this exam should follow.</p>
                    </div>
                  </header>

                  <div className="assessment-v2-source-list" role="listbox" aria-label="Finalized TOS documents">
                    {tosDocuments.map((document) => {
                      const chosen = selectedTosId === document.id
                      return (
                        <button
                          key={document.id}
                          type="button"
                          role="option"
                          aria-selected={chosen}
                          className={`assessment-v2-source-card ${chosen ? 'selected' : ''}`}
                          onClick={() => {
                            setSelectedTosId(document.id)
                            setPointsTouched(false)
                          }}
                        >
                          <span className="assessment-v2-source-icon">
                            {chosen ? <Check size={18} /> : <FileCheck2 size={18} />}
                          </span>
                          <span className="assessment-v2-source-copy">
                            <strong>{document.title || 'Untitled TOS'}</strong>
                            <small>
                              {[document.content.gradeLevel, document.content.learningArea, document.content.schoolYear]
                                .filter(Boolean)
                                .join(' · ')}
                            </small>
                            <small>{document.content.rows.length} competencies</small>
                          </span>
                          {chosen && <span className="assessment-v2-selected-pill">Selected</span>}
                        </button>
                      )
                    })}
                  </div>

                  <footer className="assessment-v2-wizard-footer">
                    <Link className="button ghost" to="/assessments">
                      <ArrowLeft size={16} /> Cancel
                    </Link>
                    <button
                      className="button primary"
                      type="button"
                      disabled={!selectedTos}
                      onClick={() => setStep(2)}
                    >
                      Continue <ArrowRight size={16} />
                    </button>
                  </footer>
                </section>
              )}

              {step === 2 && (
                <section className="panel assessment-v2-wizard-card">
                  <header className="assessment-v2-wizard-heading">
                    <span className="assessment-v2-wizard-number">2</span>
                    <div>
                      <h2>Assessment Setup</h2>
                      <p>Total points are the assessment size. Logical item counts are planned automatically.</p>
                    </div>
                  </header>

                  <div className="assessment-v2-primary-fields">
                    <label className="assessment-v2-points-field">
                      <span>Total points</span>
                      <input
                        type="number"
                        inputMode="numeric"
                        min="1"
                        max="1000"
                        step="1"
                        value={totalPoints}
                        onChange={(event) => {
                          setPointsTouched(true)
                          setTotalPoints(Number(event.target.value))
                        }}
                      />
                      <small>Multi-point questions use ranges automatically, such as 16–20.</small>
                    </label>

                    <label>
                      <span>Assessment title <small>(optional)</small></span>
                      <input
                        value={tosTitle}
                        onChange={(event) => setTosTitle(event.target.value)}
                        placeholder={selectedTos?.content.assessmentTitle || 'e.g. First Quarterly Assessment'}
                      />
                    </label>

                    <label>
                      <span>Directions for learners <small>(optional)</small></span>
                      <textarea
                        rows={3}
                        value={tosInstructions}
                        onChange={(event) => setTosInstructions(event.target.value)}
                        placeholder="Instructions shown at the top of the assessment..."
                      />
                    </label>
                  </div>

                  <footer className="assessment-v2-wizard-footer">
                    <button className="button ghost" type="button" onClick={() => setStep(1)}>
                      <ArrowLeft size={16} /> Back
                    </button>
                    <button
                      className="button primary"
                      type="button"
                      disabled={!Number.isSafeInteger(totalPoints) || totalPoints < 1}
                      onClick={() => setStep(3)}
                    >
                      Continue <ArrowRight size={16} />
                    </button>
                  </footer>
                </section>
              )}

              {step === 3 && (
                <section className="panel assessment-v2-wizard-card assessment-v2-formats-card">
                  <header className="assessment-v2-wizard-heading assessment-v2-formats-heading">
                    <span className="assessment-v2-wizard-number">3</span>
                    <div>
                      <h2>Choose question formats</h2>
                      <p>Select question formats. Cognitive coverage is validated automatically against the TOS.</p>
                    </div>
                    <div className="assessment-v2-format-actions">
                      <span>{allowedTypes.length} selected</span>
                      <button
                        type="button"
                        className="button ghost compact"
                        onClick={() => setAllowedTypes(DEFAULT_TYPES)}
                      >
                        Select all
                      </button>
                      <button
                        type="button"
                        className="button ghost compact"
                        onClick={() => setAllowedTypes([])}
                      >
                        Clear
                      </button>
                    </div>
                  </header>

                  <div className="assessment-v2-format-grid">
                    {ASSESSMENT_QUESTION_TYPES.map((type) => {
                      const selectedType = allowedTypes.includes(type)
                      return (
                        <label
                          key={type}
                          className={`assessment-v2-format-chip ${selectedType ? 'selected' : ''}`}
                        >
                          <input type="checkbox" checked={selectedType} onChange={() => toggleType(type)} />
                          <span className="assessment-v2-format-check">
                            {selectedType && <Check size={14} />}
                          </span>
                          <strong>{typeLabel(type)}</strong>
                        </label>
                      )
                    })}
                  </div>

                  <div
                    className={`assessment-v2-coverage-compact ${
                      setupValidation.ready ? 'ready' : 'needs-attention'
                    }`}
                  >
                    <div className="assessment-v2-coverage-title">
                      <ShieldCheck size={19} />
                      <div>
                        <strong>
                          {setupValidation.ready
                            ? 'All required cognitive levels are covered'
                            : 'Coverage needs attention'}
                        </strong>
                        <small>
                          {setupValidation.ready
                            ? 'Your selected formats can assess every cognitive level required by this TOS.'
                            : 'Adjust the selected formats or point total before generating.'}
                        </small>
                      </div>
                    </div>
                    {cpdSummary.length > 0 && (
                      <div className="assessment-v2-coverage-chips">
                        {cpdSummary.map((entry) => (
                          <span key={entry.key}>
                            <Check size={12} /> {entry.label}
                            <b>{entry.points}</b>
                          </span>
                        ))}
                      </div>
                    )}
                    {setupValidation.errors.map((issue) => (
                      <div className="form-message error" key={issue.key}>
                        {issue.message}
                      </div>
                    ))}
                  </div>

                  <footer className="assessment-v2-wizard-footer assessment-v2-generate-footer">
                    <button className="button ghost" type="button" onClick={() => setStep(2)}>
                      <ArrowLeft size={16} /> Back
                    </button>
                    <button
                      className="button primary assessment-v2-generate-button"
                      type="button"
                      disabled={!selectedTos || !setupValidation.ready}
                      onClick={() => void generateAssessment()}
                    >
                      <Sparkles size={17} /> Generate assessment
                    </button>
                  </footer>
                </section>
              )}
            </>
          )}
        </div>
      )}

      {/* MODE 2: LESSON QUIZ WIZARD */}
      {mode === 'lesson_quiz' && (
        <div className="assessment-v2-wizard-shell">
          {!lessonPlans.length ? (
            <EmptyState
              icon={BookOpen}
              title="Create a Lesson Plan first"
              description="No active lesson plans were found. Create and save a lesson plan to generate a single-lesson quiz."
            >
              <Link className="button primary" to="/lesson-plans/new">
                <Plus size={16} /> New Lesson Plan
              </Link>
            </EmptyState>
          ) : (
            <>
              <div className="assessment-v2-stepper" aria-label="Lesson quiz setup progress">
                {([
                  [1, 'Source Lesson'],
                  [2, 'Quiz Setup'],
                  [3, 'Formats & Generate'],
                ] as const).map(([num, label]) => (
                  <div
                    key={num}
                    className={`assessment-v2-step ${step === num ? 'active' : step > num ? 'done' : ''}`}
                  >
                    <span>{step > num ? <Check size={14} /> : num}</span>
                    <strong>{label}</strong>
                  </div>
                ))}
              </div>

              {step === 1 && (
                <section className="panel assessment-v2-wizard-card">
                  <header className="assessment-v2-wizard-heading">
                    <span className="assessment-v2-wizard-number">1</span>
                    <div>
                      <h2>Choose lesson plan</h2>
                      <p>Select the active daily lesson plan this formative quiz will align to.</p>
                    </div>
                  </header>

                  <div className="assessment-v2-source-list" role="listbox" aria-label="Active lesson plans">
                    {lessonPlans.map((lesson) => {
                      const chosen = selectedLessonId === lesson.id
                      return (
                        <button
                          key={lesson.id}
                          type="button"
                          role="option"
                          aria-selected={chosen}
                          className={`assessment-v2-source-card ${chosen ? 'selected' : ''}`}
                          onClick={() => setSelectedLessonId(lesson.id)}
                        >
                          <span className="assessment-v2-source-icon">
                            {chosen ? <Check size={18} /> : <BookOpen size={18} />}
                          </span>
                          <span className="assessment-v2-source-copy">
                            <strong>{lesson.title || 'Untitled Lesson'}</strong>
                            <small>
                              {[getLessonGrade(lesson), getLessonSubject(lesson), lesson.schoolYear]
                                .filter(Boolean)
                                .join(' · ') || 'Unspecified context'}
                            </small>
                            <small>{getLessonCompetencies(lesson).length} competencies</small>
                          </span>
                          {chosen && <span className="assessment-v2-selected-pill">Selected</span>}
                        </button>
                      )
                    })}
                  </div>

                  {selectedLesson && (
                    <div className="source-preview-banner" style={{ margin: '0 24px 18px' }}>
                      <strong>Aligned Competencies:</strong>
                      <ul>
                        {getLessonCompetencies(selectedLesson).map((c) => (
                          <li key={c.id}>
                            {c.code ? <b>{c.code}: </b> : null}
                            {c.text}
                          </li>
                        ))}
                        {getLessonCompetencies(selectedLesson).length === 0 && (
                          <li>Preserves general lesson objectives and learning content.</li>
                        )}
                      </ul>
                    </div>
                  )}

                  <footer className="assessment-v2-wizard-footer">
                    <Link className="button ghost" to="/assessments">
                      <ArrowLeft size={16} /> Cancel
                    </Link>
                    <button
                      className="button primary"
                      type="button"
                      disabled={!selectedLesson}
                      onClick={() => setStep(2)}
                    >
                      Continue <ArrowRight size={16} />
                    </button>
                  </footer>
                </section>
              )}

              {step === 2 && (
                <section className="panel assessment-v2-wizard-card">
                  <header className="assessment-v2-wizard-heading">
                    <span className="assessment-v2-wizard-number">2</span>
                    <div>
                      <h2>Quiz Setup</h2>
                      <p>Set the quiz title, length, teaching assignment, and learner directions.</p>
                    </div>
                  </header>

                  <div className="assessment-v2-primary-fields">
                    <label>
                      <span>Quiz title <small>(optional)</small></span>
                      <input
                        value={quizTitle}
                        onChange={(e) => setQuizTitle(e.target.value)}
                        placeholder={selectedLesson ? `Quiz: ${selectedLesson.title}` : 'e.g. Formative Check 1'}
                      />
                    </label>

                    <label>
                      <span>Number of questions / items</span>
                      <select
                        className="select"
                        value={quizItemCount}
                        onChange={(e) => setQuizItemCount(Number(e.target.value))}
                      >
                        <option value={5}>5 Questions (Quick Check · ~10 mins)</option>
                        <option value={10}>10 Questions (Standard Quiz · ~20 mins)</option>
                        <option value={15}>15 Questions (Extended Quiz · ~30 mins)</option>
                        <option value={20}>20 Questions (Summative Formative · ~45 mins)</option>
                      </select>
                    </label>

                    <TeachingAssignmentField
                      assignments={assignments}
                      assignmentId={lessonQuizAssignmentId}
                      linkedAssignmentId={selectedLesson?.assignmentId}
                      linkedFallbackLabel={[getLessonGrade(selectedLesson ?? undefined), getLessonSubject(selectedLesson ?? undefined), selectedLesson?.schoolYear].filter(Boolean).join(' · ')}
                      onChange={setLessonQuizAssignmentId}
                    />

                    <label>
                      <span>Directions for learners <small>(optional)</small></span>
                      <textarea
                        rows={3}
                        value={quizInstructions}
                        placeholder="Read each question carefully and write your answers on the space provided..."
                        onChange={(e) => setQuizInstructions(e.target.value)}
                      />
                    </label>
                  </div>

                  <footer className="assessment-v2-wizard-footer">
                    <button className="button ghost" type="button" onClick={() => setStep(1)}>
                      <ArrowLeft size={16} /> Back
                    </button>
                    <button
                      className="button primary"
                      type="button"
                      disabled={!resolvedLessonQuizAssignmentId}
                      onClick={() => setStep(3)}
                    >
                      Continue <ArrowRight size={16} />
                    </button>
                  </footer>
                </section>
              )}

              {step === 3 && (
                <section className="panel assessment-v2-wizard-card assessment-v2-formats-card">
                  <header className="assessment-v2-wizard-heading assessment-v2-formats-heading">
                    <span className="assessment-v2-wizard-number">3</span>
                    <div>
                      <h2>Choose question formats</h2>
                      <p>Select allowed question types for this lesson quiz.</p>
                    </div>
                    <div className="assessment-v2-format-actions">
                      <span>{quizAllowedTypes.length} selected</span>
                      <button
                        type="button"
                        className="button ghost compact"
                        onClick={() => setQuizAllowedTypes(DEFAULT_TYPES)}
                      >
                        Select all
                      </button>
                      <button
                        type="button"
                        className="button ghost compact"
                        onClick={() => setQuizAllowedTypes([])}
                      >
                        Clear
                      </button>
                    </div>
                  </header>

                  <div className="assessment-v2-format-grid">
                    {ASSESSMENT_QUESTION_TYPES.map((type) => {
                      const checked = quizAllowedTypes.includes(type)
                      return (
                        <label key={type} className={`assessment-v2-format-chip ${checked ? 'selected' : ''}`}>
                          <input type="checkbox" checked={checked} onChange={() => toggleQuizType(type)} />
                          <span className="assessment-v2-format-check">{checked && <Check size={14} />}</span>
                          <strong>{typeLabel(type)}</strong>
                        </label>
                      )
                    })}
                  </div>

                  <div className="assessment-v2-coverage-compact ready">
                    <div className="assessment-v2-coverage-title">
                      <BookOpen size={19} />
                      <div>
                        <strong>Target Lesson: {selectedLesson?.title || 'Selected Lesson'}</strong>
                        <small>
                          {quizItemCount} questions planned · {getLessonCompetencies(selectedLesson).length} competencies covered
                        </small>
                      </div>
                    </div>
                  </div>

                  <footer className="assessment-v2-wizard-footer assessment-v2-generate-footer">
                    <button className="button ghost" type="button" onClick={() => setStep(2)}>
                      <ArrowLeft size={16} /> Back
                    </button>
                    <div className="assessment-v2-wizard-footer-actions">
                      <button
                        type="button"
                        className="button secondary"
                        disabled={creating || !selectedLesson || !resolvedLessonQuizAssignmentId || quizAllowedTypes.length === 0}
                        onClick={() => void handleCreateLessonQuiz(false)}
                      >
                        <FileText size={16} /> Create Empty Draft
                      </button>
                      <button
                        type="button"
                        className="button primary assessment-v2-generate-button"
                        disabled={creating || !selectedLesson || !resolvedLessonQuizAssignmentId || quizAllowedTypes.length === 0}
                        onClick={() => void handleCreateLessonQuiz(true)}
                      >
                        <Sparkles size={17} /> {creating ? 'Generating quiz…' : 'Generate Lesson Quiz'}
                      </button>
                    </div>
                  </footer>
                </section>
              )}
            </>
          )}
        </div>
      )}

      {/* MODE 3: UNIT QUIZ WIZARD */}
      {mode === 'unit_quiz' && (
        <div className="assessment-v2-wizard-shell">
          {lessonPlans.length < 2 ? (
            <EmptyState
              icon={Layers}
              title="At least 2 Lesson Plans required"
              description="A unit assessment requires at least 2 lesson plans to distribute items across competencies."
            >
              <Link className="button primary" to="/lesson-plans/new">
                <Plus size={16} /> Create Another Lesson Plan
              </Link>
            </EmptyState>
          ) : (
            <>
              <div className="assessment-v2-stepper" aria-label="Unit quiz setup progress">
                {([
                  [1, 'Unit Lessons'],
                  [2, 'Unit Setup'],
                  [3, 'Formats & Generate'],
                ] as const).map(([num, label]) => (
                  <div
                    key={num}
                    className={`assessment-v2-step ${step === num ? 'active' : step > num ? 'done' : ''}`}
                  >
                    <span>{step > num ? <Check size={14} /> : num}</span>
                    <strong>{label}</strong>
                  </div>
                ))}
              </div>

              {step === 1 && (
                <section className="panel assessment-v2-wizard-card">
                  <header className="assessment-v2-wizard-heading">
                    <span className="assessment-v2-wizard-number">1</span>
                    <div>
                      <h2>Choose unit lessons</h2>
                      <p>Select 2 or more lesson plans across which questions will be proportionally distributed.</p>
                    </div>
                    <div className="assessment-v2-format-actions">
                      <span>{selectedUnitLessonIds.length} selected</span>
                    </div>
                  </header>

                  <div className="assessment-v2-source-list" role="listbox" aria-label="Unit lesson plans" aria-multiselectable="true">
                    {lessonPlans.map((lesson) => {
                      const chosen = selectedUnitLessonIds.includes(lesson.id)
                      return (
                        <button
                          key={lesson.id}
                          type="button"
                          role="option"
                          aria-selected={chosen}
                          className={`assessment-v2-source-card ${chosen ? 'selected' : ''}`}
                          onClick={() => toggleUnitLesson(lesson.id)}
                        >
                          <span className="assessment-v2-source-icon">
                            {chosen ? <Check size={18} /> : <Layers size={18} />}
                          </span>
                          <span className="assessment-v2-source-copy">
                            <strong>{lesson.title || 'Untitled Lesson'}</strong>
                            <small>
                              {[getLessonGrade(lesson), getLessonSubject(lesson), lesson.schoolYear]
                                .filter(Boolean)
                                .join(' · ') || 'Unspecified context'}
                            </small>
                            <small>{getLessonCompetencies(lesson).length} competencies</small>
                          </span>
                          {chosen && <span className="assessment-v2-selected-pill">Included</span>}
                        </button>
                      )
                    })}
                  </div>

                  {unitAssignmentConflict && (
                    <div className="form-message error" role="alert" style={{ margin: '0 24px 18px' }}>
                      Selected lessons are linked to different teaching assignments. Choose lessons from the same class before creating a unit quiz.
                    </div>
                  )}

                  <footer className="assessment-v2-wizard-footer">
                    <Link className="button ghost" to="/assessments">
                      <ArrowLeft size={16} /> Cancel
                    </Link>
                    <button
                      className="button primary"
                      type="button"
                      disabled={selectedUnitLessonIds.length < 2 || unitAssignmentConflict}
                      onClick={() => setStep(2)}
                    >
                      Continue <ArrowRight size={16} />
                    </button>
                  </footer>
                </section>
              )}

              {step === 2 && (
                <section className="panel assessment-v2-wizard-card">
                  <header className="assessment-v2-wizard-heading">
                    <span className="assessment-v2-wizard-number">2</span>
                    <div>
                      <h2>Unit Quiz Setup</h2>
                      <p>Define the unit title, exam length, class context, and instructions.</p>
                    </div>
                  </header>

                  <div className="assessment-v2-primary-fields">
                    <label>
                      <span>Unit quiz title <small>(optional)</small></span>
                      <input
                        value={unitTitle}
                        onChange={(e) => setUnitTitle(e.target.value)}
                        placeholder={`Unit Assessment (${selectedUnitLessons.length} Lessons)`}
                      />
                    </label>

                    <label>
                      <span>Total assessment items</span>
                      <select
                        className="select"
                        value={unitTotalItems}
                        onChange={(e) => setUnitTotalItems(Number(e.target.value))}
                      >
                        <option value={15}>15 Items (Short Unit Check)</option>
                        <option value={20}>20 Items (Standard Unit Exam)</option>
                        <option value={25}>25 Items (Comprehensive Unit Exam)</option>
                        <option value={30}>30 Items (Full Summative Assessment)</option>
                      </select>
                    </label>

                    <TeachingAssignmentField
                      assignments={assignments}
                      assignmentId={unitQuizAssignmentId}
                      linkedAssignmentId={linkedUnitAssignmentId}
                      linkedFallbackLabel={selectedUnitLessons.length ? [getLessonGrade(selectedUnitLessons[0]), getLessonSubject(selectedUnitLessons[0]), selectedUnitLessons[0].schoolYear].filter(Boolean).join(' · ') : undefined}
                      conflictMessage={unitAssignmentConflict ? 'Selected lessons are linked to different teaching assignments. Choose lessons from the same class before creating a unit quiz.' : undefined}
                      onChange={setUnitQuizAssignmentId}
                    />

                    <label>
                      <span>Directions for learners <small>(optional)</small></span>
                      <textarea
                        rows={3}
                        value={unitInstructions}
                        placeholder="Answer all questions in the sections below..."
                        onChange={(e) => setUnitInstructions(e.target.value)}
                      />
                    </label>
                  </div>

                  <footer className="assessment-v2-wizard-footer">
                    <button className="button ghost" type="button" onClick={() => setStep(1)}>
                      <ArrowLeft size={16} /> Back
                    </button>
                    <button
                      className="button primary"
                      type="button"
                      disabled={unitAssignmentConflict || !resolvedUnitQuizAssignmentId}
                      onClick={() => setStep(3)}
                    >
                      Continue <ArrowRight size={16} />
                    </button>
                  </footer>
                </section>
              )}

              {step === 3 && (
                <section className="panel assessment-v2-wizard-card assessment-v2-formats-card">
                  <header className="assessment-v2-wizard-heading assessment-v2-formats-heading">
                    <span className="assessment-v2-wizard-number">3</span>
                    <div>
                      <h2>Choose question formats</h2>
                      <p>Select question formats to include in this unit assessment.</p>
                    </div>
                    <div className="assessment-v2-format-actions">
                      <span>{unitAllowedTypes.length} selected</span>
                      <button
                        type="button"
                        className="button ghost compact"
                        onClick={() => setUnitAllowedTypes(DEFAULT_TYPES)}
                      >
                        Select all
                      </button>
                      <button
                        type="button"
                        className="button ghost compact"
                        onClick={() => setUnitAllowedTypes([])}
                      >
                        Clear
                      </button>
                    </div>
                  </header>

                  <div className="assessment-v2-format-grid">
                    {ASSESSMENT_QUESTION_TYPES.map((type) => {
                      const checked = unitAllowedTypes.includes(type)
                      return (
                        <label key={type} className={`assessment-v2-format-chip ${checked ? 'selected' : ''}`}>
                          <input type="checkbox" checked={checked} onChange={() => toggleUnitQuizType(type)} />
                          <span className="assessment-v2-format-check">{checked && <Check size={14} />}</span>
                          <strong>{typeLabel(type)}</strong>
                        </label>
                      )
                    })}
                  </div>

                  <div className="assessment-v2-coverage-compact ready">
                    <div className="assessment-v2-coverage-title">
                      <Layers size={19} />
                      <div>
                        <strong>Unit Scope: {selectedUnitLessons.length} Lessons</strong>
                        <small>
                          {unitTotalItems} items planned · {selectedUnitLessons.reduce((acc, l) => acc + getLessonCompetencies(l).length, 0)} total competencies across unit
                        </small>
                      </div>
                    </div>
                    {selectedUnitLessons.length > 0 && (
                      <div className="assessment-v2-coverage-chips">
                        {selectedUnitLessons.map((l) => (
                          <span key={l.id}>
                            <Check size={12} /> {l.title} <b>({getLessonCompetencies(l).length})</b>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <footer className="assessment-v2-wizard-footer assessment-v2-generate-footer">
                    <button className="button ghost" type="button" onClick={() => setStep(2)}>
                      <ArrowLeft size={16} /> Back
                    </button>
                    <div className="assessment-v2-wizard-footer-actions">
                      <button
                        type="button"
                        className="button secondary"
                        disabled={creating || selectedUnitLessonIds.length < 2 || unitAssignmentConflict || !resolvedUnitQuizAssignmentId || unitAllowedTypes.length === 0}
                        onClick={() => void handleCreateUnitQuiz(false)}
                      >
                        <FileText size={16} /> Create Empty Draft
                      </button>
                      <button
                        type="button"
                        className="button primary assessment-v2-generate-button"
                        disabled={creating || selectedUnitLessonIds.length < 2 || unitAssignmentConflict || !resolvedUnitQuizAssignmentId || unitAllowedTypes.length === 0}
                        onClick={() => void handleCreateUnitQuiz(true)}
                      >
                        <Sparkles size={17} /> {creating ? 'Generating unit quiz…' : 'Generate Unit Quiz'}
                      </button>
                    </div>
                  </footer>
                </section>
              )}
            </>
          )}
        </div>
      )}

      {/* MODE 4: PERFORMANCE TASK WIZARD */}
      {mode === 'performance_task' && (
        <div className="assessment-v2-wizard-shell">
          <div className="assessment-v2-stepper" aria-label="Performance task setup progress">
            {([
              [1, 'Curriculum Source'],
              [2, 'Task Scenario'],
              [3, 'Rubric & Timeline'],
            ] as const).map(([num, label]) => (
              <div
                key={num}
                className={`assessment-v2-step ${step === num ? 'active' : step > num ? 'done' : ''}`}
              >
                <span>{step > num ? <Check size={14} /> : num}</span>
                <strong>{label}</strong>
              </div>
            ))}
          </div>

          {step === 1 && (
            <section className="panel assessment-v2-wizard-card">
              <header className="assessment-v2-wizard-heading">
                <span className="assessment-v2-wizard-number">1</span>
                <div>
                  <h2>Curriculum Source Alignment</h2>
                  <p>Anchor this task to a lesson plan, a TOS, or custom standards.</p>
                </div>
              </header>

              <div style={{ padding: '18px 24px 8px' }}>
                <div className="assessment-v2-segmented" role="radiogroup">
                  <button
                    type="button"
                    className={ptSourceType === 'lesson' ? 'selected' : ''}
                    onClick={() => setPtSourceType('lesson')}
                  >
                    <strong>From Lesson Plan</strong>
                    <small>Anchor to active daily lesson</small>
                  </button>
                  <button
                    type="button"
                    className={ptSourceType === 'tos' ? 'selected' : ''}
                    onClick={() => setPtSourceType('tos')}
                  >
                    <strong>From TOS</strong>
                    <small>Anchor to finalized TOS</small>
                  </button>
                  <button
                    type="button"
                    className={ptSourceType === 'custom' ? 'selected' : ''}
                    onClick={() => setPtSourceType('custom')}
                  >
                    <strong>Custom Context</strong>
                    <small>Teacher-defined standards</small>
                  </button>
                </div>
              </div>

              {ptSourceType === 'lesson' && (
                <div className="assessment-v2-source-list" role="listbox" aria-label="Anchor lesson plans">
                  {lessonPlans.map((lesson) => {
                    const chosen = ptSelectedLessonId === lesson.id
                    return (
                      <button
                        key={lesson.id}
                        type="button"
                        role="option"
                        aria-selected={chosen}
                        className={`assessment-v2-source-card ${chosen ? 'selected' : ''}`}
                        onClick={() => setPtSelectedLessonId(lesson.id)}
                      >
                        <span className="assessment-v2-source-icon">
                          {chosen ? <Check size={18} /> : <BookOpen size={18} />}
                        </span>
                        <span className="assessment-v2-source-copy">
                          <strong>{lesson.title || 'Untitled Lesson'}</strong>
                          <small>
                            {[getLessonGrade(lesson), getLessonSubject(lesson), lesson.schoolYear]
                              .filter(Boolean)
                              .join(' · ') || 'Unspecified context'}
                          </small>
                          <small>{getLessonCompetencies(lesson).length} competencies</small>
                        </span>
                        {chosen && <span className="assessment-v2-selected-pill">Selected</span>}
                      </button>
                    )
                  })}
                  {!lessonPlans.length && (
                    <div className="form-message" role="status">
                      No lesson plans available. <Link to="/lesson-plans/new">Create a lesson plan</Link> or switch to TOS / Custom context.
                    </div>
                  )}
                </div>
              )}

              {ptSourceType === 'tos' && (
                <div className="assessment-v2-source-list" role="listbox" aria-label="Anchor TOS documents">
                  {tosDocuments.map((tos) => {
                    const chosen = ptSelectedTosId === tos.id
                    return (
                      <button
                        key={tos.id}
                        type="button"
                        role="option"
                        aria-selected={chosen}
                        className={`assessment-v2-source-card ${chosen ? 'selected' : ''}`}
                        onClick={() => setPtSelectedTosId(tos.id)}
                      >
                        <span className="assessment-v2-source-icon">
                          {chosen ? <Check size={18} /> : <ShieldCheck size={18} />}
                        </span>
                        <span className="assessment-v2-source-copy">
                          <strong>{tos.title || 'Untitled TOS'}</strong>
                          <small>
                            {[tos.content.gradeLevel, tos.content.learningArea, tos.content.schoolYear]
                              .filter(Boolean)
                              .join(' · ')}
                          </small>
                          <small>{tos.content.rows.length} competencies</small>
                        </span>
                        {chosen && <span className="assessment-v2-selected-pill">Selected</span>}
                      </button>
                    )
                  })}
                  {!tosDocuments.length && (
                    <div className="form-message" role="status">
                      No finalized TOS available. <Link to="/tos">Open TOS Builder</Link> or switch to Lesson Plan / Custom context.
                    </div>
                  )}
                </div>
              )}

              {ptSourceType === 'custom' && (
                <div className="source-preview-banner" style={{ margin: '8px 24px 18px' }}>
                  <strong>Standalone Task Authoring</strong>
                  <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '12.5px' }}>
                    This performance task will be authored with custom teacher-defined competencies and rubric criteria.
                  </p>
                </div>
              )}

              <div style={{ padding: '0 24px 18px' }}>
                <TeachingAssignmentField
                  assignments={assignments}
                  assignmentId={performanceTaskAssignmentId}
                  linkedAssignmentId={linkedPerformanceAssignmentId}
                  linkedFallbackLabel={
                    ptSourceType === 'lesson'
                      ? [getLessonGrade(selectedPerformanceLesson ?? undefined), getLessonSubject(selectedPerformanceLesson ?? undefined), selectedPerformanceLesson?.schoolYear].filter(Boolean).join(' · ')
                      : ptSourceType === 'tos'
                        ? [selectedPerformanceTos?.content.gradeLevel, selectedPerformanceTos?.content.learningArea, selectedPerformanceTos?.schoolYear].filter(Boolean).join(' · ')
                        : undefined
                  }
                  onChange={setPerformanceTaskAssignmentId}
                />
              </div>

              <footer className="assessment-v2-wizard-footer">
                <Link className="button ghost" to="/assessments">
                  <ArrowLeft size={16} /> Cancel
                </Link>
                <button
                  className="button primary"
                  type="button"
                  disabled={
                    !resolvedPerformanceTaskAssignmentId
                    || (ptSourceType === 'lesson' && !selectedPerformanceLesson)
                    || (ptSourceType === 'tos' && !selectedPerformanceTos)
                  }
                  onClick={() => setStep(2)}
                >
                  Continue <ArrowRight size={16} />
                </button>
              </footer>
            </section>
          )}

          {step === 2 && (
            <section className="panel assessment-v2-wizard-card">
              <header className="assessment-v2-wizard-heading">
                <span className="assessment-v2-wizard-number">2</span>
                <div>
                  <h2>Task Scenario & Output</h2>
                  <p>Frame the authentic real-world problem using the DepEd GRASPS model.</p>
                </div>
              </header>

              <div className="assessment-v2-primary-fields">
                <label>
                  <span>Performance task title <small>(optional)</small></span>
                  <input
                    value={ptTitle}
                    placeholder={
                      selectedPerformanceLesson
                        ? `Performance Task: ${selectedPerformanceLesson.title}`
                        : 'e.g. Community Waste Audit and Waste Reduction Proposal'
                    }
                    onChange={(e) => setPtTitle(e.target.value)}
                  />
                </label>

                <label>
                  <span>
                    Real-world scenario (GRASPS model)
                    <small>State the Goal, Role, Audience, Situation, Product, and Standards.</small>
                  </span>
                  <textarea
                    rows={4}
                    value={ptScenario}
                    placeholder="e.g. As a youth environmental officer, you are tasked to inspect household solid waste segregation and present a realistic reduction plan to the Barangay Council..."
                    onChange={(e) => setPtScenario(e.target.value)}
                  />
                </label>

                <label>
                  <span>Expected deliverable / output</span>
                  <input
                    value={ptExpectedOutput}
                    placeholder="e.g. A 2-page infographic brochure with data analysis and action steps"
                    onChange={(e) => setPtExpectedOutput(e.target.value)}
                  />
                </label>
              </div>

              <footer className="assessment-v2-wizard-footer">
                <button className="button ghost" type="button" onClick={() => setStep(1)}>
                  <ArrowLeft size={16} /> Back
                </button>
                <button
                  className="button primary"
                  type="button"
                  onClick={() => setStep(3)}
                >
                  Continue <ArrowRight size={16} />
                </button>
              </footer>
            </section>
          )}

          {step === 3 && (
            <section className="panel assessment-v2-wizard-card">
              <header className="assessment-v2-wizard-heading">
                <span className="assessment-v2-wizard-number">3</span>
                <div>
                  <h2>Rubric, Grouping & Instructions</h2>
                  <p>Configure student collaboration mode, timeline, and learner instructions.</p>
                </div>
              </header>

              <div className="assessment-v2-primary-fields">
                <div className="form-row-2">
                  <label>
                    <span>
                      <Users size={14} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
                      Grouping mode
                    </span>
                    <select
                      className="select"
                      value={ptGrouping}
                      onChange={(e) => setPtGrouping(e.target.value as PerformanceTaskGrouping)}
                    >
                      <option value="individual">Individual Project</option>
                      <option value="group">Collaborative Group Task</option>
                      <option value="either">Individual or Group Choice</option>
                    </select>
                  </label>

                  <label>
                    <span>
                      <Clock size={14} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
                      Target timeline
                    </span>
                    <input
                      value={ptDuration}
                      placeholder="e.g. 1-2 weeks / 3 class sessions"
                      onChange={(e) => setPtDuration(e.target.value)}
                    />
                  </label>
                </div>

                <label>
                  <span>Student instructions <small>(optional)</small></span>
                  <textarea
                    rows={3}
                    value={ptInstructions}
                    placeholder="Follow the project milestones, consult the analytic rubric for criteria, and submit your final work by the due date."
                    onChange={(e) => setPtInstructions(e.target.value)}
                  />
                </label>

                <div className="assessment-v2-coverage-compact ready">
                  <div className="assessment-v2-coverage-title">
                    <Table size={19} />
                    <div>
                      <strong>DepEd 4-Level Analytic Scoring Rubric</strong>
                      <small>
                        Provisions 4 competency-anchored performance levels (Exemplary, Proficient, Developing, Beginning) with milestone checkpoints.
                      </small>
                    </div>
                  </div>
                </div>
              </div>

              <footer className="assessment-v2-wizard-footer assessment-v2-generate-footer">
                <button className="button ghost" type="button" onClick={() => setStep(2)}>
                  <ArrowLeft size={16} /> Back
                </button>
                <button
                  type="button"
                  className="button primary assessment-v2-generate-button"
                  disabled={
                    creating
                    || !resolvedPerformanceTaskAssignmentId
                    || (ptSourceType === 'lesson' && !selectedPerformanceLesson)
                    || (ptSourceType === 'tos' && !selectedPerformanceTos)
                  }
                  onClick={() => void handleCreatePerformanceTask()}
                >
                  <Table size={16} /> {creating ? 'Setting up rubric…' : 'Create & Open Performance Task'}
                </button>
              </footer>
            </section>
          )}
        </div>
      )}
    </>
  )
}
