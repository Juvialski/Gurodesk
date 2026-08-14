import { useState } from 'react'
import {
  Award,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  HelpCircle,
  MessageSquare,
  Sparkles,
} from 'lucide-react'
import type { PerformanceTaskRubric } from '../../types/assessment'
import type {
  ResultLearnerSnapshot,
  ResultRubricCriterionScore,
  ResultRubricOutcome,
} from '../../types/results'
import { calculateRubricTotalPoints } from '../../lib/performanceTaskRubric'

export function RubricScoringGrid({
  rubric,
  learners,
  outcomes,
  onChange,
  disabled = false,
}: {
  rubric: PerformanceTaskRubric
  learners: ResultLearnerSnapshot[]
  outcomes: ResultRubricOutcome[]
  onChange: (updated: ResultRubricOutcome[]) => void
  disabled?: boolean
}) {
  const [selectedParticipantId, setSelectedParticipantId] = useState<string>(
    learners[0]?.participantId || ''
  )
  const [feedbackOpen, setFeedbackOpen] = useState<Record<string, boolean>>({})

  const totalPossible = rubric.totalPoints || calculateRubricTotalPoints(rubric)

  const outcomesByParticipant = new Map<string, ResultRubricOutcome>()
  for (const outcome of outcomes) {
    outcomesByParticipant.set(outcome.participantId, outcome)
  }

  const currentLearner = learners.find((l) => l.participantId === selectedParticipantId) || learners[0]
  const currentOutcome: ResultRubricOutcome = outcomesByParticipant.get(selectedParticipantId) || {
    participantId: selectedParticipantId,
    learnerId: currentLearner?.learnerId || '',
    criteriaScores: [],
    totalEarnedPoints: 0,
    possiblePoints: totalPossible,
    teacherFeedback: null,
    updatedAt: new Date().toISOString(),
  }

  const scoresByCriterion = new Map<string, ResultRubricCriterionScore>()
  for (const cs of currentOutcome.criteriaScores) {
    scoresByCriterion.set(cs.criterionId, cs)
  }

  function handleSelectLevel(criterionId: string, levelId: string, points: number) {
    if (disabled) return
    const nextScores = currentOutcome.criteriaScores.filter((c) => c.criterionId !== criterionId)
    const existingFeedback = scoresByCriterion.get(criterionId)?.teacherFeedback || null
    nextScores.push({
      criterionId,
      selectedLevelId: levelId,
      earnedPoints: points,
      teacherFeedback: existingFeedback,
    })
    const totalEarnedPoints = nextScores.reduce((sum, s) => sum + s.earnedPoints, 0)
    const updatedOutcome: ResultRubricOutcome = {
      ...currentOutcome,
      criteriaScores: nextScores,
      totalEarnedPoints,
      possiblePoints: totalPossible,
      updatedAt: new Date().toISOString(),
    }
    const nextOutcomes = outcomes.filter((o) => o.participantId !== selectedParticipantId)
    nextOutcomes.push(updatedOutcome)
    onChange(nextOutcomes)
  }

  function handleUpdateCriterionFeedback(criterionId: string, feedback: string) {
    if (disabled) return
    const existing = scoresByCriterion.get(criterionId)
    if (!existing) return
    const nextScores = currentOutcome.criteriaScores.map((s) =>
      s.criterionId === criterionId ? { ...s, teacherFeedback: feedback.trim() || null } : s
    )
    const updatedOutcome: ResultRubricOutcome = {
      ...currentOutcome,
      criteriaScores: nextScores,
      updatedAt: new Date().toISOString(),
    }
    const nextOutcomes = outcomes.filter((o) => o.participantId !== selectedParticipantId)
    nextOutcomes.push(updatedOutcome)
    onChange(nextOutcomes)
  }

  return (
    <div className="rubric-scoring-grid-container">
      {/* Mobile/Sidebar Learner Selector */}
      <div className="rubric-learner-sidebar panel">
        <h3>Class Roster ({learners.length})</h3>
        <div className="rubric-learner-list">
          {learners.map((learner) => {
            const outcome = outcomesByParticipant.get(learner.participantId)
            const scoredCount = outcome?.criteriaScores.length || 0
            const isComplete = scoredCount === rubric.criteria.length
            const isSelected = learner.participantId === selectedParticipantId
            return (
              <button
                key={learner.participantId}
                type="button"
                className={`rubric-learner-item ${isSelected ? 'selected' : ''} ${isComplete ? 'complete' : ''}`}
                onClick={() => setSelectedParticipantId(learner.participantId)}
              >
                <div className="learner-name-col">
                  <span className="learner-display-name">{learner.displayName}</span>
                  {learner.localReference && (
                    <span className="learner-local-ref">LRN: {learner.localReference}</span>
                  )}
                </div>
                <div className="learner-score-status">
                  {isComplete ? (
                    <span className="score-pill complete">
                      {outcome?.totalEarnedPoints} / {totalPossible}
                    </span>
                  ) : scoredCount > 0 ? (
                    <span className="score-pill partial">
                      {scoredCount}/{rubric.criteria.length}
                    </span>
                  ) : (
                    <span className="score-pill pending">Unscored</span>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Main Rubric Scoring Area for Active Learner */}
      <div className="rubric-scoring-main panel">
        {currentLearner ? (
          <>
            <div className="rubric-active-learner-header">
              <div>
                <h2>{currentLearner.displayName}</h2>
                <p className="learner-subtitle">
                  {currentLearner.localReference ? `LRN: ${currentLearner.localReference}` : 'Active Learner'}
                </p>
              </div>
              <div className="rubric-summary-badge">
                <span className="rubric-score-title">Score</span>
                <strong>{currentOutcome.totalEarnedPoints}</strong>
                <span>/ {totalPossible} pts</span>
              </div>
            </div>

            <div className="rubric-criteria-scoring-list">
              {rubric.criteria.map((criterion, critIdx) => {
                const score = scoresByCriterion.get(criterion.id)
                const isExpandedFeedback = feedbackOpen[criterion.id] === true
                return (
                  <div className="rubric-criterion-scoring-card panel" key={criterion.id || critIdx}>
                    <div className="rubric-criterion-scoring-header">
                      <div>
                        <h4>
                          {critIdx + 1}. {criterion.name}
                        </h4>
                        <p className="criterion-subdesc">{criterion.description}</p>
                      </div>
                      <div className="criterion-current-points">
                        <span>{score ? `${score.earnedPoints} / ${criterion.pointsPossible} pts` : `0 / ${criterion.pointsPossible} pts`}</span>
                      </div>
                    </div>

                    <div className="rubric-levels-selection-grid">
                      {criterion.levels.map((lvl) => {
                        const isSelected = score?.selectedLevelId === lvl.id
                        return (
                          <button
                            key={lvl.id}
                            type="button"
                            className={`rubric-level-select-card ${isSelected ? 'selected' : ''}`}
                            onClick={() => handleSelectLevel(criterion.id, lvl.id, lvl.points)}
                            disabled={disabled}
                          >
                            <div className="level-select-header">
                              <span className="level-label">{lvl.label}</span>
                              <span className="level-pts">{lvl.points} pts</span>
                            </div>
                            <p className="level-descriptor-text">{lvl.descriptor}</p>
                            {isSelected && (
                              <div className="level-selected-check">
                                <Check size={16} /> Selected
                              </div>
                            )}
                          </button>
                        )
                      })}
                    </div>

                    {/* Optional Teacher Criterion Feedback */}
                    <div className="rubric-criterion-feedback-section">
                      <button
                        type="button"
                        className="feedback-toggle-button"
                        onClick={() =>
                          setFeedbackOpen((prev) => ({ ...prev, [criterion.id]: !prev[criterion.id] }))
                        }
                      >
                        <MessageSquare size={14} />
                        {score?.teacherFeedback ? 'Edit Qualitative Feedback' : 'Add Qualitative Feedback'}
                        {isExpandedFeedback ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </button>

                      {isExpandedFeedback && (
                        <div className="feedback-input-wrapper">
                          <textarea
                            className="textarea feedback-textarea"
                            rows={2}
                            value={score?.teacherFeedback || ''}
                            onChange={(e) => handleUpdateCriterionFeedback(criterion.id, e.target.value)}
                            disabled={disabled}
                            placeholder={`Observations & feedback for ${currentLearner.displayName}...`}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        ) : (
          <div className="empty-rubric-selection">
            <HelpCircle size={32} />
            <p>Select a learner from the roster to score their Performance Task.</p>
          </div>
        )}
      </div>
    </div>
  )
}
