import { ArrowLeft, Printer } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useApp } from '../contexts/AppContext'
import { generateAnswerSheetLayout } from '../lib/answerSheet/layoutEngine'
import { renderAnswerSheetPageSvg } from '../lib/answerSheet/printRenderer'
import { loadAssessmentDocument } from '../lib/assessmentRepository'
import { loadClassLearners } from '../lib/resultsRepository'
import type { AssessmentRecord } from '../types/assessment'
import type { AnswerSheetDefinition, AnswerSheetMode, AnswerSheetPaperSize } from '../types/answerSheet'
import type { ClassLearner } from '../types/results'

export function AnswerSheetPrintPage() {
  const { id = '' } = useParams()
  const [searchParams] = useSearchParams()
  const { user, isDemo } = useApp()

  const [assessment, setAssessment] = useState<AssessmentRecord | null>(null)
  const [learners, setLearners] = useState<ClassLearner[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const mode = (searchParams.get('mode') ?? 'generic') as AnswerSheetMode
  const paperSize = (searchParams.get('paperSize') ?? 'a4') as AnswerSheetPaperSize
  const sectionName = searchParams.get('section') ?? ''
  const learnerIdsParam = searchParams.get('learners') ?? ''
  const copiesParam = Number(searchParams.get('copies') ?? 1)
  const copies = Number.isSafeInteger(copiesParam) && copiesParam > 0 ? copiesParam : 1

  useEffect(() => {
    if (!user || !id) return
    let active = true
    setLoading(true)

    loadAssessmentDocument(id, user.id, isDemo)
      .then(async (doc) => {
        if (!active) return
        if (!doc) throw new Error('Assessment not found.')
        setAssessment(doc)

        if (mode === 'personalized' && doc.assignmentId) {
          const roster = await loadClassLearners(user.id, doc.assignmentId, sectionName, isDemo)
          if (!active) return
          setLearners(roster)
        }
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : 'Unable to load answer sheet.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [id, user?.id, isDemo, mode, sectionName])

  const selectedLearners = useMemo(() => {
    if (mode !== 'personalized') return []
    const requestedIds = learnerIdsParam ? new Set(learnerIdsParam.split(',')) : null
    if (!requestedIds) return learners.filter((l) => l.status === 'active')
    return learners.filter((l) => requestedIds.has(l.id))
  }, [mode, learners, learnerIdsParam])

  const sheets: AnswerSheetDefinition[] = useMemo(() => {
    if (!assessment) return []
    if (mode === 'personalized') {
      return selectedLearners.map((learner) =>
        generateAnswerSheetLayout(assessment, {
          mode: 'personalized',
          paperSize,
          learner,
        }),
      )
    }

    // Generic mode: generate requested number of identical sheets
    const single = generateAnswerSheetLayout(assessment, {
      mode: 'generic',
      paperSize,
    })
    return Array.from({ length: copies }, () => single)
  }, [assessment, mode, paperSize, selectedLearners, copies])

  function handlePrint() {
    window.print()
  }

  if (loading) {
    return (
      <div className="loading-screen">
        <span className="loader" />
        <strong>Preparing Smart Answer Sheets…</strong>
      </div>
    )
  }

  if (error || !assessment) {
    return (
      <div className="export-preview-error">
        <h2>Smart Answer Sheet Unavailable</h2>
        <p>{error || 'Assessment not found.'}</p>
        <Link className="button ghost" to={`/assessments/${id}`}>
          <ArrowLeft size={16} /> Back to assessment
        </Link>
      </div>
    )
  }

  return (
    <div className="answer-sheet-print-page">
      <style>{`
        @page {
          size: ${paperSize};
          margin: 0;
        }
        @media print {
          html, body {
            background: transparent !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .no-print {
            display: none !important;
          }
          .sheet-container {
            margin: 0 !important;
            box-shadow: none !important;
            page-break-after: always !important;
            break-after: page !important;
          }
        }
      `}</style>

      {/* Top Toolbar (No-Print) */}
      <div className="print-preview-toolbar no-print">
        <Link className="button ghost" to={`/assessments/${assessment.id}`}>
          <ArrowLeft size={16} /> Back to Editor
        </Link>

        <div className="print-preview-title">
          <strong>Smart Answer Sheet Print View</strong>
          <small>
            {mode === 'personalized'
              ? `${sheets.length} Personalized Student Sheets · Section ${sectionName || 'All'}`
              : `${copies} Generic Sheet${copies > 1 ? 's' : ''}`}{' '}
            · {paperSize.toUpperCase()}
          </small>
        </div>

        <div className="assessment-preview-actions">
          <button className="button primary" type="button" onClick={handlePrint}>
            <Printer size={16} /> Print {sheets.length} Sheet{sheets.length > 1 ? 's' : ''}
          </button>
        </div>
      </div>

      {/* Printable Stage */}
      <div className="print-preview-stage answer-sheet-print-stage">
        {sheets.map((sheet, sIdx) =>
          sheet.pages.map((page, pIdx) => {
            const svgContent = renderAnswerSheetPageSvg(sheet, page)
            return (
              <div
                key={`sheet-${sIdx}-page-${pIdx}`}
                className="sheet-container"
                style={{
                  background: '#ffffff',
                  margin: '16px auto',
                  maxWidth: '850px',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
                }}
                dangerouslySetInnerHTML={{ __html: svgContent }}
              />
            )
          }),
        )}
      </div>
    </div>
  )
}
