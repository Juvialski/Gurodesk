import type { QuestionType } from '../../src/types/assessment'
import type { AssessmentItemCandidate } from '../../src/lib/assessmentGeneration'

/**
 * Provider-free candidates used by contract and export regressions.  Keeping
 * these fixtures in one table makes it difficult for a newly added question
 * type to be accepted by one test while being omitted from another.
 */
export const VALID_ASSESSMENT_CANDIDATES: Readonly<Record<QuestionType, AssessmentItemCandidate>> = {
  multiple_choice: {
    questionType: 'multiple_choice',
    prompt: 'Which value is equal to 2 + 2?',
    answer: {
      type: 'multiple_choice',
      choices: [{ id: 'A', text: '3' }, { id: 'B', text: '4' }, { id: 'C', text: '5' }],
      choiceId: 'B',
    },
    rationale: 'Four is the correct sum.',
    referencedResources: [],
  },
  true_false: {
    questionType: 'true_false',
    prompt: 'A square has four equal sides.',
    answer: { type: 'true_false', value: true },
    rationale: 'This is a defining property of a square.',
    referencedResources: [],
  },
  short_answer: {
    questionType: 'short_answer',
    prompt: 'What is 3 multiplied by 4?',
    answer: { type: 'short_answer', acceptedAnswers: ['12'], caseSensitive: false },
    rationale: 'The product is 12.',
    referencedResources: [],
  },
  constructed_response: {
    questionType: 'constructed_response',
    prompt: 'Explain why the angles in a triangle sum to 180 degrees.',
    answer: {
      type: 'constructed_response',
      expectedResponse: 'A valid explanation using a line parallel to one side.',
      sampleResponse: 'Draw a parallel line through a vertex and use alternate interior angles.',
      expectedElements: ['parallel line', 'angle relationships'],
    },
    rationale: 'The response checks mathematical reasoning.',
    referencedResources: [],
  },
  identification: {
    questionType: 'identification',
    prompt: 'Name a polygon with five sides.',
    answer: { type: 'identification', acceptedAnswers: ['pentagon'], caseSensitive: false },
    rationale: 'A five-sided polygon is a pentagon.',
    referencedResources: [],
  },
  fill_in_the_blank: {
    questionType: 'fill_in_the_blank',
    prompt: 'A triangle has ______ sides.',
    answer: { type: 'fill_in_the_blank', blanks: [{ id: 'blank-1', acceptedAnswers: ['3'], pointsPossible: 1 }] },
    rationale: 'A triangle has three sides.',
    referencedResources: [],
  },
  numerical_answer: {
    questionType: 'numerical_answer',
    prompt: 'Find 25% of 80.',
    answer: { type: 'numerical_answer', value: 20, tolerance: 0, unit: 'items' },
    rationale: 'One fourth of 80 is 20.',
    referencedResources: [],
  },
  problem_solving: {
    questionType: 'problem_solving',
    prompt: 'A rectangle is 6 cm by 4 cm. Find its area.',
    answer: {
      type: 'problem_solving',
      finalAnswer: '24 cm²',
      solutionOutline: 'Multiply length by width: 6 × 4 = 24.',
      subparts: [{ id: 'part-1', prompt: 'State the area formula.', expectedAnswer: 'A = lw', pointsPossible: 1 }],
    },
    rationale: 'The task requires applying the area formula.',
    referencedResources: [],
  },
  matching: {
    questionType: 'matching',
    prompt: 'Match each shape to its number of sides.',
    answer: {
      type: 'matching',
      prompts: [{ id: 'p1', text: 'Triangle' }, { id: 'p2', text: 'Square' }],
      choices: [{ id: 'A', text: '3' }, { id: 'B', text: '4' }, { id: 'C', text: '6' }],
      mappings: [{ promptId: 'p1', choiceId: 'A' }, { promptId: 'p2', choiceId: 'B' }],
      reusableChoices: false,
    },
    rationale: 'Each shape maps to its side count.',
    referencedResources: [],
  },
  multiple_select: {
    questionType: 'multiple_select',
    prompt: 'Select all even numbers.',
    answer: {
      type: 'multiple_select',
      choices: [{ id: 'A', text: '2' }, { id: 'B', text: '3' }, { id: 'C', text: '4' }],
      choiceIds: ['A', 'C'],
      scoringPolicy: 'all_or_nothing',
    },
    rationale: 'Two and four are even.',
    referencedResources: [],
  },
  essay: {
    questionType: 'essay',
    prompt: 'Explain two ways geometry is useful in real-world design problems.',
    answer: {
      type: 'essay',
      keyPoints: ['Measurement and scale', 'Shape and spatial reasoning'],
      rubric: [{ id: 'criterion-1', label: 'Accurate application', pointsPossible: 2 }],
      scoringNotes: 'Award points for two accurate, explained applications.',
    },
    rationale: 'The prompt allows an extended teacher-scored response.',
    referencedResources: [],
  },
}

export function cloneCandidate(type: QuestionType): AssessmentItemCandidate {
  return structuredClone(VALID_ASSESSMENT_CANDIDATES[type])
}

