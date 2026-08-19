import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { TeachingApproachPicker } from '../../src/components/TeachingApproachPicker'
import { APPROACH_OPTIONS } from '../../src/types/teachingSetup'

describe('Phase 3 — Teaching Approaches', () => {
  it('renders canonical APPROACH_OPTIONS chips', () => {
    const html = renderToStaticMarkup(
      <TeachingApproachPicker
        value={['Direct instruction']}
        onChange={() => {}}
      />,
    )

    APPROACH_OPTIONS.forEach((option) => {
      expect(html).toContain(option)
    })
    expect(html).toContain('aria-pressed="true"')
  })

  it('preserves historical custom approaches alongside canonical options', () => {
    const historical = ['Direct instruction', 'Station Rotation', 'Contextualized Teaching']
    const html = renderToStaticMarkup(
      <TeachingApproachPicker
        value={historical}
        onChange={() => {}}
      />,
    )

    expect(html).toContain('Station Rotation')
    expect(html).toContain('Contextualized Teaching')
    expect(html).toContain('custom-approach-remove')
  })

  it('renders input for adding custom approaches with spaces', () => {
    const html = renderToStaticMarkup(
      <TeachingApproachPicker
        value={[]}
        onChange={() => {}}
      />,
    )

    expect(html).toContain('custom-approach-input')
    expect(html).toContain('placeholder="Add custom approach (e.g., Station Rotation, Flipped Classroom)"')
    expect(html).toContain('Add')
  })
})
