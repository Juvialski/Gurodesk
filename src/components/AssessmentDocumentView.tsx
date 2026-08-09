import type { AssessmentAnswer } from '../types/assessment'
import type { AssessmentExportModel, AssessmentExportQuestion } from '../types/assessmentExport'

function answerText(answer: AssessmentAnswer) {
  if (answer.type === 'multiple_choice') {
    const choiceIndex = answer.choices.findIndex((item) => item.id === answer.choiceId)
    const choice = answer.choices[choiceIndex]
    return choice ? `(${String.fromCharCode(65 + choiceIndex)}) ${choice.text}` : '—'
  }
  if (answer.type === 'true_false') return answer.value ? 'True' : 'False'
  if (answer.type === 'short_answer') return answer.acceptedAnswers.join(' / ')
  return answer.expectedResponse
}

function answerKeyText(answer: AssessmentAnswer) {
  if (answer.type === 'multiple_choice') {
    const choiceIndex = answer.choices.findIndex((item) => item.id === answer.choiceId)
    return choiceIndex >= 0 ? String.fromCharCode(65 + choiceIndex) : '—'
  }
  if (answer.type === 'true_false') return answer.value ? 'T' : 'F'
  if (answer.type === 'short_answer') return answer.acceptedAnswers.join(' / ')
  return answer.expectedResponse
}

function choicesFor(question: AssessmentExportQuestion) {
  if (!('choices' in question) || !Array.isArray(question.choices)) return []
  return question.choices
}

function answerSpaceFor(question: AssessmentExportQuestion) {
  return 'answerSpaceLines' in question ? question.answerSpaceLines : 0
}

export function AssessmentDocumentView({
  model,
  showCompetency = false,
  showCognitive = false,
  showRationale = false,
}: {
  model: AssessmentExportModel
  showCompetency?: boolean
  showCognitive?: boolean
  showRationale?: boolean
}) {
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
      {model.instructions && <div className="assessment-document-instructions"><strong>{model.labels.instructions}</strong><p>{model.instructions}</p></div>}
    </header>
    <div className="assessment-document-items">
      {model.questions.map((question) => {
        const choices = choicesFor(question)
        const answer = 'answer' in question ? question.answer : undefined
        return <section className={`assessment-document-question assessment-question-${question.questionType}`} key={question.itemNumber}>
          <div className="assessment-document-question-head"><strong>{question.itemNumber}.</strong>{!isStudent && question.points ? <small>{question.points} {model.labels.points}</small> : null}</div>
          {!isAnswerKey && <>
            <p className="assessment-document-prompt">{'prompt' in question ? question.prompt : ''}</p>
            {question.questionType === 'multiple_choice' && <ol className="assessment-document-choices" type="A">{choices.map((choice, index) => <li key={typeof choice === 'string' ? `${index}-${choice}` : choice.id}>{typeof choice === 'string' ? choice : choice.text}</li>)}</ol>}
            {question.questionType !== 'multiple_choice' && <div className="assessment-document-answer-space">{Array.from({ length: answerSpaceFor(question) }).map((_, index) => <span key={index}>{model.labels.responseLine}: __________________________________________</span>)}</div>}
            {!isStudent && answer && <p className="assessment-document-annotation"><strong>{model.labels.answer}:</strong> {answerText(answer)}</p>}
          </>}
          {isAnswerKey && answer && <div className="assessment-document-answer-key"><strong>{answerKeyText(answer)}</strong></div>}
          {!isStudent && !isAnswerKey && showCompetency && 'competency' in question && question.competency && <p className="assessment-document-annotation"><strong>{model.labels.competency}:</strong> {question.competency.code ? `${question.competency.code} · ` : ''}{question.competency.text}</p>}
          {!isStudent && !isAnswerKey && showCognitive && 'cognitiveCategory' in question && question.cognitiveCategory && <p className="assessment-document-annotation"><strong>{model.labels.cognitiveCategory}:</strong> {question.cognitiveCategory.label}</p>}
          {!isStudent && !isAnswerKey && showRationale && 'rationale' in question && question.rationale && <p className="assessment-document-annotation"><strong>{model.labels.rationale}:</strong> {question.rationale}</p>}
        </section>
      })}
    </div>
  </article>
}

