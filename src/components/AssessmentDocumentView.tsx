import type { AssessmentAnswer, QuestionType } from '../types/assessment'
import type { AssessmentExportModel, AssessmentExportQuestion } from '../types/assessmentExport'
import {
  assessmentQuestionKeepTogether,
  assessmentResponseKind,
  assessmentSectionTitle,
  assessmentUsesContiguousTypeSections,
  recommendedAssessmentResponseLines,
} from '../lib/assessmentExportPresentation'
import { normalizeAssessmentMathText } from '../lib/assessmentMathText'
import { AssessmentSvgDiagram } from './AssessmentDiagram'

function object(value: unknown): Record<string, unknown> { return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {} }
function array(value: unknown) { return Array.isArray(value) ? value : [] }
function visibleLabel(index: number) { return String.fromCharCode(65 + index) }
function text(value: unknown) { return normalizeAssessmentMathText(String(value ?? '')) }

function answerText(answer: AssessmentAnswer) {
  const value = answer as unknown as Record<string, unknown>
  if (answer.type === 'multiple_choice') {
    const choices = array(value.choices).map(object)
    const index = choices.findIndex((choice) => String(choice.id) === answer.choiceId)
    return index >= 0 ? `${visibleLabel(index)}. ${text(choices[index].text)}` : 'Review choice mapping'
  }
  if (answer.type === 'true_false') return answer.value ? 'True' : 'False'
  if (answer.type === 'short_answer' || answer.type === 'identification') return array(value.acceptedAnswers).map(text).join(' / ')
  if (answer.type === 'fill_in_the_blank') return array(value.blanks).map((entry, index) => { const blank = object(entry); const points = Number(blank.pointsPossible); return `${visibleLabel(index)}. ${array(blank.acceptedAnswers).map(text).join(' / ')}${Number.isFinite(points) ? ` - ${points} pt${points === 1 ? '' : 's'}` : ''}` }).join(' | ')
  if (answer.type === 'numerical_answer') return `${String(value.value ?? '')}${value.unit ? ` ${text(value.unit)}` : ''}${value.tolerance !== undefined ? ` (+/-${String(value.tolerance)})` : ''}`
  if (answer.type === 'problem_solving') return text(value.finalAnswer)
  if (answer.type === 'matching') {
    const prompts = array(value.prompts).map(object); const choices = array(value.choices).map(object)
    return array(value.mappings).map((entry) => {
      const pair = object(entry)
      const prompt = prompts.findIndex((candidate) => String(candidate.id) === String(pair.promptId)); const choice = choices.findIndex((candidate) => String(candidate.id) === String(pair.choiceId))
      const points = Number(pair.pointsPossible)
      return `${prompt >= 0 ? prompt + 1 : String(pair.promptId)} -> ${choice >= 0 ? visibleLabel(choice) : String(pair.choiceId)}${Number.isFinite(points) ? ` - ${points} pt${points === 1 ? '' : 's'}` : ''}`
    }).join(', ')
  }
  if (answer.type === 'multiple_select') {
    const choices = array(value.choices).map(object)
    return array(value.choiceIds).map((id) => { const index = choices.findIndex((choice) => String(choice.id) === String(id)); return index >= 0 ? visibleLabel(index) : '' }).filter(Boolean).join(', ')
  }
  if (answer.type === 'constructed_response') return text(value.expectedResponse)
  if (answer.type === 'essay') return 'See rubric / scoring guide; no single exact response.'
  return ''
}

function choicesFor(question: AssessmentExportQuestion) { return 'choices' in question && Array.isArray(question.choices) ? question.choices : [] }
function promptsFor(question: AssessmentExportQuestion) { return 'prompts' in question && Array.isArray(question.prompts) ? question.prompts : [] }
function blanksFor(question: AssessmentExportQuestion) { return 'blanks' in question && Array.isArray(question.blanks) ? question.blanks : [] }
function subpartsFor(question: AssessmentExportQuestion) { return 'subparts' in question && Array.isArray(question.subparts) ? question.subparts : [] }
function choiceText(choice: string | { text: string }) { return text(typeof choice === 'string' ? choice : choice.text) }

