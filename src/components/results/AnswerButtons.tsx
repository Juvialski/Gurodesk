import type { ResultAssessmentItemSnapshot, LearnerItemAnswer } from '../../types/results'

export function AnswerButtons({
  item,
  value,
  onChange,
  disabled = false,
}: {
  item: ResultAssessmentItemSnapshot
  value: LearnerItemAnswer | null
  onChange: (answer: LearnerItemAnswer | null) => void
  disabled?: boolean
}) {
  if (item.questionType === 'multiple_choice' && item.answer.type === 'multiple_choice') {
    const selected = value?.type === 'multiple_choice' ? value.choiceId : ''
    return <div className="answer-choice-grid" aria-label={`Answers for item ${item.itemNumber}`}>
      {item.answer.choices.map((choice, index) => <button
        className={`answer-choice-button ${selected === choice.id ? 'selected' : ''}`}
        key={choice.id}
        type="button"
        disabled={disabled}
        aria-pressed={selected === choice.id}
        onClick={() => onChange({ type: 'multiple_choice', choiceId: choice.id })}
      ><b>{String.fromCharCode(65 + index)}</b><span>{choice.text}</span></button>)}
    </div>
  }
  if (item.questionType === 'true_false') {
    const selected = value?.type === 'true_false' ? value.value : null
    return <div className="answer-binary-grid" aria-label={`True or false for item ${item.itemNumber}`}>
      {[true, false].map((option) => <button
        className={`answer-binary-button ${selected === option ? 'selected' : ''}`}
        key={String(option)}
        type="button"
        disabled={disabled}
        aria-pressed={selected === option}
        onClick={() => onChange({ type: 'true_false', value: option })}
      >{option ? 'True' : 'False'}</button>)}
      {selected !== null && <button className="answer-clear-button" type="button" disabled={disabled} onClick={() => onChange(null)}>Clear</button>}
    </div>
  }
  if (item.questionType === 'short_answer') {
    return <input
      className="results-answer-text"
      type="text"
      value={value?.type === 'short_answer' ? value.text : ''}
      disabled={disabled}
      placeholder="Type the learner response"
      aria-label={`Short answer for item ${item.itemNumber}`}
      onChange={(event) => onChange(event.target.value ? { type: 'short_answer', text: event.target.value } : null)}
    />
  }
  return <textarea
    className="results-answer-textarea"
    value={value?.type === 'constructed_response' ? value.text ?? '' : ''}
    disabled={disabled}
    placeholder="Optional response text; award points below"
    aria-label={`Constructed response for item ${item.itemNumber}`}
    onChange={(event) => onChange(event.target.value ? { type: 'constructed_response', text: event.target.value } : null)}
  />
}

