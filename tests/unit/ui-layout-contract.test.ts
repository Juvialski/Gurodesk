import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const readSource = (relativePath: string) =>
  readFileSync(new URL(`../../${relativePath}`, import.meta.url), 'utf8')

describe('UI layout and grid consistency contracts', () => {
  it('defines responsive column variants for workspace context picker grid', () => {
    const styles = readSource('src/styles.css')
    expect(styles).toContain('.workspace-picker-grid')
    expect(styles).toContain('.workspace-picker-grid.cols-2')
    expect(styles).toContain('.workspace-picker-grid.cols-3')
    expect(styles).toContain('.workspace-picker-grid.cols-4')
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
    expect(tosSource).toMatch(/<div className="workflow-form-grid one">\s*<label>Number of questions/)
  })

  it('bounds curriculum catalog search width and prevents unconstrained stretch', () => {
    const styles = readSource('src/styles.css')
    expect(styles).toContain('.catalog-search')
    expect(styles).toMatch(/\.catalog-search\s*\{[^}]*max-width:\s*380px/)
  })

  it('eliminates nested scroll traps on curriculum catalog entry grid', () => {
    const styles = readSource('src/styles.css')
    expect(styles).toMatch(/\.catalog-entry-grid\s*\{[^}]*max-height:\s*none/)
    expect(styles).toMatch(/\.catalog-entry-grid\s*\{[^}]*overflow:\s*visible/)
  })

  it('defines compact card empty state for custom curriculum panel', () => {
    const styles = readSource('src/styles.css')
    expect(styles).toContain('.custom-curriculum-panel .mini-empty')
  })
})
