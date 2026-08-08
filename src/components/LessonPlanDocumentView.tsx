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
  const sessionSummary = `${model.lesson.sessions} session(s), ${model.lesson.duration}`
  const schedule = [model.lesson.lessonDate, model.lesson.weekLabel].filter((value) => value && value !== 'Not specified').join(' · ')

  return (
    <article className="lesson-print-document">
      {model.status !== 'final' && <div className="print-draft-banner">{model.status.toUpperCase()} COPY</div>}
      <header className="print-document-header">
        <p>Republic of the Philippines</p>
        <strong>Department of Education</strong>
        <p>{model.identity.region}</p>
        <p>{model.identity.division}</p>
        <p className="print-school-name">{model.identity.schoolName}</p>
        <h1>{model.documentTitle}</h1>
      </header>

      <table className="print-meta-table">
        <tbody>
          <tr><th>Lesson Title</th><td>{model.lesson.title}</td><th>Learning Area/s</th><td>{model.lesson.learningArea}</td></tr>
          <tr><th>Name of Teacher/s</th><td>{model.identity.teacherName}</td><th>Grade Level and Section</th><td>{gradeAndSection}</td></tr>
          <tr><th>No. of Sessions</th><td>{sessionSummary}</td><th>Date / Week</th><td>{schedule || 'Not specified'}</td></tr>
          <tr><th>School Year</th><td>{model.lesson.schoolYear}</td><th>Term / Curriculum Period</th><td>{model.lesson.gradingTerm} / {model.lesson.curriculumPeriod}</td></tr>
          <tr><th>References</th><td colSpan={3}><div className="print-preserve-lines">{model.references || 'Not specified'}</div></td></tr>
        </tbody>
      </table>

      <IlawBlock letter="I" title="INTENTIONS" fields={model.ilaw.intentions} />
      <IlawBlock letter="L" title="LEARNING EXPERIENCE" fields={model.ilaw.learningExperience} />
      <IlawBlock letter="A" title="ASSESSING LEARNING" fields={model.ilaw.assessingLearning} />
      <IlawBlock letter="W" title="WAYS FORWARD" fields={model.ilaw.waysForward} />

      {model.signatories.length > 0 && <section className="print-signatories">
        {model.signatories.map((item) => <div key={item.role}><span>{item.role}</span><strong>{item.name || '____________________________'}</strong><small>{item.title}</small></div>)}
      </section>}
    </article>
  )
}
