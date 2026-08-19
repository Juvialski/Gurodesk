import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const readSource = (relativePath: string) =>
  readFileSync(new URL(`../../${relativePath}`, import.meta.url), 'utf8')

describe('UI layout and grid consistency contracts', () => {
  it('defines responsive column variants for workspace context picker grid and bounds desktop popover', () => {
    const styles = readSource('src/styles.css')
    expect(styles).toContain('.workspace-picker-grid')
    expect(styles).toContain('.workspace-picker-grid.cols-2')
    expect(styles).toContain('.workspace-picker-grid.cols-3')
    expect(styles).toContain('.workspace-picker-grid.cols-4')
    expect(styles).toMatch(/\.workspace-context-picker\s*\{[^}]*max-width:\s*760px/)
  })

  it('computes dynamic column count in WorkspaceContextPicker component', () => {
    const pickerSource = readSource('src/components/workspace/WorkspaceContextPicker.tsx')
    expect(pickerSource).toContain('visibleControlCount')
    expect(pickerSource).toContain('workspace-picker-grid cols-${visibleControlCount}')
  })

  it('resets margin-top on .ai-field when placed inside form grids to keep sibling baselines aligned', () => {
    const styles = readSource('src/styles.css')
    expect(styles).toMatch(/\.form-grid\s*>\s*\.ai-field/)
    expect(styles).toMatch(/\.workflow-form-grid\s*>\s*\.ai-field/)
  })

  it('defines explicit single, two, three, and four column form grid classes with span utilities', () => {
    const styles = readSource('src/styles.css')
    expect(styles).toContain('.form-grid.one')
    expect(styles).toContain('.form-grid.two')
    expect(styles).toContain('.form-grid.three')
    expect(styles).toContain('.form-grid.four')
    expect(styles).toContain('.span-two')
    expect(styles).toContain('.span-three')
    expect(styles).toContain('.span-full')
  })

  it('uses single-column form grid for one-field containers in Lesson Plan and TOS editors', () => {
    const lessonPlanSource = readSource('src/pages/LessonPlanEditorPage.tsx')
    expect(lessonPlanSource).not.toMatch(/<div className="form-grid two">\s*<label[^>]*>\s*<span>Lesson title<\/span>/)
    expect(lessonPlanSource).toMatch(/<div className="form-grid one">\s*<label[^>]*>\s*<span>Lesson title<\/span>/)

    const tosSource = readSource('src/pages/TosEditorPage.tsx')
    expect(tosSource).toMatch(/<div className="workflow-form-grid one">\s*<label>\s*<span>Number of questions<\/span>/)
  })

  it('bounds curriculum catalog search width and prevents unconstrained stretch', () => {
    const styles = readSource('src/styles.css')
    expect(styles).toContain('.catalog-search')
    expect(styles).toMatch(/\.catalog-search\s*\{[^}]*max-width:\s*280px/)
  })

  it('eliminates nested scroll traps on curriculum catalog entry grid', () => {
    const styles = readSource('src/styles.css')
    expect(styles).toMatch(/\.catalog-entry-grid\s*\{[^}]*max-height:\s*none/)
    expect(styles).toMatch(/\.catalog-entry-grid\s*\{[^}]*overflow:\s*visible/)
  })

  it('defines compact card empty state for custom curriculum panel', () => {
    const styles = readSource('src/styles.css')
    expect(styles).toContain('.custom-curriculum-panel .mini-empty')
    expect(styles).toMatch(/\.custom-curriculum-panel\s*\{[^}]*padding:\s*18px\s+20px/)
  })

  it('enforces inline horizontal flex layout on all search bar primitives', () => {
    const styles = readSource('src/styles.css')
    expect(styles).toMatch(/\.curriculum-search,\s*\.catalog-search,\s*\.workflow-search/)
    expect(styles).toContain('flex-direction: row !important')

    const workflows = readSource('src/workflows.css')
    expect(workflows).toContain('.workflow-search')
    expect(workflows).toContain('flex-direction: row')

    const tos = readSource('src/tos.css')
    expect(tos).toContain('.tos-picker-search')
    expect(tos).toContain('flex-direction: row !important')
  })

  it('styles curriculum assignment select as inline flex row in header actions', () => {
    const styles = readSource('src/styles.css')
    expect(styles).toMatch(/\.curriculum-assignment-select\s*\{[^}]*flex-direction:\s*row\s*!important/)
  })

  it('uses div elements for search containers in catalog, curriculum, lesson, and tos editors', () => {
    const catalogBrowser = readSource('src/components/CurriculumCatalogBrowser.tsx')
    expect(catalogBrowser).toContain('<div className="curriculum-search catalog-search">')

    const curriculumPage = readSource('src/pages/CurriculumPage.tsx')
    expect(curriculumPage).toContain('<div className="curriculum-search">')

    const lessonPage = readSource('src/pages/LessonPlanEditorPage.tsx')
    expect(lessonPage).toContain('<div className="workflow-search">')

    const tosPage = readSource('src/pages/TosEditorPage.tsx')
    expect(tosPage).toContain('<div className="workflow-search">')
    expect(tosPage).toContain('<div className="tos-picker-search">')
  })

  it('keeps optional and required text beside field labels inline rather than vertically stacked', () => {
    const styles = readSource('src/styles.css')
    expect(styles).toMatch(/label\s*>\s*span:first-child/)
    expect(styles).toContain('.field-optional')
    expect(styles).toMatch(/\.field-optional\s*\{[^}]*display:\s*inline/)

    const picker = readSource('src/components/workspace/WorkspaceContextPicker.tsx')
    expect(picker).toContain('<span>Section <span className="field-optional">(optional)</span></span>')
    expect(picker).toContain('<span>Grading term <span className="field-optional">(optional)</span></span>')
    expect(picker).toContain('<span>Curriculum period <span className="field-optional">(optional)</span></span>')

    const tos = readSource('src/pages/TosEditorPage.tsx')
    expect(tos).toContain('<span>TOS title <small className="workflow-required">(required)</small></span>')
    expect(tos).toContain('<span>Assessment title <small className="field-optional">(optional)</small></span>')
    expect(tos).toContain('<span>Item override <small className="field-optional">(optional)</small></span>')
  })
})
