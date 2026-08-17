import type { LessonPlanExportModel, LessonPlanMultiSessionExportModel } from '../types/export'

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

function LessonPlanMultiSessionView({ multi }: { multi: LessonPlanMultiSessionExportModel }) {
  const gradeAndSection = `${multi.lesson.gradeLevel}${multi.lesson.sections && multi.lesson.sections !== 'Not specified' ? ` – ${multi.lesson.sections}` : ''}`
  const sessionSummary = `${multi.lesson.sessions} ${multi.labels.sessionUnit}, ${multi.lesson.duration}`
  const copyLabel = multi.status === 'archived' ? multi.labels.archivedCopy : multi.labels.draftCopy

  return (
    <article className="lesson-print-document lesson-multisession-document" lang={multi.language === 'filipino' ? 'fil' : 'en'}>
      {multi.status !== 'final' && <div className="print-draft-banner">{copyLabel}</div>}
      <header className="print-document-header">
        <p>{multi.labels.republic}</p>
        <strong>{multi.labels.department}</strong>
        {multi.identity.region && <p>{multi.identity.region}</p>}
        {multi.identity.division && <p>{multi.identity.division}</p>}
        {multi.identity.district && <p>{multi.identity.district}</p>}
        {multi.identity.schoolName && <p className="print-school-name">{multi.identity.schoolName}</p>}
        <h1>{multi.documentTitle}</h1>
      </header>

      {/* Top Metadata Table */}
      <table className="print-meta-table lesson-multisession-meta">
        <tbody>
          <tr>
            <th>Name of Lesson / Pangalan ng Aralin</th>
            <td>{multi.lesson.title}</td>
          </tr>
          <tr>
            <th>Learning Area / Asignatura</th>
            <td>{multi.lesson.learningArea}</td>
          </tr>
          <tr>
            <th>Term / Week</th>
            <td>{multi.lesson.gradingTerm} | {multi.lesson.weekLabel}</td>
          </tr>
          <tr>
            <th>Grade Level & Section</th>
            <td>{gradeAndSection}</td>
          </tr>
          <tr>
            <th>Teacher / Guro</th>
            <td>{multi.identity.teacherName}</td>
          </tr>
          <tr>
            <th>No. of Sessions / Tagal</th>
            <td>{sessionSummary}</td>
          </tr>
          <tr>
            <th>References / Sanggunian</th>
            <td>
              <div className="print-preserve-lines">
                <strong>A. References:</strong>
                {multi.referencesDetail.officialReferences.map((r, i) => <div key={i}>• {r}</div>)}
                <strong style={{ marginTop: '4px', display: 'block' }}>B. Other Learning Sources:</strong>
                {multi.referencesDetail.otherLearningSources.map((r, i) => <div key={i}>{r}</div>)}
                <strong style={{ marginTop: '4px', display: 'block' }}>C. Low-Tech Alternatives:</strong>
                {multi.referencesDetail.lowTechAlternatives.map((r, i) => <div key={i}>{r}</div>)}
              </div>
            </td>
          </tr>
          <tr>
            <th>Declaration of AI use</th>
            <td><em className="print-preserve-lines">{multi.aiDeclarationStatement}</em></td>
          </tr>
        </tbody>
      </table>

      {/* 5-Column Multi-Session Grid Table */}
      <div className="print-section-heading" style={{ marginTop: '16px' }}>
        <strong>ILAW FOUR-SESSION PEDAGOGICAL MATRIX (DepEd Order No. 016, s. 2026)</strong>
      </div>
      <div className="lesson-multisession-table-wrap">
        <table className="lesson-multisession-grid-table">
          <thead>
            <tr>
              <th style={{ width: '24%' }}>Dimensions & Guide Questions</th>
              {multi.sessionHeaders.map((h, idx) => (
                <th key={idx} style={{ width: '19%' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {multi.rows.map((row) => (
              <tr key={row.key}>
                <td className="dimension-col">
                  <strong>{row.heading}</strong>
                  {row.guideQuestions && <small className="guide-question">{row.guideQuestions}</small>}
                </td>
                {row.isFullSpan ? (
                  <td colSpan={4} className="fullspan-col">
                    <div className="print-preserve-lines">{row.fullSpanContent}</div>
                  </td>
                ) : (
                  row.sessions.map((sText, sIdx) => (
                    <td key={sIdx} className="session-col">
                      <div className="print-preserve-lines">{sText || '—'}</div>
                    </td>
                  ))
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Self-Check Rubric Table */}
      <div className="print-section-heading" style={{ marginTop: '20px' }}>
        <strong>RUBRIC FOR LESSON PLANNING SELF-CHECK AND/OR PEER COACHING</strong>
      </div>
      <table className="lesson-rubric-table">
        <thead>
          <tr>
            <th style={{ width: '55%' }}>I can say that in my lesson plan...</th>
            <th style={{ width: '10%', textAlign: 'center' }}>Yes</th>
            <th style={{ width: '10%', textAlign: 'center' }}>Not Yet</th>
            <th style={{ width: '25%' }}>Why? / What will make it better?</th>
          </tr>
        </thead>
        <tbody>
          {multi.rubricItems.map((item, idx) => (
            <tr key={idx}>
              <td>{item.criterion}</td>
              <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{item.status === 'yes' ? '✓' : ''}</td>
              <td style={{ textAlign: 'center' }}>{item.status === 'not_yet' ? '✓' : ''}</td>
              <td><small>{item.improvementNote || ''}</small></td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Instructional Coaching Box */}
      <div className="print-section-heading" style={{ marginTop: '16px' }}>
        <strong>NOTES FOR INSTRUCTIONAL COACHING SESSION</strong>
      </div>
      <div className="lesson-coaching-box">
        <p>{multi.coachingNotes}</p>
        <p className="coaching-placeholder">Observations / Next Coaching Steps: ____________________________________________________________________________________</p>
      </div>

      {/* Signatories */}
      {multi.signatories.length > 0 && (
        <section className="print-signatures" style={{ marginTop: '20px' }}>
          <div className="print-section-heading"><strong>{multi.labels.signatures}</strong></div>
          <div className="print-signature-grid">
            {multi.signatories.map((item) => (
              <div className="print-signature" key={item.role}>
                <span>{item.role}</span>
                <strong>{item.name || '____________________________'}</strong>
                {item.title && <small>{item.title}</small>}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Clean Footer */}
      <footer className="lesson-multisession-footer">
        <small>Prepared with GuroDesk · Philippine Public School Teacher Workspace | DepEd Order No. 016, s. 2026 Compliant · Teacher-Authored Learning Plan</small>
      </footer>
    </article>
  )
}

export function LessonPlanDocumentView({ model }: { model: LessonPlanExportModel }) {
  if (model.templateLabel === 'ILAW Multi-Session Log' && model.multiSession) {
    return <LessonPlanMultiSessionView multi={model.multiSession} />
  }

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
        {model.identity.district && <p>{model.identity.district}</p>}
        {model.identity.schoolName && <p className="print-school-name">{model.identity.schoolName}</p>}
        <h1>{model.documentTitle}</h1>
      </header>

      <table className="print-meta-table">
        <tbody>
          <tr><th>{model.labels.teacher}</th><td>{model.identity.teacherName}</td></tr>
          {model.identity.district && <tr><th>District</th><td>{model.identity.district}</td></tr>}
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
