import type { LessonPlanExportModel } from '../types/export'

function ExportField({ label, body }: { label: string; body: string }) {
  if (!body.trim()) return null
  return <div className="print-field"><strong>{label}</strong><div className="print-preserve-lines">{body}</div></div>
}

function IlawBlock({ letter, title, fields }: { letter: string; title: string; fields: LessonPlanExportModel['ilaw']['intentions'] }) {
  return (
    <section className="print-ilaw-block">
      <div className="print-section-heading"><span>{letter}</span><strong>{title}</strong></div>
      {fields.map((field) => <ExportField key={field.key} label={field.heading} body={field.body} />)}
    </section>
  )
}

export function LessonPlanDocumentView({ model }: { model: LessonPlanExportModel }) {
  return (
    <article className="lesson-print-document">
      {model.status !== 'final' && <div className="print-draft-banner">{model.status.toUpperCase()} COPY</div>}
      <header className="print-document-header">
        <p>Republic of the Philippines</p>
        <strong>Department of Education</strong>
        <p>{model.identity.region}</p>
        <p>{model.identity.division}</p>
        <h1>{model.documentTitle}</h1>
        <h2>{model.lesson.title}</h2>
      </header>

      <table className="print-meta-table">
        <tbody>
          <tr><th>School</th><td>{model.identity.schoolName}</td><th>School Year</th><td>{model.lesson.schoolYear}</td></tr>
          <tr><th>Teacher</th><td>{model.identity.teacherName}</td><th>Grade Level</th><td>{model.lesson.gradeLevel}</td></tr>
          <tr><th>Learning Area</th><td>{model.lesson.learningArea}</td><th>Sections</th><td>{model.lesson.sections}</td></tr>
          <tr><th>Lesson Date</th><td>{model.lesson.lessonDate}</td><th>Week / Schedule</th><td>{model.lesson.weekLabel}</td></tr>
          <tr><th>Curriculum-guide Period</th><td>{model.lesson.curriculumPeriod}</td><th>School Grading Term</th><td>{model.lesson.gradingTerm}</td></tr>
          <tr><th>No. of Sessions</th><td>{model.lesson.sessions}</td><th>Duration</th><td>{model.lesson.duration}</td></tr>
        </tbody>
      </table>

      <section className="print-context-block">
        <h3>Verified Curriculum Context</h3>
        <ExportField label={model.competency.label} body={model.competency.text} />
        <ExportField label="Performance standard" body={model.competency.performanceStandard} />
        <ExportField label="Source provenance" body={model.competency.source} />
      </section>

      <IlawBlock letter="I" title="Intentions" fields={model.ilaw.intentions} />
      <IlawBlock letter="L" title="Learning Experience" fields={model.ilaw.learningExperience} />
      <IlawBlock letter="A" title="Assessing Learning" fields={model.ilaw.assessingLearning} />
      <IlawBlock letter="W" title="Ways Forward" fields={model.ilaw.waysForward} />

      <section className="print-context-block">
        <h3>References</h3>
        <ExportField label="Teacher-entered references" body={model.references} />
      </section>

      {model.aiDeclaration && <section className="print-context-block print-ai-block"><h3>AI Use Declaration</h3><p>{model.aiDeclaration}</p></section>}

      {model.signatories.length > 0 && <section className="print-signatories">
        {model.signatories.map((item) => <div key={item.role}><span>{item.role}</span><strong>{item.name || '____________________________'}</strong><small>{item.title}</small></div>)}
      </section>}

      <footer className="print-document-footer">
        <p>Generated using the GuroDesk ILAW Standard template. GuroDesk is an independent tool and does not imply DepEd endorsement.</p>
      </footer>
    </article>
  )
}
