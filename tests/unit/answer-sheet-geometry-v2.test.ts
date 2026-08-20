import { describe, expect, it } from 'vitest'
import { resolveSlipsPerPage, validateAnswerSheetFit } from '../../src/lib/answerSheet/layoutPolicy'
import { generateAnswerSheetLayout } from '../../src/lib/answerSheet/layoutEngine'
import { encodeAnswerSheetQrPayload, decodeAnswerSheetQrPayload } from '../../src/lib/answerSheet/qrPayload'
import { renderAnswerSheetPageSvg } from '../../src/lib/answerSheet/printRenderer'
import { buildAnswerSheetDocxBlob } from '../../src/lib/answerSheet/answerSheetDocxExport'
import { createExternalExamBlueprint } from '../../src/lib/answerSheet/externalExamAdapter'
import { processAnswerSheetImage } from '../../src/lib/omr/omrEngine'
import { matchScanToLearner } from '../../src/lib/omr/learnerMatching'
import { checkDuplicateScan, resolveDuplicateOutcomes } from '../../src/lib/omr/duplicateSafety'
import { createSyntheticAnswerSheetImage } from './omr-synthetic-fixtures'
import type { AssessmentBlueprint, AssessmentItem, AssessmentRecord } from '../../src/types/assessment'
import type { ResultAssessmentSnapshot, ResultItemOutcome, ResultLearnerSnapshot } from '../../src/types/results'

function createMatchingAssessment(): AssessmentBlueprint {
  const matchingItem: AssessmentItem = {
    id: 'item-matching-1',
    itemNumber: 1,
    questionType: 'matching',
    prompt: 'Match column A with column B',
    pointsPossible: 3,
    points: 3,
    authorshipState: 'teacher_accepted',
    competencySnapshot: {
      id: 'comp-1',
      code: 'M8-1',
      text: 'Matching competency',
      sourcePage: 1,
      academicPeriodId: 'q1',
      curriculumPeriodId: 'q1',
      curriculumPeriodLabel: 'Q1',
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
      allocationItemStart: 1,
      allocationItemEnd: 3,
      allocationIndex: 1,
    },
    answer: {
      type: 'matching',
      prompts: [
        { id: 'p1', text: 'Prompt 1' },
        { id: 'p2', text: 'Prompt 2' },
        { id: 'p3', text: 'Prompt 3' },
      ],
      choices: [
        { id: 'c1', text: 'Option A', label: 'A' },
        { id: 'c2', text: 'Option B', label: 'B' },
        { id: 'c3', text: 'Option C', label: 'C' },
        { id: 'c4', text: 'Option D', label: 'D' },
      ],
      mappings: [
        { promptId: 'p1', choiceId: 'c1' },
        { promptId: 'p2', choiceId: 'c2' },
        { promptId: 'p3', choiceId: 'c3' },
      ],
    },
  }

  return {
    id: 'asm-matching-test',
    userId: 'user-1',
    assignmentId: 'assign-1',
    title: 'Matching Geometry Test',
    instructions: 'Match the items.',
    gradeLevel: '8',
    learningArea: 'Science',
    schoolYear: '2026-2027',
    gradingTermId: 'q1',
    gradingTermLabel: 'Quarter 1',
    curriculumPeriodIds: ['q1'],
    curriculumPeriodLabels: ['Quarter 1'],
    totalItems: 1,
    items: [matchingItem],
    versionNumber: 1,
    status: 'final',
    createdAt: '2026-08-20T00:00:00.000Z',
    updatedAt: '2026-08-20T00:00:00.000Z',
  }
}

