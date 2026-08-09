import type { LearnerItemAnswer, ResultAssessmentItemSnapshot } from '../../types/results'

function textValue(value: string) {
  return value.trim() ? value : ''
}

/**
 * Compact answer controls shared by answer-sheet and item entry modes.  The
 * controls only capture typed learner responses; scoring remains in the pure
 * resultsScoring module and teacher points remain authoritative for subjective
 * responses.
 */
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
  if (item.questionType === 'true_false' && item.answer.type === 'true_false') {
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
  if ((item.questionType === 'short_answer' || item.questionType === 'identification') && (item.answer.type === item.questionType)) {
    const selected = value?.type === item.questionType ? value.text : ''
    return <input
      className="results-answer-text"
      type="text"
      value={selected}
      disabled={disabled}
      placeholder={item.questionType === 'identification' ? 'Type the identified term' : 'Type the learner response'}
      aria-label={`${item.questionType.replaceAll('_', ' ')} for item ${item.itemNumber}`}
      onChange={(event) => onChange(event.target.value ? { type: item.questionType, text: event.target.value } as LearnerItemAnswer : null)}
    />
  }
  if (item.questionType === 'fill_in_the_blank' && item.answer.type === 'fill_in_the_blank') {
    const current = value?.type === 'fill_in_the_blank' ? value.blanks : {}
    return <div className="results-fill-answers" aria-label={`Fill-in-the-blank answers for item ${item.itemNumber}`}>
      {item.answer.blanks.map((blank, index) => <label key={blank.id}>Blank {index + 1}
        <input className="results-answer-text" type="text" value={current[blank.id] ?? ''} disabled={disabled} onChange={(event) => {
          const blanks = { ...current, [blank.id]: event.target.value }
          onChange(Object.values(blanks).some((entry) => entry.trim()) ? { type: 'fill_in_the_blank', blanks } : null)
        }} />
      </label>)}
    </div>
  }
  if (item.questionType === 'numerical_answer' && item.answer.type === 'numerical_answer') {
    const numerical = value?.type === 'numerical_answer' ? value : null
    return <div className="results-numerical-answer"><input className="results-answer-text" type="number" inputMode="decimal" value={numerical?.value ?? ''} disabled={disabled} placeholder="Number" aria-label={`Numerical answer for item ${item.itemNumber}`} onChange={(event) => {
      const parsed = event.target.value.trim() === '' ? null : Number(event.target.value)
      onChange(parsed !== null && Number.isFinite(parsed) ? { type: 'numerical_answer', value: parsed, unit: numerical?.unit } : null)
    }} />{(item.answer.unit || item.answer.requireUnit) && <input className="results-answer-text" type="text" value={numerical?.unit ?? ''} disabled={disabled} placeholder="Unit" aria-label={`Unit for item ${item.itemNumber}`} onChange={(event) => {
      if (numerical) onChange({ ...numerical, unit: event.target.value })
    }} />}</div>
  }
  if (item.questionType === 'matching' && item.answer.type === 'matching') {
    const matchingAnswer = item.answer
    const matches = value?.type === 'matching' ? value.matches : {}
    return <div className="results-matching-answers" aria-label={`Matching answers for item ${item.itemNumber}`}>
      {matchingAnswer.prompts.map((prompt) => <label key={prompt.id}><span>{prompt.text}</span><select value={matches[prompt.id] ?? ''} disabled={disabled} onChange={(event) => {
        const next = { ...matches }
        if (event.target.value) next[prompt.id] = event.target.value
        else delete next[prompt.id]
        onChange(Object.keys(next).length ? { type: 'matching', matches: next } : null)
      }}><option value="">Choose a match…</option>{matchingAnswer.choices.map((choice) => <option value={choice.id} key={choice.id}>{choice.label ?? choice.text}</option>)}</select></label>)}
    </div>
  }
  if (item.questionType === 'multiple_select' && item.answer.type === 'multiple_select') {
    const selected = new Set(value?.type === 'multiple_select' ? value.choiceIds : [])
    return <div className="results-multiple-select-answers" aria-label={`Select all answers for item ${item.itemNumber}`}>
      {item.answer.choices.map((choice, index) => <label key={choice.id}><input type="checkbox" disabled={disabled} checked={selected.has(choice.id)} onChange={(event) => {
        const next = new Set(selected)
        if (event.target.checked) next.add(choice.id)
        else next.delete(choice.id)
        onChange(next.size ? { type: 'multiple_select', choiceIds: [...next] } : null)
      }} /><span>{String.fromCharCode(65 + index)}. {choice.text}</span></label>)}
    </div>
  }
  if (item.questionType === 'problem_solving' && item.answer.type === 'problem_solving') {
    const response = value?.type === 'problem_solving' ? value : { type: 'problem_solving' as const }
    return <div className="results-subjective-answer"><label>Final answer<input className="results-answer-text" type="text" value={response.finalAnswer ?? ''} disabled={disabled} onChange={(event) => onChange(event.target.value || response.solution ? { type: 'problem_solving', finalAnswer: textValue(event.target.value), solution: response.solution } : null)} /></label><label>Solution / working<textarea className="results-answer-textarea" value={response.solution ?? ''} disabled={disabled} placeholder="Optional transcription of learner working" onChange={(event) => onChange(event.target.value || response.finalAnswer ? { type: 'problem_solving', finalAnswer: response.finalAnswer, solution: event.target.value } : null)} /></label></div>
  }
  if (item.questionType === 'essay' && item.answer.type === 'essay') {
    return <textarea className="results-answer-textarea" value={value?.type === 'essay' ? value.text ?? '' : ''} disabled={disabled} placeholder="Optional response transcription; award points below" aria-label={`Essay response for item ${item.itemNumber}`} onChange={(event) => onChange(event.target.value ? { type: 'essay', text: event.target.value } : null)} />
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
