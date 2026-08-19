import { describe, expect, it } from 'vitest'
import {
  detectMetaLanguage,
  sanitizeFieldProse,
  sanitizeLessonTitle,
} from '../../src/lib/lessonPlanValidation'

describe('Lesson AI Quality Guard & Sanitization', () => {
  describe('detectMetaLanguage', () => {
    it('detects meta prefixes like Optional, Suggested, Consider, You may, Teacher may', () => {
      expect(detectMetaLanguage('Optional Starting Point: Solving Equations')).toBe(true)
      expect(detectMetaLanguage('Suggested Lesson Flow: Step 1 Introduction')).toBe(true)
      expect(detectMetaLanguage('Optional: Conduct a quick review')).toBe(true)
      expect(detectMetaLanguage('Consider using concrete manipulatives for counting')).toBe(true)
      expect(detectMetaLanguage('You may provide graphic organizers for learners')).toBe(true)
      expect(detectMetaLanguage('Teacher may conduct a 5-minute pre-test')).toBe(true)
      expect(detectMetaLanguage('Possible extension activity: research on plant cells')).toBe(true)
      expect(detectMetaLanguage('An optional home-based reflection task')).toBe(true)
    })

    it('returns false for direct classroom instructional prose', () => {
      expect(detectMetaLanguage('Conduct a 5-minute review on prior concepts.')).toBe(false)
      expect(detectMetaLanguage('Learners demonstrate mastery through accurate problem solving.')).toBe(false)
      expect(detectMetaLanguage('Solving Linear Equations in Two Variables')).toBe(false)
      expect(detectMetaLanguage('Use visual diagrams and worked examples.')).toBe(false)
    })
  })

  describe('sanitizeLessonTitle', () => {
    it('strips meta-prefixes from lesson titles', () => {
      expect(
        sanitizeLessonTitle('Optional Starting Point: Solving Volume of Cylinders'),
      ).toBe('Solving Volume of Cylinders')

      expect(
        sanitizeLessonTitle('Suggested Lesson: Introduction to Ecosystems'),
      ).toBe('Introduction to Ecosystems')

      expect(
        sanitizeLessonTitle('Optional: Philippine Biodiversity'),
      ).toBe('Philippine Biodiversity')

      expect(
        sanitizeLessonTitle('An optional lesson on Photosynthesis'),
      ).toBe('Lesson on Photosynthesis')
    })

    it('preserves already clean titles', () => {
      expect(
        sanitizeLessonTitle('Operations on Fractions and Decimals'),
      ).toBe('Operations on Fractions and Decimals')
    })
  })

  describe('sanitizeFieldProse', () => {
    it('strips meta prefixes and converts "Consider using" to direct "Use" imperative', () => {
      expect(
        sanitizeFieldProse('Optional Session Flow: 1. Introduction. 2. Guided practice.'),
      ).toBe('1. Introduction. 2. Guided practice.')

      expect(
        sanitizeFieldProse('Suggested Assessment Checks: Ask 3 conceptual questions.'),
      ).toBe('Ask 3 conceptual questions.')

      expect(
        sanitizeFieldProse('Consider using visual diagrams for learners needing support.'),
      ).toBe('Use visual diagrams for learners needing support.')

      expect(
        sanitizeFieldProse('You may provide worked examples on the board.'),
      ).toBe('Provide worked examples on the board.')

      expect(
        sanitizeFieldProse('Teacher may conduct an opening diagnostic check.'),
      ).toBe('Conduct an opening diagnostic check.')

      expect(
        sanitizeFieldProse('Optional: Give learners 10 minutes for pair discussion.'),
      ).toBe('Give learners 10 minutes for pair discussion.')
    })

    it('preserves direct instructional statements unchanged', () => {
      const directProse = 'Provide guided practice where learners collaboratively analyze geometric proofs.'
      expect(sanitizeFieldProse(directProse)).toBe(directProse)
    })
  })
})
