import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import { HelpTooltip } from '../../src/components/ui/HelpTooltip'

const readSource = (relativePath: string) =>
  readFileSync(new URL(`../../${relativePath}`, import.meta.url), 'utf8')

describe('Lesson Plan Details Help Affordance & HelpTooltip', () => {
  const sampleHelpText =
    'These lesson details are used in the heading of the generated lesson document. Optional details left blank will be omitted from the generated heading. Required fields must still be completed.'

  it('renders a real button with accessible aria attributes and role="tooltip" target', () => {
    const html = renderToStaticMarkup(
      <HelpTooltip
        label="About lesson details heading"
        content={sampleHelpText}
      />,
    )

    // Must be a real button, not a decorative span
    expect(html).toContain('<button')
    expect(html).toContain('type="button"')
    expect(html).toContain('class="help-tooltip-trigger "')
    expect(html).toContain('aria-label="About lesson details heading"')
    expect(html).toContain('aria-expanded="false"')
    expect(html).toContain('aria-describedby="help-tooltip-')

    // Tooltip bubble markup
    expect(html).toContain('role="tooltip"')
    expect(html).toContain('aria-hidden="true"')
    expect(html).toContain('class="help-tooltip-bubble "')
    expect(html).toContain(sampleHelpText)
  })

  it('provides compact help affordance in LessonPlanEditorPage for Advanced "01 Lesson details"', () => {
    const editorSource = readSource('src/pages/LessonPlanEditorPage.tsx')

    expect(editorSource).toContain('<HelpTooltip')
    expect(editorSource).toContain('LESSON_DETAILS_HELP_TEXT')
    expect(editorSource).toContain('About lesson details heading')
    expect(editorSource).toContain('editor-eyebrow-row')
    expect(editorSource).toContain('These lesson details are used in the heading of the generated lesson document.')
    expect(editorSource).toContain('Optional details left blank will be omitted from the generated heading.')
    expect(editorSource).toContain('Required fields must still be completed.')
  })

  it('provides consistent help affordance in LessonPlanEditorPage for Simple "Class and lesson setup"', () => {
    const editorSource = readSource('src/pages/LessonPlanEditorPage.tsx')

    expect(editorSource).toContain('workflow-step-title-with-help')
    expect(editorSource).toContain('About class and lesson setup heading')
  })

  it('ensures CSS rules prevent horizontal overflow across 360px, 390px, and 412px mobile viewports', () => {
    const styles = readSource('src/styles.css')
    const workflows = readSource('src/workflows.css')

    // Tooltip bubble styles
    expect(styles).toContain('.help-tooltip-bubble')
    expect(styles).toContain('max-width: min(300px, calc(100vw - 32px))')
    expect(styles).toContain('@media (max-width: 600px)')
    expect(styles).toContain('@media (max-width: 420px)')
    expect(styles).toContain('max-width: min(230px, calc(100vw - 32px))')

    // Trigger hit area and focus states
    expect(styles).toContain('.help-tooltip-trigger::after')
    expect(styles).toContain('.help-tooltip-trigger:focus-visible')

    // Header layout wrappers
    expect(styles).toContain('.editor-eyebrow-row')
    expect(workflows).toContain('.workflow-step-title-with-help')
  })

  it('supports alignment classes and custom icon sizing', () => {
    const rightHtml = renderToStaticMarkup(
      <HelpTooltip
        align="right"
        iconSize={16}
        content="Right aligned help"
      />,
    )
    expect(rightHtml).toContain('align-right')

    const centerHtml = renderToStaticMarkup(
      <HelpTooltip
        align="center"
        content="Center aligned help"
      />,
    )
    expect(centerHtml).toContain('align-center')
  })
})
