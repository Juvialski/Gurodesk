import { useMemo, useState } from 'react'
import type { AnswerSheetDefinition } from '../../types/answerSheet'
import { renderAnswerSheetPageSvg } from '../../lib/answerSheet/printRenderer'
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from 'lucide-react'

export type AnswerSheetPreviewProps = {
  sheet: AnswerSheetDefinition
  className?: string
}

export function AnswerSheetPreview({ sheet, className = '' }: AnswerSheetPreviewProps) {
  const [currentPageIndex, setCurrentPageIndex] = useState(0)
  const [zoom, setZoom] = useState(100)

  const activePage = sheet.pages[currentPageIndex] || sheet.pages[0]

  const svgContent = useMemo(() => {
    if (!activePage) return ''
    return renderAnswerSheetPageSvg(sheet, activePage)
  }, [sheet, activePage])

  const totalPages = sheet.pages.length

  return (
    <div className={`answer-sheet-preview-container ${className}`}>
      <div className="answer-sheet-preview-controls no-print">
        <div className="preview-pagination">
          {totalPages > 1 && (
            <>
              <button
                type="button"
                className="button ghost small"
                disabled={currentPageIndex === 0}
                onClick={() => setCurrentPageIndex((prev) => Math.max(0, prev - 1))}
              >
                <ChevronLeft size={16} /> Prev
              </button>
              <span className="page-indicator">
                Page {currentPageIndex + 1} of {totalPages}
              </span>
              <button
                type="button"
                className="button ghost small"
                disabled={currentPageIndex >= totalPages - 1}
                onClick={() => setCurrentPageIndex((prev) => Math.min(totalPages - 1, prev + 1))}
              >
                Next <ChevronRight size={16} />
              </button>
            </>
          )}
        </div>

        <div className="preview-zoom-controls">
          <button
            type="button"
            className="button ghost small icon-only"
            title="Zoom Out"
            onClick={() => setZoom((prev) => Math.max(60, prev - 15))}
          >
            <ZoomOut size={16} />
          </button>
          <span className="zoom-label">{zoom}%</span>
          <button
            type="button"
            className="button ghost small icon-only"
            title="Zoom In"
            onClick={() => setZoom((prev) => Math.min(180, prev + 15))}
          >
            <ZoomIn size={16} />
          </button>
        </div>
      </div>

      <div className="answer-sheet-preview-stage">
        <div
          className="answer-sheet-svg-wrapper"
          style={{
            transform: `scale(${zoom / 100})`,
            transformOrigin: 'top center',
          }}
          dangerouslySetInnerHTML={{ __html: svgContent }}
        />
      </div>
    </div>
  )
}
