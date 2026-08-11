import { Check, CircleAlert, LoaderCircle, X } from 'lucide-react'
import type { AssessmentPreparationController } from '../../hooks/useAssessmentPreparation'
import type { AssessmentPreparationStage } from '../../pages/assessmentUi'

const STAGES: AssessmentPreparationStage[] = ['questions', 'visuals', 'qa']

export function AssessmentPreparationProgress({ preparation }: { preparation: AssessmentPreparationController }) {
  if (!preparation.working) return null
  const activeIndex = STAGES.indexOf(preparation.stage)
  const progress = preparation.progress.total ? Math.round((preparation.progress.succeeded / preparation.progress.total) * 100) : 0
  return <section className="panel assessment-simple-preparation" data-testid="assessment-preparation-progress" aria-live="polite" aria-label="Test preparation progress">
    <div className="assessment-simple-preparation-heading"><div><span className="assessment-simple-eyebrow">Preparing your test</span><h2>{preparation.phaseLabel}</h2><p>{preparation.progressLabel || 'Your work is saved automatically.'}</p></div><LoaderCircle size={22} className="spin" aria-hidden="true" /></div>
    <div className="assessment-simple-preparation-steps">{STAGES.map((stage, index) => <div key={stage} className={index < activeIndex ? 'complete' : index === activeIndex ? 'active' : 'pending'}><span>{index < activeIndex ? <Check size={14} aria-hidden="true" /> : index === activeIndex ? <LoaderCircle size={14} className="spin" aria-hidden="true" /> : index + 1}</span><strong>{stage === 'questions' ? 'Creating questions' : stage === 'visuals' ? 'Adding diagrams' : 'Checking paper'}</strong></div>)}</div>
    <div className="assessment-simple-preparation-bar" aria-label={`${progress}% complete`}><span style={{ width: `${progress}%` }} /></div>
    <p className="assessment-simple-autosave"><Check size={15} aria-hidden="true" /> Generation progress is saved automatically. Save teacher edits with Save draft.</p>
    <details className="assessment-technical-details"><summary>Technical details</summary><p>{preparation.message || 'The existing preparation pipeline is running.'}</p>{preparation.failures.length > 0 && <div>{preparation.failures.slice(0, 8).map((failure) => <p key={failure.itemId}><CircleAlert size={13} /> {failure.itemId}: {failure.message}</p>)}{preparation.failures.length > 8 && <p>+ {preparation.failures.length - 8} more tasks need review.</p>}</div>}</details>
    <button type="button" className="button ghost assessment-simple-cancel" onClick={preparation.cancel}><X size={15} /> Pause preparation</button>
  </section>
}
