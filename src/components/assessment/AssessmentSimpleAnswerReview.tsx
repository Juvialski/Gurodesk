import { Check } from 'lucide-react'
import type {
  AssessmentAnswer,
  AssessmentConstructedResponseAnswer,
  AssessmentEssayAnswer,
  AssessmentFillInTheBlankAnswer,
  AssessmentMatchingAnswer,
  AssessmentMultipleChoiceAnswer,
  AssessmentMultipleSelectAnswer,
  AssessmentNumericalAnswer,
  AssessmentProblemSolvingAnswer,
  AssessmentShortAnswer,
  AssessmentTrueFalseAnswer,
  QuestionType,
} from '../../types/assessment'

function visibleLabel(index: number) {
  return String.fromCharCode(65 + index)
}

export function AssessmentSimpleAnswerReview({
  questionType,
  answer,
}: {
  questionType: QuestionType
  answer: AssessmentAnswer
}) {
  if (!answer) return null

  return (
    <div className="assessment-simple-answer-review" data-testid="simple-answer-review">
      {questionType === 'multiple_choice' && (
        <MultipleChoiceReview answer={answer as AssessmentMultipleChoiceAnswer} />
      )}
      {questionType === 'true_false' && (
        <TrueFalseReview answer={answer as AssessmentTrueFalseAnswer} />
      )}
      {(questionType === 'short_answer' || questionType === 'identification') && (
        <ShortAnswerReview answer={answer as AssessmentShortAnswer} />
      )}
      {questionType === 'fill_in_the_blank' && (
        <FillInTheBlankReview answer={answer as AssessmentFillInTheBlankAnswer} />
      )}
      {questionType === 'numerical_answer' && (
        <NumericalAnswerReview answer={answer as AssessmentNumericalAnswer} />
      )}
      {questionType === 'multiple_select' && (
        <MultipleSelectReview answer={answer as AssessmentMultipleSelectAnswer} />
      )}
      {questionType === 'matching' && (
        <MatchingReview answer={answer as AssessmentMatchingAnswer} />
      )}
      {questionType === 'problem_solving' && (
        <ProblemSolvingReview answer={answer as AssessmentProblemSolvingAnswer} />
      )}
      {questionType === 'constructed_response' && (
        <ConstructedResponseReview answer={answer as AssessmentConstructedResponseAnswer} />
      )}
      {questionType === 'essay' && (
        <EssayReview answer={answer as AssessmentEssayAnswer} />
      )}
    </div>
  )
}

