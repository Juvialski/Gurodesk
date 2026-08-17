import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildAssessmentDocxBlob, buildAssessmentPdf, assessmentExportFilename, assessmentPrintHtml, paginateAssessmentLines } from '../../src/lib/assessmentExport'
import { buildAssessmentAnswerKeyExportModel, buildAssessmentExportModel, buildAssessmentStudentExportModel, buildAssessmentTeacherExportModel } from '../../src/lib/assessmentExportModel'
import { createAssessmentBlueprint } from '../../src/lib/assessmentBlueprint'
import { duplicateAssessmentDocument, loadAssessmentDocument, saveAssessmentDocument } from '../../src/lib/assessmentRepository'
import { loadTeacherExportPreferences, saveTeacherExportPreferences } from '../../src/lib/repository'
import { DEFAULT_TOS_COGNITIVE_CATEGORIES } from '../../src/lib/tosFactory'
import { createDefaultTeacherExportPreferences } from '../../src/types/export'
import type { AssessmentRecord } from '../../src/types/assessment'
import type { TosContent, TosRecord } from '../../src/types/tos'
import { ASSESSMENT_QUESTION_TYPES } from '../../src/types/assessment'
import { ASSESSMENT_VISUAL_FIXTURES } from '../../src/lib/assessmentVisualFixtures'
import { assessmentVisualSourceHash } from '../../src/lib/assessmentVisualPlanning'
import { assessmentItem, fixedNow } from './fixtures'
import { cloneCandidate } from './assessmentContractFixtures'

function mixedAssessment(): AssessmentRecord {
  const items = ASSESSMENT_QUESTION_TYPES.map((questionType, index) => {
    const candidate = cloneCandidate(questionType)
    const points = questionType === 'essay' ? 10 : questionType === 'problem_solving' ? 5 : questionType === 'constructed_response' ? 4 : 1
    return {
      ...assessmentItem(questionType, {
      id: `export-item-${index + 1}`,
      itemNumber: index + 1,
      prompt: candidate.prompt,
      answer: candidate.answer,
      rationale: candidate.rationale,
      authorshipState: 'teacher_accepted',
      qaState: 'verified',
      pointsPossible: points,
      points,
      }),
      ...(index === 0 ? { visual: ASSESSMENT_VISUAL_FIXTURES.marksAndLabels } : {}),
    }
  })
  return {
    id: 'assessment-export-1',
    userId: 'teacher-a',
    assignmentId: 'assignment-1',
    title: 'Grade 7 <Geometry> & Number Sense',
    instructions: 'Answer every item and show your work.',
    gradeLevel: 'Grade 7',
    learningArea: 'Mathematics',
    schoolYear: '2026-2027',
    gradingTermId: 'term-1',
    gradingTermLabel: 'Quarter 1',
    curriculumPeriodIds: ['period-1'],
    curriculumPeriodLabels: ['Quarter 1'],
    totalItems: items.length,
    totalPoints: items.reduce((sum, item) => sum + item.pointsPossible, 0),
    settings: { mode: 'auto_balanced', allowedTypes: [...ASSESSMENT_QUESTION_TYPES] },
    versionNumber: 1,
    status: 'final',
    sourceTos: {
      id: 'tos-export-1',
      versionNumber: 1,
      title: 'Finalized geometry TOS',
      status: 'final',
      assignmentId: 'assignment-1',
      schoolYear: '2026-2027',
      academicPeriodLabel: 'Quarter 1',
      content: { rows: [] } as unknown as NonNullable<AssessmentRecord['sourceTos']>['content'],
    },
    items,
    createdAt: fixedNow,
    updatedAt: fixedNow,
  }
}

