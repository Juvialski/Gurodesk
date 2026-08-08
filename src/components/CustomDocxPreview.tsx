import { useEffect, useRef } from 'react'
import { renderDocxBlob } from '../lib/customTemplateRender'

export function CustomDocxPreview({ blob, onReady, onError }: {
  blob: Blob
  onReady?: (container: HTMLElement) => void
  onError?: (message: string) => void
}) {
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const element = ref.current
    if (!element) return
    let active = true
    void renderDocxBlob(blob, element)
      .then(() => { if (active) onReady?.(element) })
      .catch((error) => { if (active) onError?.(error instanceof Error ? error.message : 'Unable to render custom DOCX preview.') })
    return () => { active = false }
  }, [blob])

  return <div ref={ref} className="custom-docx-preview" />
}
