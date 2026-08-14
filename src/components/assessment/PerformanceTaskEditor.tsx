import { useState } from 'react'
import {
  CheckCircle2,
  Clock,
  Layers,
  ListChecks,
  Plus,
  Sparkles,
  Trash2,
  Users,
  FileText,
  AlertCircle,
} from 'lucide-react'
import type {
  AssessmentRecord,
  PerformanceTaskContent,
  PerformanceTaskGrouping,
  PerformanceTaskRubricCriterion,
} from '../../types/assessment'
import { calculateRubricTotalPoints, createDefaultPerformanceTaskRubric, validatePerformanceTaskRubric } from '../../lib/performanceTaskRubric'

function clone<T>(value: T): T {
  if (typeof structuredClone === 'function') return structuredClone(value)
  return JSON.parse(JSON.stringify(value)) as T
}

function stableId(prefix: string) {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
}

export function PerformanceTaskEditor({
  assessment,
  onChange,
  onAiGenerate,
  disabled = false,
}: {
  assessment: AssessmentRecord
  onChange: (updated: AssessmentRecord) => void
  onAiGenerate?: () => Promise<void>
  disabled?: boolean
}) {
  const [activeTab, setActiveTab] = useState<'scenario' | 'rubric' | 'milestones' | 'instructions'>('scenario')
  const [isGenerating, setIsGenerating] = useState(false)

  const pt: PerformanceTaskContent = assessment.performanceTask || {
    title: assessment.title || 'Authentic Performance Task',
    scenario: '',
    learningObjectives: [],
    competencyAlignment: [],
    teacherInstructions: '',
    studentInstructions: '',
    expectedOutput: '',
    grouping: 'individual',
    resources: [],
    constraints: [],
    duration: '1 week',
    milestones: [],
    rubric: createDefaultPerformanceTaskRubric(),
  }

  const rubric = pt.rubric || createDefaultPerformanceTaskRubric()
  const totalRubricPoints = calculateRubricTotalPoints(rubric)
  const rubricValidation = validatePerformanceTaskRubric(rubric)

  function updatePt(patch: Partial<PerformanceTaskContent>) {
    const nextPt: PerformanceTaskContent = {
      ...pt,
      ...patch,
    }
    if (patch.rubric) {
      nextPt.rubric.totalPoints = calculateRubricTotalPoints(nextPt.rubric)
    }
    const updated: AssessmentRecord = {
      ...assessment,
      title: nextPt.title || assessment.title,
      instructions: nextPt.studentInstructions || assessment.instructions,
      performanceTask: nextPt,
      totalPoints: nextPt.rubric?.totalPoints || totalRubricPoints,
    }
    onChange(updated)
  }

  function handleAddCriterion() {
    const newCrit: PerformanceTaskRubricCriterion = {
      id: stableId('crit'),
      name: `Criterion ${rubric.criteria.length + 1}`,
      description: 'Describe the expected performance.',
      pointsPossible: 4,
      levels: [
        { id: stableId('lvl-4'), label: 'Exemplary', descriptor: 'Comprehensive mastery...', points: 4 },
        { id: stableId('lvl-3'), label: 'Proficient', descriptor: 'Accurate understanding...', points: 3 },
        { id: stableId('lvl-2'), label: 'Developing', descriptor: 'Basic understanding with gaps...', points: 2 },
        { id: stableId('lvl-1'), label: 'Beginning', descriptor: 'Limited understanding...', points: 1 },
      ],
    }
    const nextCriteria = [...rubric.criteria, newCrit]
    updatePt({
      rubric: {
        ...rubric,
        criteria: nextCriteria,
        totalPoints: calculateRubricTotalPoints({ ...rubric, criteria: nextCriteria }),
      },
    })
  }

  function handleRemoveCriterion(index: number) {
    if (rubric.criteria.length <= 1) return
    const nextCriteria = rubric.criteria.filter((_, i) => i !== index)
    updatePt({
      rubric: {
        ...rubric,
        criteria: nextCriteria,
        totalPoints: calculateRubricTotalPoints({ ...rubric, criteria: nextCriteria }),
      },
    })
  }

  function handleUpdateCriterion(index: number, patch: Partial<PerformanceTaskRubricCriterion>) {
    const nextCriteria = clone(rubric.criteria)
    nextCriteria[index] = { ...nextCriteria[index], ...patch }
    updatePt({
      rubric: {
        ...rubric,
        criteria: nextCriteria,
        totalPoints: calculateRubricTotalPoints({ ...rubric, criteria: nextCriteria }),
      },
    })
  }

  function handleUpdateLevel(critIndex: number, lvlIndex: number, patch: { descriptor?: string; label?: string; points?: number }) {
    const nextCriteria = clone(rubric.criteria)
    const crit = nextCriteria[critIndex]
    if (!crit.levels[lvlIndex]) return
    crit.levels[lvlIndex] = { ...crit.levels[lvlIndex], ...patch }
    updatePt({
      rubric: {
        ...rubric,
        criteria: nextCriteria,
      },
    })
  }

  async function triggerAi() {
    if (!onAiGenerate || isGenerating || disabled) return
    setIsGenerating(true)
    try {
      await onAiGenerate()
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="performance-task-editor panel">
      <div className="performance-task-header">
        <div className="performance-task-title-row">
          <div>
            <span className="badge primary">Performance Task Mode</span>
            <h2>{pt.title || 'Authentic Performance Task'}</h2>
            <p className="performance-task-subtitle">
              {pt.expectedOutput ? `Target Product: ${pt.expectedOutput}` : 'GRASPS-based Authentic Task & Analytic Scoring Rubric'}
            </p>
          </div>
          <div className="performance-task-header-actions">
            {onAiGenerate && (
              <button
                type="button"
                className="button secondary"
                onClick={() => void triggerAi()}
                disabled={disabled || isGenerating}
              >
                <Sparkles size={16} />
                {isGenerating ? 'Generating Task…' : 'AI Generate Task & Rubric'}
              </button>
            )}
            <div className="rubric-total-badge">
              <strong>{totalRubricPoints}</strong>
              <span>Total Points</span>
            </div>
          </div>
        </div>

        <nav className="performance-task-tabs" aria-label="Task editor sections">
          <button
            type="button"
            className={`tab-button ${activeTab === 'scenario' ? 'active' : ''}`}
            onClick={() => setActiveTab('scenario')}
          >
            <FileText size={15} /> Scenario & Context
          </button>
          <button
            type="button"
            className={`tab-button ${activeTab === 'rubric' ? 'active' : ''}`}
            onClick={() => setActiveTab('rubric')}
          >
            <Layers size={15} /> Analytic Rubric ({rubric.criteria.length})
          </button>
          <button
            type="button"
            className={`tab-button ${activeTab === 'milestones' ? 'active' : ''}`}
            onClick={() => setActiveTab('milestones')}
          >
            <ListChecks size={15} /> Milestones ({pt.milestones?.length || 0})
          </button>
          <button
            type="button"
            className={`tab-button ${activeTab === 'instructions' ? 'active' : ''}`}
            onClick={() => setActiveTab('instructions')}
          >
            <Users size={15} /> Instructions & Guidelines
          </button>
        </nav>
      </div>

      <div className="performance-task-tab-content">
        {/* Tab 1: Scenario & Context */}
        {activeTab === 'scenario' && (
          <div className="tab-pane scenario-pane">
            <div className="form-group">
              <label htmlFor="pt-title">Task Title</label>
              <input
                id="pt-title"
                type="text"
                className="input"
                value={pt.title || ''}
                onChange={(e) => updatePt({ title: e.target.value })}
                disabled={disabled}
                placeholder="e.g., Designing a Community Vegetable Garden Layout"
              />
            </div>

            <div className="form-group">
              <label htmlFor="pt-expected-output">Expected Output / Product</label>
              <input
                id="pt-expected-output"
                type="text"
                className="input"
                value={pt.expectedOutput || ''}
                onChange={(e) => updatePt({ expectedOutput: e.target.value })}
                disabled={disabled}
                placeholder="e.g., Scaled 2D Blueprints and Itemized Budget Proposal"
              />
            </div>

            <div className="form-group">
              <label htmlFor="pt-scenario">Real-World Scenario / Problem (GRASPS)</label>
              <p className="field-hint">Describe the Goal, Role, Audience, Situation, and Product.</p>
              <textarea
                id="pt-scenario"
                className="textarea"
                rows={5}
                value={pt.scenario || ''}
                onChange={(e) => updatePt({ scenario: e.target.value })}
                disabled={disabled}
                placeholder="As landscape planning assistants for the Barangay Development Council..."
              />
            </div>

            <div className="form-row-2">
              <div className="form-group">
                <label htmlFor="pt-grouping">Grouping Format</label>
                <select
                  id="pt-grouping"
                  className="select"
                  value={pt.grouping || 'individual'}
                  onChange={(e) => updatePt({ grouping: e.target.value as PerformanceTaskGrouping })}
                  disabled={disabled}
                >
                  <option value="individual">Individual Work</option>
                  <option value="group">Collaborative Group Task</option>
                  <option value="either">Individual or Group Choice</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="pt-duration">Estimated Duration / Pacing</label>
                <input
                  id="pt-duration"
                  type="text"
                  className="input"
                  value={pt.duration || ''}
                  onChange={(e) => updatePt({ duration: e.target.value })}
                  disabled={disabled}
                  placeholder="e.g., 1-2 weeks (3 classroom sessions)"
                />
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Analytic Rubric */}
        {activeTab === 'rubric' && (
          <div className="tab-pane rubric-pane">
            <div className="rubric-pane-header">
              <div>
                <h3>Analytic Scoring Criteria</h3>
                <p className="field-hint">Define criteria and 4-level scoring descriptors for authentic evaluation.</p>
              </div>
              <button
                type="button"
                className="button secondary small"
                onClick={handleAddCriterion}
                disabled={disabled}
              >
                <Plus size={14} /> Add Criterion
              </button>
            </div>

            {!rubricValidation.valid && (
              <div className="rubric-validation-box">
                <AlertCircle size={16} />
                <ul>
                  {rubricValidation.errors.map((e, idx) => (
                    <li key={idx}>{e.message}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="rubric-criteria-list">
              {rubric.criteria.map((criterion, critIndex) => (
                <div className="rubric-criterion-card panel" key={criterion.id || critIndex}>
                  <div className="rubric-criterion-header">
                    <div className="rubric-criterion-title-fields">
                      <input
                        type="text"
                        className="input rubric-crit-name"
                        value={criterion.name}
                        onChange={(e) => handleUpdateCriterion(critIndex, { name: e.target.value })}
                        disabled={disabled}
                        placeholder="Criterion Name (e.g. Accuracy & Application)"
                      />
                      <div className="rubric-crit-points-wrapper">
                        <label>Max Points:</label>
                        <input
                          type="number"
                          className="input rubric-crit-pts"
                          min={1}
                          max={50}
                          value={criterion.pointsPossible}
                          onChange={(e) => handleUpdateCriterion(critIndex, { pointsPossible: Number(e.target.value) || 1 })}
                          disabled={disabled}
                        />
                      </div>
                    </div>
                    <button
                      type="button"
                      className="button icon-only danger"
                      onClick={() => handleRemoveCriterion(critIndex)}
                      disabled={disabled || rubric.criteria.length <= 1}
                      title="Remove Criterion"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>

                  <input
                    type="text"
                    className="input rubric-crit-desc"
                    value={criterion.description || ''}
                    onChange={(e) => handleUpdateCriterion(critIndex, { description: e.target.value })}
                    disabled={disabled}
                    placeholder="Brief description of what this criterion evaluates..."
                  />

                  <div className="rubric-levels-grid">
                    {criterion.levels.map((lvl, lvlIndex) => (
                      <div className="rubric-level-card" key={lvl.id || lvlIndex}>
                        <div className="rubric-level-header">
                          <span className="rubric-level-badge">{lvl.points} pts</span>
                          <input
                            type="text"
                            className="input level-label-input"
                            value={lvl.label}
                            onChange={(e) => handleUpdateLevel(critIndex, lvlIndex, { label: e.target.value })}
                            disabled={disabled}
                            placeholder="Level label (e.g., Exemplary)"
                          />
                        </div>
                        <textarea
                          className="textarea level-desc-textarea"
                          rows={3}
                          value={lvl.descriptor || ''}
                          onChange={(e) => handleUpdateLevel(critIndex, lvlIndex, { descriptor: e.target.value })}
                          disabled={disabled}
                          placeholder="Observable performance descriptor..."
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 3: Milestones */}
        {activeTab === 'milestones' && (
          <div className="tab-pane milestones-pane">
            <div className="milestones-pane-header">
              <div>
                <h3>Task Milestones & Checkpoints</h3>
                <p className="field-hint">Break down the task into formative milestones with target timeframes.</p>
              </div>
              <button
                type="button"
                className="button secondary small"
                onClick={() => {
                  const newM = {
                    id: stableId('mile'),
                    title: `Milestone ${(pt.milestones?.length || 0) + 1}`,
                    description: '',
                    targetDuration: 'Day 1',
                  }
                  updatePt({ milestones: [...(pt.milestones || []), newM] })
                }}
                disabled={disabled}
              >
                <Plus size={14} /> Add Milestone
              </button>
            </div>

            <div className="milestones-list">
              {(pt.milestones || []).map((milestone, idx) => (
                <div className="milestone-card panel" key={milestone.id || idx}>
                  <div className="milestone-header">
                    <span className="milestone-index">{idx + 1}</span>
                    <input
                      type="text"
                      className="input milestone-title"
                      value={milestone.title}
                      onChange={(e) => {
                        const nextM = clone(pt.milestones || [])
                        nextM[idx] = { ...nextM[idx], title: e.target.value }
                        updatePt({ milestones: nextM })
                      }}
                      disabled={disabled}
                      placeholder="Milestone title (e.g. Planning & Research)"
                    />
                    <div className="milestone-duration-field">
                      <Clock size={14} />
                      <input
                        type="text"
                        className="input milestone-duration"
                        value={milestone.targetDuration || ''}
                        onChange={(e) => {
                          const nextM = clone(pt.milestones || [])
                          nextM[idx] = { ...nextM[idx], targetDuration: e.target.value }
                          updatePt({ milestones: nextM })
                        }}
                        disabled={disabled}
                        placeholder="Timeline (e.g. Day 1-2)"
                      />
                    </div>
                    <button
                      type="button"
                      className="button icon-only danger"
                      onClick={() => {
                        updatePt({ milestones: (pt.milestones || []).filter((_, i) => i !== idx) })
                      }}
                      disabled={disabled}
                      title="Remove Milestone"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                  <textarea
                    className="textarea milestone-desc"
                    rows={2}
                    value={milestone.description || ''}
                    onChange={(e) => {
                      const nextM = clone(pt.milestones || [])
                      nextM[idx] = { ...nextM[idx], description: e.target.value }
                      updatePt({ milestones: nextM })
                    }}
                    disabled={disabled}
                    placeholder="Checkpoint expectations or formative submission details..."
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 4: Instructions & Guidelines */}
        {activeTab === 'instructions' && (
          <div className="tab-pane instructions-pane">
            <div className="form-group">
              <label htmlFor="pt-student-instructions">Student-Facing Instructions</label>
              <textarea
                id="pt-student-instructions"
                className="textarea"
                rows={4}
                value={pt.studentInstructions || ''}
                onChange={(e) => updatePt({ studentInstructions: e.target.value })}
                disabled={disabled}
                placeholder="Step-by-step guidance for learners from planning to final product submission..."
              />
            </div>

            <div className="form-group">
              <label htmlFor="pt-teacher-instructions">Teacher-Facing Guide & Facilitation Notes</label>
              <textarea
                id="pt-teacher-instructions"
                className="textarea"
                rows={4}
                value={pt.teacherInstructions || ''}
                onChange={(e) => updatePt({ teacherInstructions: e.target.value })}
                disabled={disabled}
                placeholder="Facilitation notes, formative feedback checkpoints, differentiation strategies, and safety reminders..."
              />
            </div>

            <div className="form-group">
              <label htmlFor="pt-reflection-prompt">Post-Task Reflection Prompt (Self-Assessment)</label>
              <input
                id="pt-reflection-prompt"
                type="text"
                className="input"
                value={pt.reflection?.prompt || ''}
                onChange={(e) => updatePt({ reflection: { enabled: true, prompt: e.target.value } })}
                disabled={disabled}
                placeholder="What was the most challenging part of this task and how did your solution overcome it?"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
