import { useCallback, useEffect, useRef, useState } from 'react'
import {
  markTeacherTourCompleted,
  nextTeacherTourStep,
  previousTeacherTourStep,
} from '../lib/teacherTour'

export type TeacherTourStep = {
  title: string
  description: string
  destination: string
  route: string
}

export const TEACHER_TOUR_STEPS: readonly TeacherTourStep[] = [
  {
    title: 'Welcome to GuroDesk',
    description: 'GuroDesk brings lesson plans, TOS, assessments, learner results, and reports into one teacher workspace.',
    destination: 'Home',
    route: '/',
  },
  {
    title: 'Choose your teaching context',
    description: 'Start by choosing your curriculum, grade level, subject, class, and section. GuroDesk reuses that context in supported workflows.',
    destination: 'Classes · Curriculum',
    route: '/classes · /curriculum',
  },
  {
    title: 'Plan lessons and assessment coverage',
    description: 'Start lesson plans with a teacher-provided topic and add verified curriculum alignment as needed. Use TOS for the competencies actually covered by an assessment.',
    destination: 'Lesson Plans · Templates & TOS',
    route: '/lesson-plans · /tos',
  },
  {
    title: 'Build and review assessments',
    description: 'Create tests, lesson quizzes, unit quizzes, or authentic performance tasks with rubrics. Review and edit every question or rubric before finalizing.',
    destination: 'Assessments',
    route: '/assessments',
  },
  {
    title: 'Record and learn from results',
    description: 'Encode learner results and view item, competency, and cognitive-level analysis for follow-up support.',
    destination: 'Results',
    route: '/results',
  },
  {
    title: 'AI help is optional',
    description: 'AI features use your own Gemini API key. Connect it in Settings → AI assistance, and review every suggestion before using it.',
    destination: 'Settings → AI assistance',
    route: '/settings#ai-assistance',
  },
  {
    title: 'You’re ready',
    description: 'You can replay this tour anytime from More on mobile or the navigation menu on desktop.',
    destination: 'More → Replay Tour',
    route: 'Available from any workspace page',
  },
]

const FOCUSABLE_SELECTOR = 'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

type TeacherTourProps = {
  userId: string | null
  open: boolean
  onClose: () => void
}

export function TeacherTour({ userId, open, onClose }: TeacherTourProps) {
  const [stepIndex, setStepIndex] = useState(0)
  const dialogRef = useRef<HTMLDivElement | null>(null)
  const titleId = 'teacher-tour-title'
  const descriptionId = 'teacher-tour-description'
  const step = TEACHER_TOUR_STEPS[stepIndex]
  const isLastStep = stepIndex === TEACHER_TOUR_STEPS.length - 1

  const dismiss = useCallback(() => {
    if (userId) markTeacherTourCompleted(userId)
    setStepIndex(0)
    onClose()
  }, [onClose, userId])

  useEffect(() => {
    if (!open || !userId) return

    setStepIndex(0)
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    function handleDialogKeys(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        dismiss()
        return
      }
      if (event.key !== 'Tab' || !dialogRef.current) return
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const activeIndex = focusable.indexOf(document.activeElement as HTMLElement)
      if (event.shiftKey && activeIndex <= 0) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && (activeIndex === focusable.length - 1 || !dialogRef.current.contains(document.activeElement))) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleDialogKeys)
    return () => {
      document.removeEventListener('keydown', handleDialogKeys)
      document.body.style.overflow = originalOverflow
      if (previouslyFocused && document.contains(previouslyFocused)) previouslyFocused.focus()
    }
  }, [dismiss, open, userId])

  useEffect(() => {
    if (!open || !userId) return
    const focusTarget = window.requestAnimationFrame(() => {
      dialogRef.current?.querySelector<HTMLElement>('[data-tour-autofocus]')?.focus()
    })
    return () => window.cancelAnimationFrame(focusTarget)
  }, [open, stepIndex, userId])

  if (!open || !userId || !step) return null

  return (
    <div className="teacher-tour-backdrop" role="presentation">
      <div
        ref={dialogRef}
        className="teacher-tour-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
      >
        <div className="teacher-tour-heading">
          <div>
            <span className="eyebrow">Quick tour</span>
            <p className="teacher-tour-step-count">Step {stepIndex + 1} of {TEACHER_TOUR_STEPS.length}</p>
          </div>
          <button className="teacher-tour-skip teacher-tour-skip-top" type="button" onClick={dismiss}>Skip tour</button>
        </div>

        <div
          className="teacher-tour-progress"
          role="progressbar"
          aria-label="Tour progress"
          aria-valuemin={1}
          aria-valuemax={TEACHER_TOUR_STEPS.length}
          aria-valuenow={stepIndex + 1}
        >
          <span style={{ width: `${((stepIndex + 1) / TEACHER_TOUR_STEPS.length) * 100}%` }} />
        </div>

        <div className="teacher-tour-copy">
          <h2 id={titleId} tabIndex={-1} data-tour-autofocus>{step.title}</h2>
          <p id={descriptionId}>{step.description}</p>
        </div>

        <div className="teacher-tour-destination">
          <span>Find it at</span>
          <strong>{step.destination}</strong>
          <code>{step.route}</code>
        </div>

        <div className="teacher-tour-actions">
          <div className="teacher-tour-navigation">
            <button className="button ghost" type="button" onClick={() => setStepIndex((current) => previousTeacherTourStep(current))} disabled={stepIndex === 0}>Back</button>
            <button className="button primary" type="button" onClick={() => isLastStep ? dismiss() : setStepIndex((current) => nextTeacherTourStep(current, TEACHER_TOUR_STEPS.length))}>{isLastStep ? 'Finish' : 'Next'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}
