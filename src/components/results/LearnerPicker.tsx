import type { ResultLearnerSnapshot } from '../../types/results'

export function LearnerPicker({
  learners,
  activeParticipantId,
  onSelect,
  encodedParticipantIds,
}: {
  learners: readonly ResultLearnerSnapshot[]
  activeParticipantId: string
  onSelect: (participantId: string) => void
  encodedParticipantIds?: ReadonlySet<string>
}) {
  return <div className="results-learner-picker" aria-label="Learner list">
    {learners.map((learner, index) => {
      const selected = learner.participantId === activeParticipantId
      const encoded = encodedParticipantIds?.has(learner.participantId)
      return <button
        className={`results-learner-button ${selected ? 'selected' : ''}`}
        key={learner.participantId}
        type="button"
        aria-current={selected ? 'true' : undefined}
        onClick={() => onSelect(learner.participantId)}
      >
        <span className="results-learner-number">{index + 1}</span>
        <span className="results-learner-name"><strong>{learner.displayName}</strong><small>{learner.localReference || 'No local reference'}</small></span>
        <span className={`results-learner-state ${encoded ? 'done' : ''}`} aria-label={encoded ? 'Encoded' : 'Not encoded'}>{encoded ? '✓' : '·'}</span>
      </button>
    })}
  </div>
}

