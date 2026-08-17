import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const readSource = (relativePath: string) =>
  readFileSync(new URL(`../../${relativePath}`, import.meta.url), 'utf8')

describe('assessment creation workflow consistency', () => {
  it('ensures all 4 assessment modes render inside the unified wizard shell with 3-step steppers', () => {
    const pageSource = readSource('src/pages/AssessmentNewPage.tsx')

    // All 4 modes must have dedicated steppers
    expect(pageSource).toContain('aria-label="Assessment setup progress"')
    expect(pageSource).toContain('aria-label="Lesson quiz setup progress"')
    expect(pageSource).toContain('aria-label="Unit quiz setup progress"')
    expect(pageSource).toContain('aria-label="Performance task setup progress"')

    // Step definitions for each mode
    expect(pageSource).toContain("'Source TOS'")
    expect(pageSource).toContain("'Setup & Points'")
    expect(pageSource).toContain("'Formats & Generate'")

    expect(pageSource).toContain("'Source Lesson'")
    expect(pageSource).toContain("'Quiz Setup'")

    expect(pageSource).toContain("'Unit Lessons'")
    expect(pageSource).toContain("'Unit Setup'")

    expect(pageSource).toContain("'Curriculum Source'")
    expect(pageSource).toContain("'Task Scenario'")
    expect(pageSource).toContain("'Rubric & Timeline'")
  })

  it('uses rich source cards instead of plain dropdowns for lesson and TOS picking', () => {
    const pageSource = readSource('src/pages/AssessmentNewPage.tsx')

    expect(pageSource).toContain('assessment-v2-source-card')
    expect(pageSource).toContain('assessment-v2-source-list')
    expect(pageSource).toContain('assessment-v2-source-icon')
    expect(pageSource).toContain('assessment-v2-selected-pill')
  })

  it('provides consistent footer navigation across all 4 modes', () => {
    const pageSource = readSource('src/pages/AssessmentNewPage.tsx')

    expect(pageSource).toContain('assessment-v2-wizard-footer')
    expect(pageSource).toContain('assessment-v2-wizard-footer-actions')
    expect(pageSource).toContain('assessment-v2-generate-button')
  })

  it('maintains wizard and footer actions in the assessment stylesheet', () => {
    const cssSource = readSource('src/assessment.css')

    expect(cssSource).toContain('.assessment-v2-wizard-shell')
    expect(cssSource).toContain('.assessment-v2-stepper')
    expect(cssSource).toContain('.assessment-v2-step')
    expect(cssSource).toContain('.assessment-v2-wizard-card')
    expect(cssSource).toContain('.assessment-v2-wizard-footer')
    expect(cssSource).toContain('.assessment-v2-wizard-footer-actions')
    expect(cssSource).toContain('@media(max-width:720px)')
    expect(cssSource).toContain('@media(max-width:420px)')
  })
})
