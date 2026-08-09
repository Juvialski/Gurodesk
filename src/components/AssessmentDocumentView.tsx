import type { AssessmentAnswer } from '../types/assessment'
import type { AssessmentExportModel, AssessmentExportQuestion } from '../types/assessmentExport'

function object(value: unknown): Record<string, unknown> { return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {} }
function array(value: unknown) { return Array.isArray(value) ? value : [] }
function visibleLabel(index: number) { return String.fromCharCode(65 + index) }

function answerText(answer: AssessmentAnswer) {
  const value = answer as unknown as Record<string, unknown>
  if (answer.type === 'multiple_choice') {
    const choices = array(value.choices).map(object)
    const index = choices.findIndex((choice) => String(choice.id) === answer.choiceId)
    return index >= 0 ? `${visibleLabel(index)}. ${String(choices[index].text ?? '')}` : 'Review choice mapping'
  }
  if (answer.type === 'true_false') return answer.value ? 'True' : 'False'
  if (answer.type === 'short_answer' || answer.type === 'identification') return array(value.acceptedAnswers).map(String).join(' / ')
  if (answer.type === 'fill_in_the_blank') return array(value.blanks).map((entry, index) => { const blank = object(entry); const points = Number(blank.pointsPossible); return `${visibleLabel(index)}. ${array(blank.acceptedAnswers).map(String).join(' / ')}${Number.isFinite(points) ? ` — ${points} pt${points === 1 ? '' : 's'}` : ''}` }).join(' · ')
  if (answer.type === 'numerical_answer') return `${String(value.value ?? '')}${value.unit ? ` ${String(value.unit)}` : ''}${value.tolerance !== undefined ? ` (±${String(value.tolerance)})` : ''}`
  if (answer.type === 'problem_solving') return String(value.finalAnswer ?? '')
  if (answer.type === 'matching') {
    const prompts = array(value.prompts).map(object)
    const choices = array(value.choices).map(object)
    return array(value.mappings).map((entry) => {
      const pair = object(entry)
      const prompt = prompts.findIndex((candidate) => String(candidate.id) === String(pair.promptId))
      const choice = choices.findIndex((candidate) => String(candidate.id) === String(pair.choiceId))
      const points = Number(pair.pointsPossible)
      return `${prompt >= 0 ? prompt + 1 : String(pair.promptId)} → ${choice >= 0 ? visibleLabel(choice) : String(pair.choiceId)}${Number.isFinite(points) ? ` — ${points} pt${points === 1 ? '' : 's'}` : ''}`
    }).join(', ')
  }
  if (answer.type === 'multiple_select') {
    const choices = array(value.choices).map(object)
    return array(value.choiceIds).map((id) => { const index = choices.findIndex((choice) => String(choice.id) === String(id)); return index >= 0 ? visibleLabel(index) : '' }).filter(Boolean).join(', ')
  }
  if (answer.type === 'constructed_response') return String(value.expectedResponse ?? '')
  if (answer.type === 'essay') return 'See rubric / scoring guide; no single exact response.'
  return ''
}

function choicesFor(question: AssessmentExportQuestion) { return 'choices' in question && Array.isArray(question.choices) ? question.choices : [] }
function promptsFor(question: AssessmentExportQuestion) { return 'prompts' in question && Array.isArray(question.prompts) ? question.prompts : [] }
function subpartsFor(question: AssessmentExportQuestion) { return 'subparts' in question && Array.isArray(question.subparts) ? question.subparts : [] }