describe('Smart Answer Sheet Geometry & Robustness Fixes (P0/P1)', () => {
  describe('Layout Policy & Fit Validation', () => {
    it('resolves density and slips per page across different paper sizes', () => {
      expect(resolveSlipsPerPage(10, 'auto', 'a4')).toBe(3)
      expect(resolveSlipsPerPage(20, 'auto', 'a4')).toBe(2)
      expect(resolveSlipsPerPage(40, 'auto', 'a4')).toBe(1)

      expect(resolveSlipsPerPage(10, '2-up', 'a4')).toBe(2)
      expect(resolveSlipsPerPage(10, '1-up', 'letter')).toBe(1)
    })

    it('validates physical printable fit and flags overflow layouts', () => {
      const fitValid = validateAnswerSheetFit(10, '3-up', 'a4')
      expect(fitValid.valid).toBe(true)

      const fitOverflow = validateAnswerSheetFit(60, '3-up', 'a4')
      expect(fitOverflow.valid).toBe(false)
      expect(fitOverflow.reason).toContain('Cannot fit 60 items')
    })
  })

  describe('Matching Item Geometry & Vertical Spacing', () => {
    it('computes distinct vertical Y offsets and labels for each matching sub-prompt row', () => {
      const assessment = createMatchingAssessment()
      const layout = generateAnswerSheetLayout(assessment, { paperSize: 'a4', density: '1-up' })

      const item = layout.pages[0].items[0]
      expect(item.questionType).toBe('matching')
      expect(item.matchingPrompts).toBeDefined()
      expect(item.matchingPrompts?.length).toBe(3)

      const prompt1 = item.matchingPrompts![0]
      const prompt2 = item.matchingPrompts![1]
      const prompt3 = item.matchingPrompts![2]

      expect(prompt1.promptLabel).toBe('1.')
      expect(prompt2.promptLabel).toBe('2.')
      expect(prompt3.promptLabel).toBe('3.')

      const y1 = prompt1.bubbles[0].centerMm.yMm
      const y2 = prompt2.bubbles[0].centerMm.yMm
      const y3 = prompt3.bubbles[0].centerMm.yMm

      // Must be strictly increasing and not equal
      expect(y2).toBeGreaterThan(y1)
      expect(y3).toBeGreaterThan(y2)

      const svg = renderAnswerSheetPageSvg(layout, layout.pages[0])
      expect(svg).toContain('1.')
      expect(svg).toContain('2.')
      expect(svg).toContain('3.')
    })
  })

  describe('QR Payload v2 Evolution & Backwards Compatibility', () => {
    it('encodes and decodes v2 QR payload with paperSize and slipsPerPage', () => {
      const qrStr = encodeAnswerSheetQrPayload({
        assessmentId: 'asm-uuid-v2',
        assessmentVersion: 2,
        layoutVersion: 'v2',
        paperSize: 'legal',
        slipsPerPage: 2,
        mode: 'generic',
      })

      expect(qrStr).toContain('GD:AS:v2')
      expect(qrStr).toContain('p:legal')
      expect(qrStr).toContain('d:2')

      const decoded = decodeAnswerSheetQrPayload(qrStr)
      expect(decoded.success).toBe(true)
      expect(decoded.payload?.format).toBe('GD:AS:v2')
      expect(decoded.payload?.paperSize).toBe('legal')
      expect(decoded.payload?.slipsPerPage).toBe(2)
      expect(decoded.payload?.assessmentId).toBe('asm-uuid-v2')
    })

    it('successfully decodes legacy v1 QR payloads without crashing', () => {
      const rawV1 = encodeAnswerSheetQrPayload({
        assessmentId: 'asm-legacy-01',
        assessmentVersion: 1,
        layoutVersion: 'v1',
        mode: 'generic',
      })
      expect(rawV1).toContain('GD:AS:v1')

      const decoded = decodeAnswerSheetQrPayload(rawV1)
      expect(decoded.success).toBe(true)
      expect(decoded.payload?.format).toBe('GD:AS:v1')
      expect(decoded.payload?.assessmentId).toBe('asm-legacy-01')
    })
  })

  describe('DOCX Graphical SVG ImageRun Export', () => {
    it('generates a valid DOCX blob with canonical graphical SVG answer sheet elements', async () => {
      const assessment = createMatchingAssessment() as unknown as AssessmentRecord
      const blob = await buildAnswerSheetDocxBlob(assessment, {
        mode: 'generic',
        paperSize: 'a4',
        density: '2-up',
        copies: 2,
      })

      expect(blob).toBeDefined()
      expect(blob.size).toBeGreaterThan(1000)
    })
  })

  describe('Scanner OMR Layout Reconstruction from Snapshot', () => {
    it('processes image and reconstructs layout definition from assessment snapshot', () => {
      const assessment = createMatchingAssessment()
      const layout = generateAnswerSheetLayout(assessment, { mode: 'generic' })
      const image = createSyntheticAnswerSheetImage(layout, {
        marks: {
          1: 'A',
        },
      })

      const snapshot: ResultAssessmentSnapshot = {
        assessmentId: assessment.id,
        assessmentVersionNumber: assessment.versionNumber,
        assessmentTitle: assessment.title,
        assignmentId: assessment.assignmentId || '',
        gradeLevel: assessment.gradeLevel,
        learningArea: assessment.learningArea,
        schoolYear: assessment.schoolYear,
        gradingTermId: assessment.gradingTermId,
        gradingTermLabel: assessment.gradingTermLabel,
        curriculumPeriodIds: assessment.curriculumPeriodIds,
        curriculumPeriodLabels: assessment.curriculumPeriodLabels,
        totalItems: assessment.totalItems,
        totalPossiblePoints: assessment.totalPoints ?? assessment.totalItems,
        items: assessment.items as any,
      }

      const scanResult = processAnswerSheetImage(image, {
        expectedAssessmentSnapshot: snapshot,
      })

      expect(scanResult.success).toBe(true)
      expect(scanResult.recognizedItems.length).toBe(1)
    })
  })

  describe('Learner Matching & Generic Scan Safety', () => {
    it('does not auto-match generic scans to any learner, requiring explicit selection', () => {
      const scanResult: any = {
        mode: 'generic',
        learnerId: undefined,
        recognizedItems: [],
      }

      const sessionLearners: ResultLearnerSnapshot[] = [
        { participantId: 'p1', learnerId: 'l1', displayName: 'Student 1', localReference: '001', learnerWasActive: true },
        { participantId: 'p2', learnerId: 'l2', displayName: 'Student 2', localReference: '002', learnerWasActive: true },
      ]

      const match = matchScanToLearner(scanResult, sessionLearners)
      expect(match.matchedLearner).toBeNull()
      expect(match.isAutoMatched).toBe(false)
      expect(match.unscannedCandidates.length).toBe(2)
    })
  })

  describe('Duplicate Safety Resolution Semantics', () => {
    it('detects duplicate collision and supports REPLACE, KEEP_CURRENT, and SKIP', () => {
      const scanResult: any = {
        imageFingerprint: 'fingerprint-123',
        recognizedItems: [],
      }

      const newOutcomes: ResultItemOutcome[] = [
        {
          id: 'out-1',
          resultSessionId: 'sess-1',
          participantId: 'p1',
          itemId: 'item-1',
          itemNumber: 1,
          learnerId: 'l1',
          earnedPoints: 1,
          possiblePoints: 1,
          isCorrect: true,
          answer: { type: 'multiple_choice', choiceId: 'A' },
          teacherFeedback: null,
          scoringSource: 'deterministic',
          updatedAt: '2026-08-20T00:00:00Z',
        },
      ]

      const existingOutcomes: ResultItemOutcome[] = [
        {
          id: 'out-0',
          resultSessionId: 'sess-1',
          participantId: 'p1',
          itemId: 'item-1',
          itemNumber: 1,
          learnerId: 'l1',
          earnedPoints: 1,
          possiblePoints: 1,
          isCorrect: true,
          answer: { type: 'multiple_choice', choiceId: 'A' },
          teacherFeedback: null,
          scoringSource: 'deterministic',
          updatedAt: '2026-08-20T00:00:00Z',
        },
      ]

      const check = checkDuplicateScan(
        scanResult,
        'l1',
        'Student 1',
        newOutcomes,
        existingOutcomes,
        new Set(['fingerprint-other']),
      )

      expect(check.hasCollision).toBe(true)
      expect(check.collisionType).toBe('EXISTING_LEARNER_RECORD')

      const replaced = resolveDuplicateOutcomes('REPLACE', existingOutcomes, newOutcomes, 'l1')
      expect(replaced.length).toBe(1)
      expect(replaced[0].earnedPoints).toBe(1)

      const kept = resolveDuplicateOutcomes('KEEP_CURRENT', existingOutcomes, newOutcomes, 'l1')
      expect(kept[0].earnedPoints).toBe(1)

      const skipped = resolveDuplicateOutcomes('SKIP', existingOutcomes, newOutcomes, 'l1')
      expect(skipped[0].earnedPoints).toBe(1)
    })
  })

  describe('External Exam Competency Snapshot Integrity', () => {
    it('sets competency code to null and text to unmapped, preserving assignmentId', () => {
      const blueprint = createExternalExamBlueprint({
        userId: 'teacher-1',
        assignmentId: 'assign-math-10',
        title: 'Diagnostic Test',
        gradeLevel: '10',
        learningArea: 'Mathematics',
        totalItems: 10,
        keyMap: { 1: 'A', 2: 'B' },
      })

      expect(blueprint.assignmentId).toBe('assign-math-10')
      expect(blueprint.items[0].competencySnapshot.code).toBeNull()
      expect(blueprint.items[0].competencySnapshot.text).toBe('Unmapped External Assessment Item')
      expect(blueprint.items[0].cognitiveCategorySnapshot.shortLabel).toBe('Uncat')
    })
  })
})