function oneItemTos(): TosRecord {
  const category = DEFAULT_TOS_COGNITIVE_CATEGORIES[0]
  const content: TosContent = {
    schemaVersion: 1,
    title: 'Persistence TOS',
    assessmentTitle: 'Persistence Assessment',
    gradeLevel: 'Grade 7',
    learningArea: 'Mathematics',
    sections: ['Section A'],
    schoolYear: '2026-2027',
    gradingTermId: 'term-1',
    gradingTermLabel: 'Quarter 1',
    curriculumVersionId: 'curriculum-1',
    curriculumVersionCode: 'MATATAG-G7',
    curriculumVersionName: 'MATATAG Grade 7',
    curriculumSubjectId: 'math-7',
    curriculumPeriodIds: ['period-1'],
    curriculumPeriodLabels: ['Quarter 1'],
    sourceTitle: 'Verified curriculum',
    sourceUrl: '',
    totalItems: 1,
    weightingMethod: 'equal',
    cognitiveCategories: DEFAULT_TOS_COGNITIVE_CATEGORIES.map((entry) => ({ ...entry })),
    rows: [{
      id: 'tos-row-1',
      sortOrder: 1,
      competency: {
        id: 'competency-1', code: 'G7NS-Ia-1', text: 'Represents integers in contexts', sourcePage: 1,
        sourceTitle: 'Verified curriculum', sourceUrl: '', academicPeriodId: 'period-1', curriculumPeriodLabel: 'Quarter 1', verificationStatus: 'verified',
      },
      instructionalMinutes: '', manualWeight: '', itemCountOverride: '', cognitiveWeights: Object.fromEntries(DEFAULT_TOS_COGNITIVE_CATEGORIES.map((entry) => [entry.id, entry.id === category.id ? '1' : '0'])), notes: '', computedWeightPercent: '100.00', itemCount: 1, itemStart: 1, itemEnd: 1, itemRangeLabel: '1',
      cognitiveAllocations: [{ categoryId: category.id, label: category.label, shortLabel: category.shortLabel, itemCount: 1, itemStart: 1, itemEnd: 1, rangeLabel: '1' }],
    }],
    notes: '',
    calculation: { engine: 'hamilton-largest-remainder-v1', valid: true, totalAllocated: 1, calculatedAt: fixedNow, warnings: [] },
  }
  return { id: 'tos-persistence-1', userId: 'teacher-a', assignmentId: 'assignment-1', title: 'Persistence TOS', schoolYear: '2026-2027', academicPeriodLabel: 'Quarter 1', status: 'final', content, versionNumber: 1, createdAt: fixedNow, updatedAt: fixedNow }
}

