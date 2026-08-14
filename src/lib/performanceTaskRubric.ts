import type {
  PerformanceTaskContent,
  PerformanceTaskGrouping,
  PerformanceTaskMilestone,
  PerformanceTaskRubric,
  PerformanceTaskRubricCriterion,
  PerformanceTaskRubricLevel,
} from '../types/assessment'

function clone<T>(value: T): T {
  if (typeof structuredClone === 'function') return structuredClone(value)
  return JSON.parse(JSON.stringify(value)) as T
}

let rubricIdCounter = 0
function stableId(prefix: string) {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  rubricIdCounter += 1
  return `${prefix}-${Date.now().toString(36)}-${rubricIdCounter.toString(36)}`
}

export function calculateRubricTotalPoints(rubric: PerformanceTaskRubric | undefined | null): number {
  if (!rubric || !Array.isArray(rubric.criteria)) return 0
  return rubric.criteria.reduce((total, criterion) => {
    const pts = Number(criterion.pointsPossible)
    return total + (Number.isFinite(pts) && pts > 0 ? pts : 0)
  }, 0)
}

export type RubricValidationIssue = {
  criterionId?: string
  field: string
  message: string
}

export type RubricValidationResult = {
  valid: boolean
  errors: RubricValidationIssue[]
  warnings: RubricValidationIssue[]
}

export function validatePerformanceTaskRubric(rubric: PerformanceTaskRubric | undefined | null): RubricValidationResult {
  const errors: RubricValidationIssue[] = []
  const warnings: RubricValidationIssue[] = []

  if (!rubric) {
    errors.push({ field: 'rubric', message: 'Rubric is required for Performance Tasks.' })
    return { valid: false, errors, warnings }
  }

  if (!Array.isArray(rubric.criteria) || rubric.criteria.length === 0) {
    errors.push({ field: 'criteria', message: 'At least one rubric criterion is required.' })
    return { valid: false, errors, warnings }
  }

  const seenCriterionIds = new Set<string>()

  rubric.criteria.forEach((criterion, idx) => {
    const critId = criterion.id || `criterion-${idx + 1}`
    if (seenCriterionIds.has(critId)) {
      errors.push({ criterionId: critId, field: 'id', message: `Duplicate criterion ID "${critId}".` })
    }
    seenCriterionIds.add(critId)

    if (!criterion.name || !criterion.name.trim()) {
      errors.push({ criterionId: critId, field: 'name', message: `Criterion ${idx + 1} requires a name.` })
    }

    const pointsPossible = Number(criterion.pointsPossible)
    if (!Number.isFinite(pointsPossible) || pointsPossible <= 0) {
      errors.push({ criterionId: critId, field: 'pointsPossible', message: `Criterion "${criterion.name || idx + 1}" must have positive pointsPossible.` })
    }

    if (!Array.isArray(criterion.levels) || criterion.levels.length < 2) {
      errors.push({ criterionId: critId, field: 'levels', message: `Criterion "${criterion.name || idx + 1}" requires at least 2 performance levels.` })
    } else {
      const maxLevelPts = Math.max(...criterion.levels.map((l) => Number(l.points) || 0))
      if (Math.abs(maxLevelPts - pointsPossible) > 0.001) {
        warnings.push({ criterionId: critId, field: 'pointsPossible', message: `Criterion "${criterion.name}" highest level points (${maxLevelPts}) does not match pointsPossible (${pointsPossible}).` })
      }

      criterion.levels.forEach((lvl, lvlIdx) => {
        if (!lvl.label || !lvl.label.trim()) {
          errors.push({ criterionId: critId, field: `levels[${lvlIdx}].label`, message: `Level ${lvlIdx + 1} requires a label.` })
        }
        if (!lvl.descriptor || !lvl.descriptor.trim()) {
          warnings.push({ criterionId: critId, field: `levels[${lvlIdx}].descriptor`, message: `Level "${lvl.label || lvlIdx + 1}" descriptor is empty.` })
        }
      })
    }
  })

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  }
}

