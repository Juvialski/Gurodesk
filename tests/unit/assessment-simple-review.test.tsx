import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import React from 'react'
import { AssessmentSimpleAnswerReview } from '../../src/components/assessment/AssessmentSimpleAnswerReview'
import type {
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
} from '../../src/types/assessment'

describe('AssessmentSimpleAnswerReview', () => {
  it('renders multiple choice with choices A-D and marks correct answer with badge', () => {
    const answer: AssessmentMultipleChoiceAnswer = {
      choices: [
        { id: 'c1', text: 'Option Alpha' },
        { id: 'c2', text: 'Option Beta' },
        { id: 'c3', text: 'Option Gamma' },
        { id: 'c4', text: 'Option Delta' },
      ],
      choiceId: 'c2',
    }

    const html = renderToStaticMarkup(<AssessmentSimpleAnswerReview questionType="multiple_choice" answer={answer} />)

    expect(html).toContain('Answer choices')
    expect(html).toContain('Option Alpha')
    expect(html).toContain('Option Beta')
    expect(html).toContain('Option Gamma')
    expect(html).toContain('Option Delta')
    expect(html).toContain('A.')
    expect(html).toContain('B.')
    expect(html).toContain('is-correct')
    expect(html).toContain('Correct answer')
  })

  it('renders true/false with clear badge', () => {
    const answerTrue: AssessmentTrueFalseAnswer = { value: true }
    const htmlTrue = renderToStaticMarkup(<AssessmentSimpleAnswerReview questionType="true_false" answer={answerTrue} />)
    expect(htmlTrue).toContain('True')
    expect(htmlTrue).toContain('true-val')

    const answerFalse: AssessmentTrueFalseAnswer = { value: false }
    const htmlFalse = renderToStaticMarkup(<AssessmentSimpleAnswerReview questionType="true_false" answer={answerFalse} />)
    expect(htmlFalse).toContain('False')
    expect(htmlFalse).toContain('false-val')
  })

  it('renders short answer and identification with primary and alternative answers', () => {
    const answer: AssessmentShortAnswer = {
      acceptedAnswers: ['Photosynthesis', 'photosynthesis', 'Light reaction'],
    }

    const html = renderToStaticMarkup(<AssessmentSimpleAnswerReview questionType="short_answer" answer={answer} />)
    expect(html).toContain('Photosynthesis')
    expect(html).toContain('Accepted alternatives:')
    expect(html).toContain('photosynthesis')
    expect(html).toContain('Light reaction')
  })

  it('renders fill in the blank with per-blank cards', () => {
    const answer: AssessmentFillInTheBlankAnswer = {
      blanks: [
        { id: 'b1', acceptedAnswers: ['nucleus'], pointsPossible: 1 },
        { id: 'b2', acceptedAnswers: ['mitochondria', 'mitochondrion'], pointsPossible: 2 },
      ],
    }

    const html = renderToStaticMarkup(<AssessmentSimpleAnswerReview questionType="fill_in_the_blank" answer={answer} />)
    expect(html).toContain('Blank A')
    expect(html).toContain('nucleus')
    expect(html).toContain('Blank B')
    expect(html).toContain('mitochondria / mitochondrion')
    expect(html).toContain('(2 points)')
  })

  it('renders numerical answer with value, unit, and tolerance', () => {
    const answer: AssessmentNumericalAnswer = {
      value: 9.8,
      unit: 'm/s^2',
      tolerance: 0.1,
      requireUnit: true,
    }

    const html = renderToStaticMarkup(<AssessmentSimpleAnswerReview questionType="numerical_answer" answer={answer} />)
    expect(html).toContain('9.8')
    expect(html).toContain('m/s^2')
    expect(html).toContain('±0.1')
    expect(html).toContain('Unit required')
  })

  it('renders multiple select with checkboxes and all correct choices marked', () => {
    const answer: AssessmentMultipleSelectAnswer = {
      choices: [
        { id: 'ms1', text: 'Nitrogen' },
        { id: 'ms2', text: 'Oxygen' },
        { id: 'ms3', text: 'Helium' },
      ],
      choiceIds: ['ms1', 'ms2'],
    }

    const html = renderToStaticMarkup(<AssessmentSimpleAnswerReview questionType="multiple_select" answer={answer} />)
    const matches = html.match(/assessment-simple-correct-badge/g)
    expect(matches).toHaveLength(2)
    expect(html).toContain('Nitrogen')
    expect(html).toContain('Oxygen')
  })

  it('renders matching pairings with arrows and prompt/choice labels', () => {
    const answer: AssessmentMatchingAnswer = {
      prompts: [
        { id: 'p1', text: 'Capital of France' },
        { id: 'p2', text: 'Capital of Japan' },
      ],
      choices: [
        { id: 'c1', text: 'Paris' },
        { id: 'c2', text: 'Tokyo' },
      ],
      mappings: [
        { promptId: 'p1', choiceId: 'c1', pointsPossible: 1 },
        { promptId: 'p2', choiceId: 'c2', pointsPossible: 1 },
      ],
    }

    const html = renderToStaticMarkup(<AssessmentSimpleAnswerReview questionType="matching" answer={answer} />)
    expect(html).toContain('Capital of France')
    expect(html).toContain('Paris')
    expect(html).toContain('Capital of Japan')
    expect(html).toContain('Tokyo')
    expect(html).toContain('➔')
  })

  it('renders problem solving with final answer and solution outline', () => {
    const answer: AssessmentProblemSolvingAnswer = {
      finalAnswer: '120 cm²',
      solutionOutline: 'Area = 1/2 * base * height = 1/2 * 20 * 12 = 120',
      subparts: [
        { id: 'sp1', prompt: 'Find the height', expectedAnswer: '12', pointsPossible: 1 },
      ],
    }

    const html = renderToStaticMarkup(<AssessmentSimpleAnswerReview questionType="problem_solving" answer={answer} />)
    expect(html).toContain('120 cm²')
    expect(html).toContain('Area = 1/2 * base * height')
    expect(html).toContain('Find the height')
  })

  it('renders constructed response with rubric and sample response', () => {
    const answer: AssessmentConstructedResponseAnswer = {
      expectedResponse: 'Explain the three laws of motion.',
      sampleResponse: 'First law is inertia, second is F=ma, third is action-reaction.',
      rubricGuidance: 'Award full marks for clear definitions and examples.',
      rubric: [
        { id: 'r1', label: 'Concept Accuracy', pointsPossible: 3, description: 'Correct scientific concepts' },
      ],
    }

    const html = renderToStaticMarkup(<AssessmentSimpleAnswerReview questionType="constructed_response" answer={answer} />)
    expect(html).toContain('Explain the three laws of motion.')
    expect(html).toContain('First law is inertia, second is F=ma, third is action-reaction.')
    expect(html).toContain('Concept Accuracy:')
  })

  it('renders essay with key points and rubric criteria', () => {
    const answer: AssessmentEssayAnswer = {
      keyPoints: ['Point A: Introduction to topic', 'Point B: Comparative analysis'],
      scoringNotes: 'Check for logical coherence.',
      rubric: [
        { id: 'er1', label: 'Organization', pointsPossible: 5, description: 'Structured paragraphs' },
      ],
    }

    const html = renderToStaticMarkup(<AssessmentSimpleAnswerReview questionType="essay" answer={answer} />)
    expect(html).toContain('Point A: Introduction to topic')
    expect(html).toContain('Point B: Comparative analysis')
    expect(html).toContain('Check for logical coherence.')
    expect(html).toContain('Organization:')
  })
})