function memoryStorage() {
  const values = new Map<string, string>()
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value) },
    removeItem: (key: string) => { values.delete(key) },
    clear: () => values.clear(),
    key: (index: number) => [...values.keys()][index] ?? null,
    get length() { return values.size },
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('assessment export model and renderer regressions', () => {
  it('projects every supported question type into student, teacher, and answer-key modes', () => {
    const assessment = mixedAssessment()
    const student = buildAssessmentStudentExportModel(assessment, { teacherName: 'Teacher A' })
    const teacher = buildAssessmentTeacherExportModel(assessment, { includeAnswer: true, includeCompetency: true, includeCognitiveCategory: true, includeRationale: true })
    const answerKey = buildAssessmentAnswerKeyExportModel(assessment)

    expect(student.questions.map((question) => question.questionType)).toEqual([...ASSESSMENT_QUESTION_TYPES])
    expect(teacher.questions.map((question) => question.questionType)).toEqual([...ASSESSMENT_QUESTION_TYPES])
    expect(answerKey.questions.map((question) => question.questionType)).toEqual([...ASSESSMENT_QUESTION_TYPES])
    expect(student.questions.every((question) => !('answer' in question) && !('scoringGuide' in question))).toBe(true)
    expect(teacher.questions.every((question) => 'answer' in question)).toBe(true)
    expect(answerKey.questions.every((question) => 'answer' in question && !('prompt' in question))).toBe(true)
    expect(student.questions[0].visual).toEqual({
      ...ASSESSMENT_VISUAL_FIXTURES.marksAndLabels,
      altText: 'A geometry diagram with mathematical line work and labels. Line segments are shown. Angle markings are shown. Congruence markings are shown. Parallel or perpendicular markings are shown.',
    })
    expect(student.questions[0].visual?.primitives).toEqual(ASSESSMENT_VISUAL_FIXTURES.marksAndLabels.primitives)
    expect(teacher.questions[0].visual).toEqual(ASSESSMENT_VISUAL_FIXTURES.marksAndLabels)
    expect(answerKey.questions[0].visual).toEqual(ASSESSMENT_VISUAL_FIXTURES.marksAndLabels)
    expect(student.metadata.totalItems).toBe(11)
    expect(student.metadata.totalPoints).toBe(27)

    const studentProblem = student.questions.find((question) => question.questionType === 'problem_solving')
    expect(studentProblem && 'subparts' in studentProblem ? studentProblem.subparts : undefined).toEqual([{ label: 'a', prompt: 'State the area formula.', pointsPossible: 1 }])
    expect(JSON.stringify(studentProblem)).not.toMatch(/expectedAnswer|solutionOutline/u)
    expect('scoringGuide' in (teacher.questions.find((question) => question.questionType === 'essay') ?? {})).toBe(true)
    const matchingKey = answerKey.questions.find((question) => question.questionType === 'matching')
    expect(matchingKey && 'scoringGuide' in matchingKey ? matchingKey.scoringGuide : '').toMatch(/points per match|Match 1/u)
  })

  it('supports explicit language and sanitized filenames without mutating assessment content', () => {
    const assessment = mixedAssessment()
    const filipino = buildAssessmentExportModel(assessment, { mode: 'student', documentLanguage: 'filipino' })
    expect(filipino.language).toBe('filipino')
    expect(filipino.labels.documentTitle).toBe('PAGTATAYA')
    expect(assessmentExportFilename(filipino, 'pdf')).not.toMatch(/[/:*?"<>|]/u)
    expect(assessment.title).toContain('<Geometry>')
  })

  it('keeps student print HTML escaped and free of answer-key data', () => {
    const assessment = mixedAssessment()
    const model = buildAssessmentStudentExportModel(assessment)
    const html = assessmentPrintHtml(model)
    expect(html).toContain('&lt;Geometry&gt;')
    expect(html).not.toContain('<script')
    expect(html).not.toContain('acceptedAnswers')
    expect(html).not.toContain('solutionOutline')
    expect(html).toContain('assessment-question-matching')
    expect(html).toContain('assessment-question-essay')
    expect(html).toContain('<svg class="assessment-print-visual"')
    expect(html).toContain('stroke-dasharray="7 5"')
    expect(html).toContain('<polyline')
    expect(html).toContain('assessment-section-heading')
    expect(html).toContain('question-core')
    expect(html).toContain('matching-grid')
    expect(html).toContain('assessment-question-true_false')
    expect(html).not.toContain('Response: __________________________________')
  })

  it('builds nonempty PDF and DOCX output through the dedicated export path', async () => {
    const model = buildAssessmentTeacherExportModel(mixedAssessment(), { includeAnswer: true })
    const pdf = buildAssessmentPdf(model, 'letter')
    const pdfBytes = pdf.output('arraybuffer') as ArrayBuffer
    expect(pdf.getNumberOfPages()).toBeGreaterThan(0)
    expect(pdfBytes.byteLength).toBeGreaterThan(500)
    const pdfText = pdf.output()
    expect(pdfText).toContain('] 0. d')
    expect(pdfText).toContain('[] 0. d')

    const docx = await buildAssessmentDocxBlob(model, 'letter')
    expect(docx.size).toBeGreaterThan(500)
  })

  it('paginates in deterministic chunks and rejects invalid geometry limits', () => {
    expect(paginateAssessmentLines(['a', 'b', 'c', 'd', 'e'], 2)).toEqual([{ lines: ['a', 'b'] }, { lines: ['c', 'd'] }, { lines: ['e'] }])
    expect(() => paginateAssessmentLines(['a'], 0)).toThrow(/positive whole number/u)
  })
})

describe('assessment export and preview persistence regressions', () => {
  it('persists paper/language preferences and the saved structured assessment through demo reload and duplication', async () => {
    vi.stubGlobal('localStorage', memoryStorage())
    const defaults = createDefaultTeacherExportPreferences('teacher-a')
    const savedPreferences = await saveTeacherExportPreferences({ ...defaults, paperSize: 'legal', documentLanguage: 'filipino' }, true)
    expect((await loadTeacherExportPreferences('teacher-a', true)).paperSize).toBe('legal')
    expect((await loadTeacherExportPreferences('teacher-a', true)).documentLanguage).toBe('filipino')
    expect(savedPreferences.userId).toBe('teacher-a')

    const tos = oneItemTos()
    const draft = createAssessmentBlueprint(tos, { id: 'assessment-persistence-1', userId: 'teacher-a', title: 'Persisted assessment', now: fixedNow })
    const candidate = cloneCandidate('multiple_choice')
    const visualPlanSource = { ...draft.items[0], prompt: candidate.prompt, answer: candidate.answer }
    const visualSourceHash = assessmentVisualSourceHash(visualPlanSource)
    const edited: AssessmentRecord = {
      ...draft,
      items: [{
        ...draft.items[0],
        prompt: candidate.prompt,
        answer: candidate.answer,
        rationale: candidate.rationale,
        authorshipState: 'teacher_accepted',
        qaState: 'verified',
        visual: ASSESSMENT_VISUAL_FIXTURES.irregularConcavePentagon,
        visualRequirement: 'helpful',
        visualIntent: 'Show the polygon without naming or classifying it.',
        visualStatus: 'succeeded',
        visualAttempts: 1,
        visualSourceHash,
        visualUpdatedAt: fixedNow,
        history: [{
          id: 'history-visual-plan-1',
          savedAt: fixedNow,
          source: 'generated',
          prompt: candidate.prompt,
          questionType: 'multiple_choice',
          answer: candidate.answer,
          rationale: candidate.rationale,
          pointsPossible: 1,
          points: 1,
          qaState: 'verified',
          visualRequirement: 'helpful',
          visualIntent: 'Show the polygon without naming or classifying it.',
          visualStatus: 'pending',
          visualAttempts: 0,
          visualSourceHash,
        }],
      }],
      totalPoints: 1,
    }
    const saved = await saveAssessmentDocument(edited, true)
    const loaded = await loadAssessmentDocument(saved.id, 'teacher-a', true)
    expect(loaded?.items[0].prompt).toBe(candidate.prompt)
    expect(loaded?.items[0].answer).toEqual(candidate.answer)
    expect(loaded?.items[0].visual).toEqual(ASSESSMENT_VISUAL_FIXTURES.irregularConcavePentagon)
    expect(loaded?.items[0]).toMatchObject({
      visualRequirement: 'helpful',
      visualIntent: 'Show the polygon without naming or classifying it.',
      visualStatus: 'succeeded',
      visualAttempts: 1,
      visualSourceHash,
      visualUpdatedAt: fixedNow,
    })
    expect(loaded?.items[0].history?.[0]).toMatchObject({ visualRequirement: 'helpful', visualStatus: 'pending', visualSourceHash })
    expect(loaded?.sourceTos?.id).toBe(tos.id)
    expect(loaded?.versionNumber).toBeGreaterThan(saved.versionNumber - 1)

    const duplicate = await duplicateAssessmentDocument(loaded!, true)
    expect(duplicate.id).not.toBe(loaded?.id)
    expect(duplicate.items[0].id).not.toBe(loaded?.items[0].id)
    expect(duplicate.items[0].prompt).toBe(candidate.prompt)
    expect(duplicate.items[0].visual).toEqual(ASSESSMENT_VISUAL_FIXTURES.irregularConcavePentagon)
    expect(duplicate.items[0]).toMatchObject({ visualRequirement: 'helpful', visualStatus: 'succeeded', visualSourceHash })
    expect(duplicate.items[0].history?.[0]).toMatchObject({ visualRequirement: 'helpful', visualStatus: 'pending', visualSourceHash })
    expect(duplicate.sourceTos?.content).toEqual(loaded?.sourceTos?.content)
  })
})