function StudentResponse({ model, question }: { model: AssessmentExportModel; question: AssessmentExportQuestion }) {
  const kind = assessmentResponseKind(question)
  if (kind === 'none' || kind === 'matching' || kind === 'fill_inline') return null
  if (kind === 'true_false') return <div className="assessment-document-true-false"><span className="assessment-document-checkbox" /> True <span className="assessment-document-checkbox" /> False</div>
  if (kind === 'numerical') return <div className="assessment-document-numerical"><span>Answer: ____________________</span><span>Unit: __________</span></div>
  if (kind === 'fill_structured') return <div className="assessment-document-answer-space">{(blanksFor(question).length ? blanksFor(question) : [{ label: 'A' }]).map((blank) => <span key={blank.label}>{model.labels.answer} {blank.label}: __________________________________________</span>)}</div>
  if (kind === 'single_line') return <div className="assessment-document-answer-space"><span>______________________________________________</span></div>
  return <div className="assessment-document-answer-space">{Array.from({ length: recommendedAssessmentResponseLines(question) }).map((_, index) => <span key={index}>________________________________________________________</span>)}</div>
}

export function AssessmentDocumentView({ model, showCompetency = false, showCognitive = false, showRationale = false }: { model: AssessmentExportModel; showCompetency?: boolean; showCognitive?: boolean; showRationale?: boolean }) {
  const isStudent = model.mode === 'student'; const isAnswerKey = model.mode === 'answer_key'
  const showSections = !isAnswerKey && assessmentUsesContiguousTypeSections(model.questions)
  let priorType: QuestionType | null = null; let sectionIndex = -1
  return <article className={`assessment-document assessment-document-${model.mode}`}>
    <header className="assessment-document-header">
      {!isStudent && <span className="assessment-document-kicker">{model.labels.documentTitle}</span>}
      <h1>{model.title}</h1>
      <div className="assessment-document-meta">
        <span>{model.labels.teacher}: {model.metadata.teacherName || '____________________________'}</span><span>{model.labels.school}: {model.metadata.schoolName || '____________________________'}</span>
        <span>{model.labels.gradeLevel}: {model.metadata.gradeLevel || '________________'}</span><span>{model.labels.learningArea}: {model.metadata.learningArea || '________________'}</span>
        <span>{model.labels.schoolYear}: {model.metadata.schoolYear || '________________'}</span>{model.metadata.gradingTerm && <span>{model.labels.gradingTerm}: {model.metadata.gradingTerm}</span>}
        {model.metadata.curriculumPeriods && !isStudent && <span>{model.labels.curriculumPeriods}: {model.metadata.curriculumPeriods}</span>}
        {isStudent && <><span>{model.labels.learnerName}: ____________________________</span><span>{model.labels.section}: ____________________________</span></>}
      </div>
      <div className="assessment-document-summary"><span>{model.labels.totalItems}: {model.metadata.totalItems ?? model.questions.length}</span><span>{model.labels.totalPoints}: {model.metadata.totalPoints ?? model.questions.reduce((sum, item) => sum + item.pointsPossible, 0)}</span></div>
      {model.instructions && <div className="assessment-document-instructions"><strong>{model.labels.instructions}</strong><p>{text(model.instructions)}</p></div>}
    </header>
    <div className="assessment-document-items">
      {model.questions.map((question) => {
        const newSection = showSections && question.questionType !== priorType
        if (newSection) { sectionIndex += 1; priorType = question.questionType }
        const choices = choicesFor(question); const prompts = promptsFor(question); const subparts = subpartsFor(question); const answer = 'answer' in question ? question.answer : undefined
        return <div key={question.itemNumber} className="assessment-document-question-wrapper">
          {newSection && <h2 className="assessment-document-section-heading">{assessmentSectionTitle(question.questionType, sectionIndex)}</h2>}
          <section className={`assessment-document-question assessment-question-${question.questionType} ${assessmentQuestionKeepTogether(question) ? 'assessment-question-keep' : 'assessment-question-flow'}`}>
            {!isAnswerKey && 'prompt' in question && <>
              <div className="assessment-document-question-core">
                <div className="assessment-document-question-head"><strong>{question.itemNumber}.</strong>{(!isStudent || question.pointsPossible > 1) && <small>{question.pointsPossible} {model.labels.points}</small>}</div>
                <p className="assessment-document-prompt">{text(question.prompt)}</p>
                {question.visual && <AssessmentSvgDiagram visual={question.visual} className={`assessment-document-question-visual ${question.visual.primitives.some((primitive) => primitive.type === 'cartesianAxes') ? 'assessment-document-question-visual-cartesian' : ''}`} />}
                {subparts.length > 0 && <ol className="assessment-document-subparts" type="a">{subparts.map((part) => <li key={`${part.label}-${part.prompt}`}>{text(part.prompt)} <small>({part.pointsPossible} {model.labels.points})</small></li>)}</ol>}
                {(question.questionType === 'multiple_choice' || question.questionType === 'multiple_select') && <div className="assessment-document-choices">{choices.map((choice, index) => <div className="assessment-document-choice-row" key={`${index}-${choiceText(choice)}`}><span className="assessment-document-choice-label">{visibleLabel(index)}.</span>{question.questionType === 'multiple_select' && <span className="assessment-document-checkbox" />}{choiceText(choice)}</div>)}</div>}
                {question.questionType === 'matching' && <div className="assessment-document-matching-grid"><div><strong>{model.labels.columnA}</strong>{prompts.map((prompt, index) => <div key={`${index}-${typeof prompt === 'string' ? prompt : prompt.text}`}>_____ {index + 1}. {text(typeof prompt === 'string' ? prompt : prompt.text)}</div>)}</div><div><strong>{model.labels.columnB}</strong>{choices.map((choice, index) => <div key={`${index}-${choiceText(choice)}`}>{visibleLabel(index)}. {choiceText(choice)}</div>)}</div></div>}
              </div>
              {assessmentResponseKind(question) === 'extended' && 'responseInstructions' in question && question.responseInstructions && <p className="assessment-document-response-instructions">{text(question.responseInstructions)}</p>}
              <StudentResponse model={model} question={question} />
              {!isStudent && answer && <p className="assessment-document-annotation"><strong>{model.labels.answer}:</strong> {answerText(answer)}</p>}
            </>}
            {isAnswerKey && <><div className="assessment-document-question-head"><strong>{question.itemNumber}.</strong>{question.pointsPossible > 1 && <small>{question.pointsPossible} {model.labels.points}</small>}</div>{answer && <div className="assessment-document-answer-key"><strong>{answerText(answer)}</strong>{'scoringGuide' in question && question.scoringGuide && <p>{text(question.scoringGuide)}</p>}</div>}{question.visual && <AssessmentSvgDiagram visual={question.visual} className="assessment-document-question-visual" />}</>}
            {!isStudent && !isAnswerKey && 'scoringGuide' in question && question.scoringGuide && <p className="assessment-document-annotation"><strong>{model.labels.solution}:</strong> {text(question.scoringGuide)}</p>}
            {!isStudent && !isAnswerKey && showCompetency && 'competency' in question && question.competency && <p className="assessment-document-annotation"><strong>{model.labels.competency}:</strong> {question.competency.code ? `${question.competency.code} - ` : ''}{text(question.competency.text)}</p>}
            {!isStudent && !isAnswerKey && showCognitive && 'cognitiveCategory' in question && question.cognitiveCategory && <p className="assessment-document-annotation"><strong>{model.labels.cognitiveCategory}:</strong> {text(question.cognitiveCategory.label)}</p>}
            {!isStudent && !isAnswerKey && showRationale && 'rationale' in question && question.rationale && <p className="assessment-document-annotation"><strong>{model.labels.rationale}:</strong> {text(question.rationale)}</p>}
          </section>
        </div>
      })}
    </div>
  </article>
}