function MultipleChoiceReview({ answer }: { answer: AssessmentMultipleChoiceAnswer }) {
  const choices = Array.isArray(answer.choices) ? answer.choices : []
  const correctChoiceId = String(answer.choiceId ?? '')

  return (
    <div className="assessment-simple-answer-block">
      <span className="assessment-simple-review-label">Answer choices</span>
      <div className="assessment-simple-choices-list">
        {choices.map((choice, index) => {
          const isCorrect = String(choice.id) === correctChoiceId
          const letter = visibleLabel(index)
          return (
            <div
              key={choice.id || index}
              className={`assessment-simple-choice-item ${isCorrect ? 'is-correct' : ''}`}
            >
              <span className="assessment-simple-choice-letter">{letter}.</span>
              <span className="assessment-simple-choice-text">{choice.text}</span>
              {isCorrect && (
                <span className="assessment-simple-correct-badge" aria-label="Correct answer">
                  <Check size={13} /> Correct answer
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function TrueFalseReview({ answer }: { answer: AssessmentTrueFalseAnswer }) {
  const isTrue = Boolean(answer.value)
  return (
    <div className="assessment-simple-answer-block">
      <span className="assessment-simple-review-label">Correct answer</span>
      <div className="assessment-simple-tf-display">
        <span className={`assessment-simple-tf-badge ${isTrue ? 'true-val' : 'false-val'}`}>
          <Check size={14} /> {isTrue ? 'True' : 'False'}
        </span>
      </div>
    </div>
  )
}

function ShortAnswerReview({ answer }: { answer: AssessmentShortAnswer }) {
  const accepted = Array.isArray(answer.acceptedAnswers) ? answer.acceptedAnswers.filter(Boolean) : []
  const primary = accepted[0] ?? 'No expected answer set'
  const alternatives = accepted.slice(1)

  return (
    <div className="assessment-simple-answer-block">
      <span className="assessment-simple-review-label">Expected answer</span>
      <div className="assessment-simple-expected-box">
        <strong className="assessment-simple-expected-primary">{primary}</strong>
        {alternatives.length > 0 && (
          <div className="assessment-simple-alternatives">
            <span>Accepted alternatives:</span>
            <ul>
              {alternatives.map((alt, idx) => (
                <li key={idx}>{alt}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}

function FillInTheBlankReview({ answer }: { answer: AssessmentFillInTheBlankAnswer }) {
  const blanks = Array.isArray(answer.blanks) ? answer.blanks : []

  return (
    <div className="assessment-simple-answer-block">
      <span className="assessment-simple-review-label">Expected answers per blank</span>
      <div className="assessment-simple-blanks-grid">
        {blanks.map((blank, index) => {
          const letter = visibleLabel(index)
          const accepted = Array.isArray(blank.acceptedAnswers) ? blank.acceptedAnswers.filter(Boolean) : []
          return (
            <div key={blank.id || index} className="assessment-simple-blank-card">
              <strong>Blank {letter}</strong>
              <span>{accepted.join(' / ') || 'None set'}</span>
              {blank.pointsPossible !== undefined && (
                <small>({blank.pointsPossible} {blank.pointsPossible === 1 ? 'point' : 'points'})</small>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function NumericalAnswerReview({ answer }: { answer: AssessmentNumericalAnswer }) {
  const value = answer.value !== undefined ? String(answer.value) : '0'
  const unit = answer.unit ? answer.unit.trim() : ''
  const tolerance = answer.tolerance !== undefined && Number(answer.tolerance) > 0 ? `±${answer.tolerance}` : ''

  return (
    <div className="assessment-simple-answer-block">
      <span className="assessment-simple-review-label">Expected numerical answer</span>
      <div className="assessment-simple-numerical-row">
        <div className="assessment-simple-num-box">
          <small>Value</small>
          <strong>{value}</strong>
        </div>
        {unit && (
          <div className="assessment-simple-num-box">
            <small>Unit</small>
            <strong>{unit}</strong>
          </div>
        )}
        {tolerance && (
          <div className="assessment-simple-num-box">
            <small>Tolerance</small>
            <strong>{tolerance}</strong>
          </div>
        )}
        {answer.requireUnit && (
          <span className="assessment-simple-unit-badge">Unit required</span>
        )}
      </div>
    </div>
  )
}

function MultipleSelectReview({ answer }: { answer: AssessmentMultipleSelectAnswer }) {
  const choices = Array.isArray(answer.choices) ? answer.choices : []
  const selectedIds = new Set(Array.isArray(answer.choiceIds) ? answer.choiceIds.map(String) : [])

  return (
    <div className="assessment-simple-answer-block">
      <span className="assessment-simple-review-label">Choices & correct answers (Multiple Select)</span>
      <div className="assessment-simple-choices-list">
        {choices.map((choice, index) => {
          const isCorrect = selectedIds.has(String(choice.id))
          const letter = visibleLabel(index)
          return (
            <div
              key={choice.id || index}
              className={`assessment-simple-choice-item ${isCorrect ? 'is-correct' : ''}`}
            >
              <span className="assessment-simple-choice-letter">{letter}.</span>
              <span className="assessment-simple-choice-text">{choice.text}</span>
              {isCorrect && (
                <span className="assessment-simple-correct-badge" aria-label="Correct answer">
                  <Check size={13} /> Correct answer
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function MatchingReview({ answer }: { answer: AssessmentMatchingAnswer }) {
  const prompts = Array.isArray(answer.prompts) ? answer.prompts : []
  const choices = Array.isArray(answer.choices) ? answer.choices : []
  const mappings = Array.isArray(answer.mappings) ? answer.mappings : []

  return (
    <div className="assessment-simple-answer-block">
      <span className="assessment-simple-review-label">Correct matching pairings</span>
      <div className="assessment-simple-matching-list">
        {mappings.map((mapping, idx) => {
          const promptIdx = prompts.findIndex((p) => String(p.id) === String(mapping.promptId))
          const choiceIdx = choices.findIndex((c) => String(c.id) === String(mapping.choiceId))
          const promptText = promptIdx >= 0 ? prompts[promptIdx].text : mapping.promptId
          const promptLabel = promptIdx >= 0 ? `${promptIdx + 1}. ` : ''
          const choiceText = choiceIdx >= 0 ? choices[choiceIdx].text : mapping.choiceId
          const choiceLabel = choiceIdx >= 0 ? `${visibleLabel(choiceIdx)}. ` : ''

          return (
            <div key={idx} className="assessment-simple-match-row">
              <span className="assessment-simple-match-prompt">
                <strong>{promptLabel}</strong>{promptText}
              </span>
              <span className="assessment-simple-match-arrow">➔</span>
              <span className="assessment-simple-match-choice">
                <strong>{choiceLabel}</strong>{choiceText}
              </span>
              {mapping.pointsPossible !== undefined && (
                <small className="assessment-simple-match-pts">({mapping.pointsPossible} pt)</small>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ProblemSolvingReview({ answer }: { answer: AssessmentProblemSolvingAnswer }) {
  const subparts = Array.isArray(answer.subparts) ? answer.subparts : []

  return (
    <div className="assessment-simple-answer-block">
      <span className="assessment-simple-review-label">Solution & scoring guide</span>
      {answer.finalAnswer !== undefined && String(answer.finalAnswer).trim() && (
        <div className="assessment-simple-problem-field">
          <small>Expected final answer:</small>
          <strong>{String(answer.finalAnswer)}</strong>
        </div>
      )}
      {answer.solutionOutline && (
        <div className="assessment-simple-problem-field">
          <small>Solution outline / method:</small>
          <p className="assessment-simple-preserve-text">{answer.solutionOutline}</p>
        </div>
      )}
      {subparts.length > 0 && (
        <div className="assessment-simple-subparts-list">
          <small>Subparts ({subparts.length}):</small>
          <ol type="a">
            {subparts.map((part, idx) => (
              <li key={part.id || idx}>
                <span>{part.prompt}</span>
                {part.expectedAnswer !== undefined && <strong> &rarr; {String(part.expectedAnswer)}</strong>}
                <small> ({part.pointsPossible} {part.pointsPossible === 1 ? 'pt' : 'pts'})</small>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  )
}

function ConstructedResponseReview({ answer }: { answer: AssessmentConstructedResponseAnswer }) {
  const rubric = Array.isArray(answer.rubric) ? answer.rubric : []
  const elements = Array.isArray(answer.expectedElements) ? answer.expectedElements : []

  return (
    <div className="assessment-simple-answer-block">
      <span className="assessment-simple-review-label">Response & rubric guidance</span>
      {answer.expectedResponse && (
        <div className="assessment-simple-problem-field">
          <small>Expected response / criteria:</small>
          <p className="assessment-simple-preserve-text">{answer.expectedResponse}</p>
        </div>
      )}
      {answer.sampleResponse && (
        <div className="assessment-simple-problem-field">
          <small>Sample response:</small>
          <p className="assessment-simple-preserve-text">{answer.sampleResponse}</p>
        </div>
      )}
      {answer.rubricGuidance && (
        <div className="assessment-simple-problem-field">
          <small>Rubric guidance:</small>
          <p className="assessment-simple-preserve-text">{answer.rubricGuidance}</p>
        </div>
      )}
      {elements.length > 0 && (
        <div className="assessment-simple-elements-list">
          <small>Expected elements:</small>
          <ul>
            {elements.map((el, idx) => (
              <li key={idx}>{el}</li>
            ))}
          </ul>
        </div>
      )}
      {rubric.length > 0 && (
        <div className="assessment-simple-rubric-list">
          <small>Scoring criteria:</small>
          <ul>
            {rubric.map((crit, idx) => (
              <li key={crit.id || idx}>
                <strong>{crit.label}:</strong> {crit.pointsPossible} {crit.pointsPossible === 1 ? 'pt' : 'pts'}
                {crit.description && <span> — {crit.description}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function EssayReview({ answer }: { answer: AssessmentEssayAnswer }) {
  const keyPoints = Array.isArray(answer.keyPoints) ? answer.keyPoints.filter(Boolean) : []
  const rubric = Array.isArray(answer.rubric) ? answer.rubric : []

  return (
    <div className="assessment-simple-answer-block">
      <span className="assessment-simple-review-label">Essay evaluation criteria</span>
      {keyPoints.length > 0 && (
        <div className="assessment-simple-elements-list">
          <small>Key points / expected arguments:</small>
          <ul>
            {keyPoints.map((point, idx) => (
              <li key={idx}>{point}</li>
            ))}
          </ul>
        </div>
      )}
      {answer.scoringNotes && (
        <div className="assessment-simple-problem-field">
          <small>Scoring notes:</small>
          <p className="assessment-simple-preserve-text">{answer.scoringNotes}</p>
        </div>
      )}
      {answer.expectedResponse && (
        <div className="assessment-simple-problem-field">
          <small>Model answer guidance:</small>
          <p className="assessment-simple-preserve-text">{answer.expectedResponse}</p>
        </div>
      )}
      {rubric.length > 0 && (
        <div className="assessment-simple-rubric-list">
          <small>Rubric criteria:</small>
          <ul>
            {rubric.map((crit, idx) => (
              <li key={crit.id || idx}>
                <strong>{crit.label}:</strong> {crit.pointsPossible} {crit.pointsPossible === 1 ? 'pt' : 'pts'}
                {crit.description && <span> — {crit.description}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
