import { describe, expect, it } from 'vitest'
import { generateAnswerSheetLayout, PAPER_DIMENSIONS_MM } from '../../src/lib/answerSheet/layoutEngine'
import { renderAnswerSheetPageSvg } from '../../src/lib/answerSheet/printRenderer'
import type { AssessmentBlueprint, AssessmentItem } from '../../src/types/assessment'

function createMockAssessment(itemCount = 30): AssessmentBlueprint {
  const items: AssessmentItem[] = Array.from({ length: itemCount }, (_, i) => {
    const num = i + 1
    const isTf = num % 5 === 0
    return {
      id: `item-id-${num}`,
      itemNumber: num,
      questionType: isTf ? 'true_false' : 'multiple_choice',
      prompt: `Prompt for item ${num}`,
      pointsPossible: 1,
      points: 1,
      authorshipState: 'teacher_accepted',
      competencySnapshot: {
        id: 'comp-1',
        code: 'M8AL-Ia-1',
        text: 'Algebra competency',
        sourcePage: 10,
        academicPeriodId: 'q1',
        curriculumPeriodId: 'q1',
        curriculumPeriodLabel: 'Quarter 1',
      },
      cognitiveCategorySnapshot: {
        id: 'cog-1',
        label: 'Understanding',
        shortLabel: 'Und',
      },
      mapping: {
        rowId: 'row-1',
        competencyId: 'comp-1',
        cognitiveCategoryId: 'cog-1',
        allocationItemStart: num,
        allocationItemEnd: num,
        allocationIndex: 1,
      },
      answer: isTf
        ? { type: 'true_false', value: true }
        : {
            type: 'multiple_choice',
            choices: [
              { id: 'c1', text: 'Option A' },
              { id: 'c2', text: 'Option B' },
              { id: 'c3', text: 'Option C' },
              { id: 'c4', text: 'Option D' },
            ],
            choiceId: 'c1',
          },
    }
  })

  return {
    id: 'asm-algebra-q1',
    userId: 'teacher-user-1',
    assignmentId: 'assign-g8-math',
    title: 'Grade 8 Mathematics Quarter 1 Examination',
    instructions: 'Read each item carefully. Shade the corresponding letter on your answer sheet.',
    gradeLevel: '8',
    learningArea: 'Mathematics',
    schoolYear: '2026-2027',
    gradingTermId: 'q1',
    gradingTermLabel: 'Quarter 1',
    curriculumPeriodIds: ['q1'],
    curriculumPeriodLabels: ['Quarter 1'],
    totalItems: itemCount,
    items,
    versionNumber: 1,
    status: 'final',
    createdAt: '2026-08-19T00:00:00.000Z',
    updatedAt: '2026-08-19T00:00:00.000Z',
  }
}

describe('Smart Answer Sheet Layout Engine & Geometry', () => {
  it('generates deterministic fiducial corner coordinates for A4 paper', () => {
    const assessment = createMockAssessment(20)
    const layout = generateAnswerSheetLayout(assessment, { paperSize: 'a4', mode: 'generic', density: '1-up' })

    expect(layout.pages.length).toBe(1)
    const page = layout.pages[0]
    expect(page.dimensionsMm).toEqual(PAPER_DIMENSIONS_MM.a4)

    const { topLeft, topRight, bottomLeft, bottomRight } = page.fiducialMarkers

    // Margins = 6mm, Fiducial size = 5.5mm -> Center = 6 + 2.75 = 8.75mm
    expect(topLeft.centerMm).toEqual({ xMm: 8.75, yMm: 8.75 })
    expect(topRight.centerMm).toEqual({ xMm: 210 - 8.75, yMm: 8.75 })
    expect(bottomLeft.centerMm).toEqual({ xMm: 8.75, yMm: 297 - 8.75 })
    expect(bottomRight.centerMm).toEqual({ xMm: 210 - 8.75, yMm: 297 - 8.75 })
  })

  it('produces stable, identical coordinates across multiple layout runs for the same assessment', () => {
    const assessment = createMockAssessment(30)
    const run1 = generateAnswerSheetLayout(assessment, { now: '2026-08-19T12:00:00Z' })
    const run2 = generateAnswerSheetLayout(assessment, { now: '2026-08-19T12:00:00Z' })

    expect(JSON.stringify(run1)).toBe(JSON.stringify(run2))
  })

  it('distributes 50 questions across columns with exact bubble positions', () => {
    const assessment = createMockAssessment(50)
    const layout = generateAnswerSheetLayout(assessment, { paperSize: 'a4', density: '1-up' })
    const page = layout.pages[0]

    expect(page.items.length).toBe(50)
    expect(page.items[0].itemNumber).toBe(1)
    expect(page.items[49].itemNumber).toBe(50)

    const item1 = page.items[0]
    const item20 = page.items[19]
    const item40 = page.items[39]

    expect(item1.boundsMm.xMm).toBeLessThan(item20.boundsMm.xMm)
    expect(item20.boundsMm.xMm).toBeLessThan(item40.boundsMm.xMm)

    // Check MCQ bubbles count (A, B, C, D = 4 bubbles)
    expect(item1.bubbles.length).toBe(4)
    expect(item1.bubbles.map((b) => b.label)).toEqual(['A', 'B', 'C', 'D'])

    // Check True/False bubbles count (Item 5 is T/F -> 2 bubbles)
    const item5 = page.items[4]
    expect(item5.questionType).toBe('true_false')
    expect(item5.bubbles.length).toBe(2)
    expect(item5.bubbles.map((b) => b.label)).toEqual(['T', 'F'])
  })

  it('renders a valid standalone SVG with header, QR code, fiducials, and marking instructions', () => {
    const assessment = createMockAssessment(25)
    const layout = generateAnswerSheetLayout(assessment, { mode: 'generic' })
    const svg = renderAnswerSheetPageSvg(layout, layout.pages[0])

    expect(svg).toContain('<svg xmlns="http://www.w3.org/2000/svg"')
    expect(svg).toContain('Grade 8 Mathematics Quarter 1 Examination — ANSWER SHEET')
    expect(svg).toContain('v2·GENERIC')
    expect(svg).toContain('NAME:')
    expect(svg).toContain('Shade bubbles completely:')
    expect(svg).toContain('</svg>')
  })
})
