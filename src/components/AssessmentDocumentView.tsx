import type { AssessmentExportModel } from '../types/assessmentExport'
import {
  buildAssessmentPaperPresentation,
  type AssessmentPaperAnnotation,
  type AssessmentPaperQuestion,
} from '../lib/assessmentExportPresentation'
import { AssessmentDiagram } from './AssessmentDiagram'

function visibleAnnotation(annotation: AssessmentPaperAnnotation, options: { showCompetency: boolean; showCognitive: boolean; showRationale: boolean }) {
  if (annotation.kind === 'competency') return options.showCompetency
  if (annotation.kind === 'cognitive') return options.showCognitive
  if (annotation.kind === 'rationale') return options.showRationale
  return true
}

function StudentResponse({ question }: { question: AssessmentPaperQuestion }) {
  const response = question.response
  if (response.kind === 'none' || response.kind === 'matching' || response.kind === 'fill_inline' || response.kind === 'true_false') return null
  if (response.kind === 'numerical') return <div className="assessment-document-numerical"><span>{response.answerLabel}: ____________________</span><span>{response.unitLabel}: __________</span></div>
  if (response.kind === 'fill_structured') return <div className="assessment-document-answer-space">{response.blankLabels.map((label) => <span key={label}>{response.answerLabel} {label}: __________________________________________</span>)}</div>
  return <>
    {response.instructions && <p className="assessment-document-response-instructions">{response.instructions}</p>}
    <div className="assessment-document-answer-space assessment-document-answer-space-full">
      {Array.from({ length: Math.max(1, response.lines) }).map((_, index) => (
        <span
          aria-hidden="true"
          className="assessment-document-answer-line"
          key={index}
          style={{ display: 'block', width: '100%', minHeight: '18px', borderBottom: '1px solid #7d858d' }}
        />
      ))}
    </div>
  </>
}

function QuestionCore({ question }: { question: AssessmentPaperQuestion }) {
  return <div className="assessment-document-question-core">
    <div className="assessment-document-question-head"><strong>{question.numberLabel}</strong>{question.pointLabel && <small>{question.pointLabel}</small>}</div>
    <p className="assessment-document-prompt">{question.prompt}</p>
    {question.visual && <AssessmentDiagram visual={question.visual} className={`assessment-document-question-visual ${question.visualScale === 'cartesian' ? 'assessment-document-question-visual-cartesian' : question.visualScale === 'large' ? 'assessment-document-question-visual-large' : ''}`} />}
    {question.subparts.length > 0 && <ol className="assessment-document-subparts" type="a">{question.subparts.map((part) => <li key={`${part.label}-${part.prompt}`}>{part.prompt} <small>({part.pointLabel})</small></li>)}</ol>}
    {(question.questionType === 'multiple_choice' || question.questionType === 'multiple_select') && <div className="assessment-document-choices">{question.choices.map((choice) => <div className="assessment-document-choice-row" key={`${choice.label}-${choice.text}`}><span className="assessment-document-choice-label">{choice.label}.</span>{choice.checkbox && <span className="assessment-document-checkbox" />}{choice.text}</div>)}</div>}
    {question.questionType === 'matching' && <div className="assessment-document-matching-grid"><div><strong>{question.matching.columnALabel}</strong>{question.matching.prompts.map((prompt) => <div key={`${prompt.label}-${prompt.text}`}>_____ {prompt.label}. {prompt.text}</div>)}</div><div><strong>{question.matching.columnBLabel}</strong>{question.matching.choices.map((choice) => <div key={`${choice.label}-${choice.text}`}>{choice.label}. {choice.text}</div>)}</div></div>}
  </div>
}

export function AssessmentDocumentView({ model, showCompetency = false, showCognitive = false, showRationale = false }: { model: AssessmentExportModel; showCompetency?: boolean; showCognitive?: boolean; showRationale?: boolean }) {
  const paper = buildAssessmentPaperPresentation(model)
  const isStudent = paper.mode === 'student'
  const isAnswerKey = paper.mode === 'answer_key'
  const annotationOptions = { showCompetency, showCognitive, showRationale }
  return <article className={`assessment-document assessment-document-${paper.mode}`} data-paper-model="assessment-paper-v1">
    <div className="assessment-document-continuation" aria-hidden="true"><strong>{paper.header.continuationDocumentTitle}</strong><span>{paper.header.continuationAssessmentTitle}</span></div>
    <header className="assessment-document-header">
      <div className="assessment-document-identity">{paper.header.identityLines.map((line) => <span key={line.role} className={`assessment-document-identity-${line.role}`}>{line.text}</span>)}</div>
      <span className="assessment-document-kicker">{paper.header.documentTitle}</span>
      <h1>{paper.header.assessmentTitle}</h1>
      <div className="assessment-document-meta-table">{paper.header.metadataRows.map((row, rowIndex) => <div className="assessment-document-meta-row" key={rowIndex} style={{ gridTemplateColumns: `repeat(${row.length}, minmax(0, 1fr))` }}>{row.map((field) => <span key={field.key}><strong>{field.label}:</strong> {field.value || field.placeholder || ''}</span>)}</div>)}</div>
      {paper.header.instructions && <div className="assessment-document-instructions"><strong>{paper.header.instructionsLabel}</strong><p>{paper.header.instructions}</p></div>}
    </header>
    <div className="assessment-document-items">
      {paper.sections.map((section) => <div className="assessment-document-section" key={section.key}>
        {section.title && <div className="assessment-document-section-head"><h2 className="assessment-document-section-heading">{section.title}</h2>{section.directions && <p className="assessment-document-section-directions">{section.directions}</p>}</div>}
        {section.questions.map((question) => {
          const annotations = question.annotations.filter((annotation) => visibleAnnotation(annotation, annotationOptions))
          return <div key={question.key} className="assessment-document-question-wrapper">
            <section className={`assessment-document-question assessment-question-${question.questionType} ${question.keepTogether ? 'assessment-question-keep' : 'assessment-question-flow'}`}>
              {!isAnswerKey && <><QuestionCore question={question} /><StudentResponse question={question} />{!isStudent && annotations.map((annotation) => <p className="assessment-document-annotation" data-annotation-kind={annotation.kind} key={`${annotation.kind}-${annotation.label}`}><strong>{annotation.label}:</strong> {annotation.text}</p>)}</>}
              {isAnswerKey && <><div className="assessment-document-question-head"><strong>{question.numberLabel}</strong>{question.pointLabel && <small>{question.pointLabel}</small>}</div>{annotations.map((annotation) => <div className={annotation.kind === 'answer' ? 'assessment-document-answer-key' : 'assessment-document-annotation'} data-annotation-kind={annotation.kind} key={`${annotation.kind}-${annotation.label}`}><strong>{annotation.label}:</strong> {annotation.text}</div>)}{question.visual && <AssessmentDiagram visual={question.visual} className={`assessment-document-question-visual ${question.visualScale === 'cartesian' ? 'assessment-document-question-visual-cartesian' : question.visualScale === 'large' ? 'assessment-document-question-visual-large' : ''}`} />}</>}
            </section>
          </div>
        })}
      </div>)}
    </div>
  </article>
}