export function AssessmentDocumentView({ model, showCompetency = false, showCognitive = false, showRationale = false }: { model: AssessmentExportModel; showCompetency?: boolean; showCognitive?: boolean; showRationale?: boolean }) {
  const isStudent = model.mode === 'student'
  const isAnswerKey = model.mode === 'answer_key'
  return <article className={`assessment-document assessment-document-${model.mode}`}>
    <header className="assessment-document-header">
      {!isStudent && <span className="assessment-document-kicker">{model.labels.documentTitle}</span>}
      <h1>{model.title}</h1>
      <div className="assessment-document-meta">
        <span>{model.labels.teacher}: {model.metadata.teacherName || '____________________________'}</span>
        <span>{model.labels.school}: {model.metadata.schoolName || '____________________________'}</span>
        <span>{model.labels.gradeLevel}: {model.metadata.gradeLevel || '________________'}</span>
        <span>{model.labels.learningArea}: {model.metadata.learningArea || '________________'}</span>
        <span>{model.labels.schoolYear}: {model.metadata.schoolYear || '________________'}</span>
        {model.metadata.gradingTerm && <span>{model.labels.gradingTerm}: {model.metadata.gradingTerm}</span>}
        {model.metadata.curriculumPeriods && !isStudent && <span>{model.labels.curriculumPeriods}: {model.metadata.curriculumPeriods}</span>}
        {isStudent && <><span>{model.labels.learnerName}: ____________________________</span><span>{model.labels.section}: ____________________________</span></>}
      </div>
      <div className="assessment-document-summary"><span>{model.labels.totalItems}: {model.metadata.totalItems ?? model.questions.length}</span><span>{model.labels.totalPoints}: {model.metadata.totalPoints ?? model.questions.reduce((sum, item) => sum + item.pointsPossible, 0)}</span></div>
      {model.instructions && <div className="assessment-document-instructions"><strong>{model.labels.instructions}</strong><p>{model.instructions}</p></div>}
    </header>
    <div className="assessment-document-items">
      {model.questions.map((question) => {
        const choices = choicesFor(question)
        const prompts = promptsFor(question)
        const subparts = subpartsFor(question)
        const answer = 'answer' in question ? question.answer : undefined
        return <section className={`assessment-document-question assessment-question-${question.questionType}`} key={question.itemNumber}>
          <div className="assessment-document-question-head"><strong>{question.itemNumber}.</strong>{(!isStudent || question.pointsPossible > 1) && <small>{question.pointsPossible} {model.labels.points}</small>}</div>
          {!isAnswerKey && 'prompt' in question && <>
            <p className="assessment-document-prompt">{question.prompt}</p>
            {subparts.length > 0 && <ol className="assessment-document-subparts" type="a">{subparts.map((part) => <li key={`${part.label}-${part.prompt}`}>{part.prompt} <small>({part.pointsPossible} {model.labels.points})</small></li>)}</ol>}
            {(question.questionType === 'multiple_choice' || question.questionType === 'multiple_select') && <ol className="assessment-document-choices" type="A">{choices.map((choice, index) => <li key={typeof choice === 'string' ? `${index}-${choice}` : `${index}-${choice.text}`}>{typeof choice === 'string' ? choice : choice.text}</li>)}</ol>}
            {question.questionType === 'matching' && <div className="assessment-document-matching"><strong>{model.labels.columnA}</strong>{prompts.map((prompt, index) => <div key={typeof prompt === 'string' ? prompt : prompt.text}>_____ {index + 1}. {typeof prompt === 'string' ? prompt : prompt.text}</div>)}<strong>{model.labels.columnB}</strong>{choices.map((choice, index) => <div key={typeof choice === 'string' ? choice : choice.text}>{visibleLabel(index)}. {typeof choice === 'string' ? choice : choice.text}</div>)}</div>}
            {question.questionType !== 'multiple_choice' && question.questionType !== 'multiple_select' && question.questionType !== 'matching' && <div className="assessment-document-answer-space">{Array.from({ length: question.answerSpaceLines }).map((_, index) => <span key={index}>{model.labels.responseLine}: __________________________________________</span>)}</div>}
            {'responseInstructions' in question && question.responseInstructions && <p className="assessment-document-annotation"><strong>{model.labels.instructions}:</strong> {question.responseInstructions}</p>}
            {!isStudent && answer && <p className="assessment-document-annotation"><strong>{model.labels.answer}:</strong> {answerText(answer)}</p>}
          </>}
          {isAnswerKey && answer && <div className="assessment-document-answer-key"><strong>{answerText(answer)}</strong>{'scoringGuide' in question && question.scoringGuide && <p>{question.scoringGuide}</p>}</div>}
          {!isStudent && !isAnswerKey && 'scoringGuide' in question && question.scoringGuide && <p className="assessment-document-annotation"><strong>{model.labels.solution}:</strong> {question.scoringGuide}</p>}
          {!isStudent && !isAnswerKey && showCompetency && 'competency' in question && question.competency && <p className="assessment-document-annotation"><strong>{model.labels.competency}:</strong> {question.competency.code ? `${question.competency.code} · ` : ''}{question.competency.text}</p>}
          {!isStudent && !isAnswerKey && showCognitive && 'cognitiveCategory' in question && question.cognitiveCategory && <p className="assessment-document-annotation"><strong>{model.labels.cognitiveCategory}:</strong> {question.cognitiveCategory.label}</p>}
          {!isStudent && !isAnswerKey && showRationale && 'rationale' in question && question.rationale && <p className="assessment-document-annotation"><strong>{model.labels.rationale}:</strong> {question.rationale}</p>}
        </section>
      })}
    </div>
  </article>
}
