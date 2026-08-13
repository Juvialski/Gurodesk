import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const readSource = (relativePath: string) =>
  readFileSync(new URL(`../../${relativePath}`, import.meta.url), 'utf8')

describe('shared workflow stylesheet contract', () => {
  it('keeps the shared guided-workflow selectors that multiple pages depend on', () => {
    const styles = readSource('src/workflows.css')

    for (const selector of [
      'workflow-simple-shell',
      'workflow-step-card',
      'workflow-step-heading',
      'workflow-chip',
      'workflow-picker-trigger',
      'workflow-picker-panel',
      'workflow-competency-option',
      'workflow-actions',
    ]) {
      expect(styles, `missing .${selector}`).toMatch(
        new RegExp(String.raw`\.${selector}(?=[\s,{.:>])`),
      )
    }
  })

  it('keeps the curriculum-aware TOS grouping rules merged with the shared rules', () => {
    const styles = readSource('src/workflows.css')

    for (const selector of [
      'workflow-curriculum-group',
      'workflow-curriculum-group-header',
      'workflow-curriculum-standards',
      'workflow-curriculum-competencies',
      'competency-picker-group',
    ]) {
      expect(styles, `missing .${selector}`).toMatch(
        new RegExp(String.raw`\.${selector}(?=[\s,{.:>])`),
      )
    }

    expect(styles.indexOf('.workflow-simple-shell')).toBeLessThan(
      styles.indexOf('.workflow-curriculum-group'),
    )
  })

  it('keeps shared mobile and accessibility safeguards', () => {
    const styles = readSource('src/workflows.css')
    expect(styles).toContain('@media (max-width: 900px)')
    expect(styles).toContain('@media (max-width: 620px)')
    expect(styles).toContain('@media (prefers-reduced-motion: reduce)')
  })

  it('keeps the topic-first and multi-alignment workflow controls styled', () => {
    const styles = readSource('src/workflows.css')
    for (const selector of [
      'workflow-topic-field',
      'workflow-topic-suggestions',
      'workflow-selected-alignments',
      'workflow-selected-alignment',
      'workflow-primary-badge',
      'workflow-alignment-actions',
      'workflow-alignment-mode',
    ]) {
      expect(styles, `missing .${selector}`).toMatch(
        new RegExp(String.raw`\.${selector}(?=[\s,{.:>])`),
      )
    }
  })

  it.each([
    ['src/pages/LessonPlanEditorPage.tsx', 'workflow-simple-shell'],
    ['src/pages/TosEditorPage.tsx', 'workflow-curriculum-group'],
    ['src/pages/ClassesPage.tsx', 'workflow-chip-row'],
    ['src/pages/CurriculumPage.tsx', 'workflow-view-tabs'],
    ['src/pages/OnboardingPage.tsx', 'workflow-onboarding-choice'],
    ['src/pages/ResultsPage.tsx', 'workflow-results-setup'],
    ['src/pages/SettingsPage.tsx', 'settings-workflow-layout'],
  ])('%s imports and uses the shared workflow stylesheet', (path, className) => {
    const source = readSource(path)
    expect(source).toMatch(/import\s+['"]\.\.\/workflows\.css['"]/)
    expect(source).toContain(className)
  })
})
