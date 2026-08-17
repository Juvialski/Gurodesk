import { describe, expect, it } from 'vitest'
import { reviewAssessmentForFinalization } from '../../src/lib/assessmentFinalReview'
import { buildAssessmentExportModel } from '../../src/lib/assessmentExportModel'
import { createPerformanceTaskContent } from '../../src/lib/performanceTaskRubric'
import type { AssessmentRecord } from '../../src/types/assessment'
import type { AssessmentStudentExportQuestion, AssessmentTeacherExportQuestion, AssessmentAnswerKeyExportQuestion } from '../../src/types/assessmentExport'
import { assessmentItem, assessmentRecord } from './fixtures'

describe('assessment modes stabilization and finalization', () => {
  it('correctly reviews and finalizes a single-lesson quiz without requiring a source TOS', () => {
    const prompts = [
      'What is the definition of an integer in mathematics?',
      'Which number is strictly greater: -5 or -2?',
      'Calculate the sum of -8 and positive 12.',
      'Identify the absolute value of -15.',
      'Determine which coordinate lies to the left of zero on a number line.',
    ]

    const items = prompts.map((promptText, idx) =>
      assessmentItem('multiple_choice', {
        id: `quiz-item-${idx + 1}`,
        itemNumber: idx + 1,
        prompt: promptText,
        authorshipState: 'manual',
        qaState: 'verified',
        locked: true,
        answer: {
          type: 'multiple_choice',
          choiceId: ['A', 'B', 'C', 'D', 'A'][idx],
          choices: [
            { id: 'A', text: `Option A for question ${idx + 1}` },
            { id: 'B', text: `Option B for question ${idx + 1}` },
            { id: 'C', text: `Option C for question ${idx + 1}` },
            { id: 'D', text: `Option D for question ${idx + 1}` },
          ],
        },
      })
    )

    const base = assessmentRecord(items)
    const quiz: AssessmentRecord = {
      ...base,
      id: 'quiz-123',
      title: 'Grade 7 Math Lesson Check',
      mode: 'lesson_quiz',
      sourceTos: undefined,
      sourceLesson: {
        id: 'lesson-1',
        title: 'Introduction to Integers',
        gradeLevel: 'Grade 7',
        learningArea: 'Mathematics',
        schoolYear: '2026-2027',
        learningObjectives: ['Describe integers'],
        competencies: [items[0].competencySnapshot],
      },
    }

    const review = reviewAssessmentForFinalization(quiz)
    expect(review.hardErrors).toEqual([])
    expect(review.canFinalize).toBe(true)
    expect(review.metrics.itemCount).toBe(5)
    expect(review.metrics.totalPoints).toBe(5)
  })

  it('correctly reviews and finalizes a multi-lesson unit quiz', () => {
    const unitPrompts = [
      'Define what a contact force is with everyday examples.',
      'State Newton second law of motion in relationship to mass.',
      'Explain how friction affects the acceleration of a rolling ball.',
      'Differentiate between potential and kinetic energy in a rollercoaster.',
      'Calculate the work done when a force of 10 Newtons moves a box 3 meters.',
      'Identify which form of energy is stored in a compressed spring.',
      'Describe what happens to thermal energy when ice melts into water.',
      'Compare speed and velocity in terms of scalar and vector quantities.',
      'Explain the law of conservation of mechanical energy in closed systems.',
      'Identify the unit used to measure electrical potential difference.',
      'Explain how magnetic fields are generated around a current-carrying wire.',
      'Describe the difference between series and parallel electrical circuits.',
      'Calculate the power dissipated by a 5 ohm resistor carrying 2 amperes.',
      'Explain how sound waves propagate through different states of matter.',
      'Analyze the relationship between wave frequency and wavelength.',
    ]

    const items = unitPrompts.map((promptText, idx) =>
      assessmentItem('multiple_choice', {
        id: `unit-item-${idx + 1}`,
        itemNumber: idx + 1,
        prompt: promptText,
        authorshipState: 'manual',
        qaState: 'verified',
        locked: true,
        answer: {
          type: 'multiple_choice',
          choiceId: idx % 2 === 0 ? 'A' : 'B',
          choices: [
            { id: 'A', text: `First scientific explanation ${idx + 1}` },
            { id: 'B', text: `Second scientific explanation ${idx + 1}` },
          ],
        },
      })
    )

    const base = assessmentRecord(items)
    const unitQuiz: AssessmentRecord = {
      ...base,
      id: 'unit-quiz-123',
      title: 'Unit 1 Summative Assessment',
      mode: 'unit_quiz',
      sourceTos: undefined,
      sourceLessons: [
        { id: 'l1', title: 'Lesson 1', gradeLevel: 'Grade 8', learningArea: 'Science', schoolYear: '2026-2027', learningObjectives: ['Obj 1'], competencies: [items[0].competencySnapshot] },
        { id: 'l2', title: 'Lesson 2', gradeLevel: 'Grade 8', learningArea: 'Science', schoolYear: '2026-2027', learningObjectives: ['Obj 2'], competencies: [items[0].competencySnapshot] },
      ],
    }

    const review = reviewAssessmentForFinalization(unitQuiz)
    expect(review.hardErrors).toEqual([])
    expect(review.canFinalize).toBe(true)
    expect(review.metrics.itemCount).toBe(15)
    expect(review.metrics.totalPoints).toBe(15)
  })

  it('correctly reviews and validates an Authentic Performance Task', () => {
    const ptContent = createPerformanceTaskContent({
      title: 'Community Hazard Map Design',
      scenario: 'You are a community disaster risk consultant assigned to assess typhoon preparedness.',
      studentInstructions: 'Create a localized hazard map with evacuation routes and risk zones.',
      expectedOutput: 'A colored hazard map and 1-page risk explanation.',
      grouping: 'group',
      milestones: [
        { id: 'm1', title: 'Research and data gathering' },
        { id: 'm2', title: 'Map drafting and validation' },
      ],
      rubric: {
        totalPoints: 20,
        criteria: [
          {
            id: 'c1',
            name: 'Accuracy of Hazards Identified',
            description: 'Hazard identification fidelity',
            pointsPossible: 10,
            levels: [
              { id: 'l4', label: 'Advanced', descriptor: 'All hazards mapped accurately with precise legend', points: 10 },
              { id: 'l3', label: 'Proficient', descriptor: 'Most hazards identified correctly', points: 8 },
              { id: 'l2', label: 'Approaching', descriptor: 'Some hazards identified but incomplete', points: 6 },
              { id: 'l1', label: 'Developing', descriptor: 'Major hazards missing', points: 4 },
            ],
          },
          {
            id: 'c2',
            name: 'Clarity and Evacuation Route Design',
            description: 'Evacuation clarity',
            pointsPossible: 10,
            levels: [
              { id: 'l4', label: 'Advanced', descriptor: 'Clear, direct, and fully labeled evacuation paths', points: 10 },
              { id: 'l3', label: 'Proficient', descriptor: 'Paths are clear with minor ambiguity', points: 8 },
              { id: 'l2', label: 'Approaching', descriptor: 'Paths lack clarity', points: 6 },
              { id: 'l1', label: 'Developing', descriptor: 'Unclear or unsafe paths', points: 4 },
            ],
          },
        ],
      },
    })

    const base = assessmentRecord([])
    const perfTask: AssessmentRecord = {
      ...base,
      id: 'pt-123',
      title: 'Disaster Risk Hazard Map Performance Task',
      totalItems: 0,
      totalPoints: 20,
      mode: 'performance_task',
      items: [],
      sourceTos: undefined,
      performanceTask: ptContent,
    }

    const review = reviewAssessmentForFinalization(perfTask)
    expect(review.hardErrors).toEqual([])
    expect(review.canFinalize).toBe(true)
    expect(review.metrics.totalPoints).toBe(20)
    expect(review.metrics.teacherScoredPoints).toBe(20)
  })

  it('builds student, teacher, and answer key export models for performance tasks', () => {
    const ptContent = createPerformanceTaskContent({
      title: 'Community Hazard Map Design',
      scenario: 'You are a community disaster risk consultant.',
      studentInstructions: 'Create a localized hazard map.',
      expectedOutput: 'A colored hazard map.',
      milestones: [
        { id: 'm1', title: 'Outline' },
        { id: 'm2', title: 'Final Map' },
      ],
      rubric: {
        totalPoints: 16,
        criteria: [
          { id: 'c1', name: 'Technical Accuracy', description: 'Accuracy', pointsPossible: 8, levels: [] },
          { id: 'c2', name: 'Visual Clarity', description: 'Clarity', pointsPossible: 8, levels: [] },
        ],
      },
    })

    const base = assessmentRecord([])
    const perfTask: AssessmentRecord = {
      ...base,
      id: 'pt-456',
      title: 'Hazard Map Task',
      totalItems: 0,
      totalPoints: 16,
      mode: 'performance_task',
      status: 'final',
      items: [],
      sourceTos: undefined,
      performanceTask: ptContent,
    }

    const options = {
      mode: 'student' as const,
      paperSize: 'a4' as const,
      documentLanguage: 'english' as const,
      teacherName: 'Teacher Maria',
      schoolName: 'National High School',
      includeAnswer: false,
    }

    const studentModel = buildAssessmentExportModel(perfTask, options)
    expect(studentModel.questions.length).toBe(1)
    const studentQ = studentModel.questions[0] as AssessmentStudentExportQuestion
    expect(studentQ.prompt).toContain('community disaster risk consultant')
    expect(studentModel.metadata.totalPoints).toBe(16)

    const teacherModel = buildAssessmentExportModel(perfTask, { ...options, mode: 'teacher', includeAnswer: true })
    expect(teacherModel.questions.length).toBe(1)
    const teacherQ = teacherModel.questions[0] as AssessmentTeacherExportQuestion
    expect(teacherQ.answer).toBeDefined()

    const answerKeyModel = buildAssessmentExportModel(perfTask, { ...options, mode: 'answer_key', includeAnswer: true })
    expect(answerKeyModel.questions.length).toBe(1)
    const answerKeyQ = answerKeyModel.questions[0] as AssessmentAnswerKeyExportQuestion
    expect(answerKeyQ.scoringGuide).toContain('Analytic Rubric Criteria')
  })
})