export function createDefaultPerformanceTaskRubric(title = 'Analytic Scoring Rubric'): PerformanceTaskRubric {
  const criteria: PerformanceTaskRubricCriterion[] = [
    {
      id: stableId('crit-content'),
      name: 'Content & Curriculum Accuracy',
      description: 'Demonstrates deep understanding of core competencies, factual precision, and foundational principles.',
      pointsPossible: 4,
      levels: [
        { id: stableId('lvl-4'), label: 'Exemplary', descriptor: 'Comprehensive mastery with thorough accuracy, insightful connections, and no misconceptions.', points: 4 },
        { id: stableId('lvl-3'), label: 'Proficient', descriptor: 'Accurate understanding meeting all major curriculum standards with minor trivial errors.', points: 3 },
        { id: stableId('lvl-2'), label: 'Developing', descriptor: 'Basic understanding present but displays notable gaps or misconceptions in core concepts.', points: 2 },
        { id: stableId('lvl-1'), label: 'Beginning', descriptor: 'Limited or inaccurate understanding requiring substantial teacher guidance.', points: 1 },
      ],
    },
    {
      id: stableId('crit-app'),
      name: 'Application & Problem-Solving',
      description: 'Applies learning to authentic scenarios, producing original solutions and practical outputs.',
      pointsPossible: 4,
      levels: [
        { id: stableId('lvl-4'), label: 'Exemplary', descriptor: 'Highly effective application showing creative problem-solving and authentic execution.', points: 4 },
        { id: stableId('lvl-3'), label: 'Proficient', descriptor: 'Applies concepts appropriately to produce the expected output with clear structure.', points: 3 },
        { id: stableId('lvl-2'), label: 'Developing', descriptor: 'Attempts application but lacks consistency, clarity, or direct relevance.', points: 2 },
        { id: stableId('lvl-1'), label: 'Beginning', descriptor: 'Minimal application to the task scenario.', points: 1 },
      ],
    },
    {
      id: stableId('crit-comm'),
      name: 'Organization & Communication',
      description: 'Presents evidence, findings, and explanations with clarity, coherence, and professional quality.',
      pointsPossible: 4,
      levels: [
        { id: stableId('lvl-4'), label: 'Exemplary', descriptor: 'Exceptionally well-organized, articulate, and engaging presentation of findings.', points: 4 },
        { id: stableId('lvl-3'), label: 'Proficient', descriptor: 'Clear, logical structure with readable explanations and appropriate terminology.', points: 3 },
        { id: stableId('lvl-2'), label: 'Developing', descriptor: 'Somewhat disorganized with occasional lapses in clarity or flow.', points: 2 },
        { id: stableId('lvl-1'), label: 'Beginning', descriptor: 'Unclear structure that obscures the intended meaning.', points: 1 },
      ],
    },
    {
      id: stableId('crit-demo'),
      name: 'Product Quality & Execution',
      description: 'Fulfills all specified constraints, deadlines, and requirements with high craft.',
      pointsPossible: 4,
      levels: [
        { id: stableId('lvl-4'), label: 'Exemplary', descriptor: 'Product exceeds quality standards, demonstrating outstanding attention to detail.', points: 4 },
        { id: stableId('lvl-3'), label: 'Proficient', descriptor: 'Meets all product specifications and constraints satisfactorily.', points: 3 },
        { id: stableId('lvl-2'), label: 'Developing', descriptor: 'Partially meets specifications with some missing constraints.', points: 2 },
        { id: stableId('lvl-1'), label: 'Beginning', descriptor: 'Incomplete product failing to meet core requirements.', points: 1 },
      ],
    },
  ]

  return {
    id: stableId('rubric'),
    title,
    criteria,
    totalPoints: 16,
  }
}

export function createPerformanceTaskContent(
  overrides: Partial<PerformanceTaskContent> = {}
): PerformanceTaskContent {
  const defaultRubric = createDefaultPerformanceTaskRubric()
  const rubric = overrides.rubric ? clone(overrides.rubric) : defaultRubric
  rubric.totalPoints = calculateRubricTotalPoints(rubric)

  const defaultMilestones: PerformanceTaskMilestone[] = [
    { id: stableId('mile-1'), title: 'Planning & Exploration', description: 'Brainstorm approach and gather materials.', targetDuration: '1-2 days' },
    { id: stableId('mile-2'), title: 'Development & Draft', description: 'Construct the product or prepare demonstration.', targetDuration: '2-3 days' },
    { id: stableId('mile-3'), title: 'Review & Final Output', description: 'Self-evaluate using rubric and submit finalized output.', targetDuration: '1-2 days' },
  ]

  return {
    title: overrides.title || 'Authentic Performance Task',
    scenario: overrides.scenario || 'You are tasked with applying your classroom knowledge to solve an authentic real-world problem and demonstrate your learning.',
    learningObjectives: overrides.learningObjectives ? [...overrides.learningObjectives] : [],
    competencyAlignment: overrides.competencyAlignment ? clone(overrides.competencyAlignment) : [],
    contentStandards: overrides.contentStandards ? [...overrides.contentStandards] : undefined,
    performanceStandards: overrides.performanceStandards ? [...overrides.performanceStandards] : undefined,
    teacherInstructions: overrides.teacherInstructions || 'Guide learners through each milestone, provide formative feedback during checkpoints, and evaluate outputs using the analytic rubric.',
    studentInstructions: overrides.studentInstructions || 'Read the scenario carefully, review the rubric criteria, complete the milestones, and submit your final product on time.',
    expectedOutput: overrides.expectedOutput || 'A tangible product, written report, demonstration, or presentation.',
    grouping: overrides.grouping || 'individual',
    resources: overrides.resources ? [...overrides.resources] : [],
    constraints: overrides.constraints ? [...overrides.constraints] : ['Adhere to classroom safety guidelines', 'Submit on or before the due date'],
    duration: overrides.duration || '1 week',
    dueDate: overrides.dueDate,
    milestones: overrides.milestones ? clone(overrides.milestones) : defaultMilestones,
    rubric,
    teacherNotes: overrides.teacherNotes,
    differentiation: overrides.differentiation,
    reflection: overrides.reflection ? clone(overrides.reflection) : { enabled: true, prompt: 'What was the most challenging part of this task and how did you overcome it?' },
  }
}
