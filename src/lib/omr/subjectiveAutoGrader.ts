import { supabase } from '../supabase'
import type { OmrImageBuffer } from '../../types/omr'
import type { ResultAssessmentItemSnapshot } from '../../types/results'
import { cropWritingArea, type CropRectangle } from './handwritingTranscription'

export type SubjectiveGradingRequest = {
  teacherConsent?: boolean
  cropBase64?: string
  studentText?: string
  item: ResultAssessmentItemSnapshot
  learningArea?: string
  gradeLevel?: string
}

export type SubjectiveGradingResult = {
  success: boolean
  transcript: string
  suggestedPoints: number
  feedback: string
  confidence: number
  error?: string
}

/**
 * Extracts expected answer / scoring criteria / rubric key points from the item snapshot.
 */
export function formatExpectedAnswerSummary(item: ResultAssessmentItemSnapshot): string {
  const answer = item.answer
  if (!answer) return ''

  if (answer.type === 'essay') {
    const points = answer.keyPoints?.length ? `Key Points: ${answer.keyPoints.join('; ')}` : ''
    const notes = answer.scoringNotes ? `Scoring Notes: ${answer.scoringNotes}` : ''
    return [points, notes].filter(Boolean).join('\n')
  }

  if (answer.type === 'problem_solving') {
    const finalAns = answer.finalAnswer ? `Final Answer: ${answer.finalAnswer}` : ''
    const outline = answer.solutionOutline ? `Solution Steps: ${answer.solutionOutline}` : ''
    return [finalAns, outline].filter(Boolean).join('\n')
  }

  if (answer.type === 'constructed_response') {
    const expected = answer.expectedResponse ? `Expected Response: ${answer.expectedResponse}` : ''
    const sample = answer.sampleResponse ? `Sample Response: ${answer.sampleResponse}` : ''
    return [expected, sample].filter(Boolean).join('\n')
  }

  if (answer.type === 'short_answer' || answer.type === 'identification') {
    return answer.acceptedAnswers?.length ? `Accepted Answers: ${answer.acceptedAnswers.join(', ')}` : ''
  }

  return ''
}

/**
 * Crops a subjective item's response area from the rectified OMR image buffer.
 */
export function cropItemWritingArea(
  image: OmrImageBuffer,
  pageDims: { widthMm: number; heightMm: number },
  boundsMm: { xMm: number; yMm: number; widthMm: number; heightMm: number },
): string {
  const box: CropRectangle = {
    x: (boundsMm.xMm / pageDims.widthMm) * image.width,
    y: (boundsMm.yMm / pageDims.heightMm) * image.height,
    width: (boundsMm.widthMm / pageDims.widthMm) * image.width,
    height: (boundsMm.heightMm / pageDims.heightMm) * image.height,
  }
  return cropWritingArea(image, box)
}

/**
 * Calls the Gemini BYOK handwriting AI auto-grader for subjective questions.
 * Teacher consent is required before calling this service.
 * In accordance with DepEd Teacher Primacy guidelines (DepEd Order No. 015, s. 2026),
 * returned scores are drafts and must be reviewed/confirmed by the teacher.
 */
export async function gradeSubjectiveResponse(
  req: SubjectiveGradingRequest,
): Promise<SubjectiveGradingResult> {
  const pointsPossible = Number(req.item.pointsPossible ?? req.item.points ?? 1)

  if (!req.cropBase64 && !req.studentText) {
    return {
      success: false,
      transcript: '',
      suggestedPoints: 0,
      feedback: 'No student response image or text provided.',
      confidence: 0,
      error: 'Missing student response.',
    }
  }

  if (req.teacherConsent !== true) return { success: false, transcript: '', suggestedPoints: 0, feedback: '', confidence: 0, error: 'Teacher consent is required before AI grading.' }

  if (!supabase) {
    return {
      success: false,
      transcript: '',
      suggestedPoints: 0,
      feedback: '',
      confidence: 0,
      error: 'Supabase client unavailable. AI grading is offline.',
    }
  }

  try {
    const expectedSummary = formatExpectedAnswerSummary(req.item)

    const { data, error } = await supabase.functions.invoke('handwriting-transcriber', {
      body: {
        mode: 'grade',
        teacherConsent: true,
        imageBase64: req.cropBase64,
        promptHint: req.item.prompt,
        questionType: req.item.questionType,
        pointsPossible,
        expectedAnswer: expectedSummary,
        learningArea: req.learningArea,
        gradeLevel: req.gradeLevel,
      },
    })

    if (error) {
      return {
        success: false,
        transcript: '',
        suggestedPoints: 0,
        feedback: '',
        confidence: 0,
        error: error.message || 'AI Auto-grader service error.',
      }
    }

    if (data && data.success) {
      const rawPoints = typeof data.suggestedPoints === 'number' ? data.suggestedPoints : 0
      const clampedPoints = Math.max(0, Math.min(pointsPossible, rawPoints))
      return {
        success: true,
        transcript: typeof data.transcript === 'string' ? data.transcript : '',
        suggestedPoints: clampedPoints,
        feedback: typeof data.feedback === 'string' ? data.feedback : '',
        confidence: typeof data.confidence === 'number' ? data.confidence : 0.85,
      }
    }

    return {
      success: false,
      transcript: '',
      suggestedPoints: 0,
      feedback: '',
      confidence: 0,
      error: data?.message || 'Unable to evaluate subjective response.',
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'AI Auto-grader request failed.'
    return {
      success: false,
      transcript: '',
      suggestedPoints: 0,
      feedback: '',
      confidence: 0,
      error: message,
    }
  }
}
