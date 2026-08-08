import type { LessonPlanExportModel } from '../types/export'

function ExportField({ label, body }: { label: string; body: string }) {
  if (!body.trim()) return null
  return <div className="print-field"><strong>{label}</strong><div className="print-preserve-lines">{body}</div></div>
}

function IlawBlock({ letter, title, fields }: { letter: string; title: string; fields: LessonPlanExportModel['ilaw']['intentions'] }) {
  return (
    <section className="print-ilaw-block">
      <div className="print-section-heading"><strong>{letter}. {title}</strong></div>
      {fields.map((field) => <ExportField key={field.key} label={field.heading} body={field.body} />)}
    </section>
  )
}

export function LessonPlanDocumentView({ model }: { model: LessonPlanExportModel }) {
  const gradeAndSection = `${model.lesson.gradeLevel}${model.lesson.sections && model.lesson.sections !== 'Not specified' ? ` – ${model.lesson.sections}` : ''}`
  const sessionSummary = `${model.lesson.sessions} ${model.labels.sessionUnit}, ${model.lesson.duration}`
  const copyLabel = model.status === 'archived' ? model.labels.archivedCopy : model.labels.draftCopy

  return (
    <article className="lesson-print-document" lang={model.language === 'filipino' ? 'fil' : 'en'}>
      {model.status !== 'final' && <div className="print-draft-banner">{copyLabel}</div>}
      <header className="print-document-header">
        <p>{model.labels.republic}</p>
        <strong>{model.labels.department}</strong>
        {model.identity.region && <p>{model.identity.region}</p>}
        {model.identity.division && <p>{model.identity.division}</p>}
        {model.identity.schoolName && <p className="print-school-name">{model.identity.schoolName}</p>}
        <h1>{model.documentTitle}</h1>
      </header>

      <table className="print-meta-table">
        <tbody>
          <tr><th>{model.labels.teacher}</th><td>{model.identity.teacherName}</td></tr>
          <tr><th>{model.labels.gradeSection}</th><td>{gradeAndSection}</td></tr>
          <tr><th>{model.labels.learningArea}</th><td>{model.lesson.learningArea}</td></tr>
          <tr><th>{model.labels.lessonTitle}</th><td>{model.lesson.title}</td></tr>
          <tr><th>{model.labels.date}</th><td>{model.lesson.lessonDate === 'Not specified' ? '' : model.lesson.lessonDate}</td></tr>
          <tr><th>{model.labels.weekSchedule}</th><td>{model.lesson.weekLabel === 'Not specified' ? '' : model.lesson.weekLabel}</td></tr>
          <tr><th>{model.labels.schoolYear}</th><td>{model.lesson.schoolYear}</td></tr>
          <tr><th>{model.labels.gradingTerm}</th><td>{model.lesson.gradingTerm === 'Not specified' ? '' : model.lesson.gradingTerm}</td></tr>
          <tr><th>{model.labels.curriculumPeriod}</th><td>{model.lesson.curriculumPeriod === 'Not specified' ? '' : model.lesson.curriculumPeriod}</td></tr>
          <tr><th>{model.labels.sessionsDuration}</th><td>{sessionSummary}</td></tr>
          <tr><th>{model.labels.references}</th><td><div className="print-preserve-lines">{model.references}</div></td></tr>
        </tbody>
      </table>

      <IlawBlock letter="I" title={model.labels.intentions} fields={model.ilaw.intentions} />
      <IlawBlock letter="L" title={model.labels.learningExperience} fields={model.ilaw.learningExperience} />
      <IlawBlock letter="A" title={model.labels.assessingLearning} fields={model.ilaw.assessingLearning} />
      <IlawBlock letter="W" title={model.labels.waysForward} fields={model.ilaw.waysForward} />

      {model.signatories.length > 0 && <section className="print-signatures">
        <div className="print-section-heading"><strong>{model.labels.signatures}</strong></div>
        <div className="print-signature-grid">
          {model.signatories.map((item) => (
            <div className="print-signature" key={item.role}>
              <span>{item.role}</span>
              <strong>{item.name || '____________________________'}</strong>
              {item.title && <small>{item.title}</small>}
            </div>
          ))}
        </div>
      </section>}
    </article>
  )
}
