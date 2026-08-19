import { ArrowLeft, Download, Printer, Scissors } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useApp } from '../contexts/AppContext'
import { generateAnswerSheetLayout } from '../lib/answerSheet/layoutEngine'
import { renderAnswerSheetPageSvg } from '../lib/answerSheet/printRenderer'
import { downloadAnswerSheetDocx, resolveSlipsPerPage } from '../lib/answerSheet/answerSheetDocxExport'
import { loadAssessmentDocument } from '../lib/assessmentRepository'
import { loadClassLearners } from '../lib/resultsRepository'
import type { AssessmentRecord } from '../types/assessment'
import type { AnswerSheetDefinition, AnswerSheetDensity, AnswerSheetMode, AnswerSheetPaperSize } from '../types/answerSheet'
import type { ClassLearner } from '../types/results'

export function AnswerSheetPrintPage() {
  const { id = '' } = useParams()
  const [searchParams] = useSearchParams()
  const { user, isDemo } = useApp()

  const [assessment, setAssessment] = useState<AssessmentRecord | null>(null)
  const [learners, setLearners] = useState<ClassLearner[]>([])
  const [loading, setLoading] = useState(true)
  const [downloadingDocx, setDownloadingDocx] = useState(false)
  const [error, setError] = useState('')

  const mode = (searchParams.get('mode') ?? 'generic') as AnswerSheetMode
  const paperSize = (searchParams.get('paperSize') ?? 'a4') as AnswerSheetPaperSize
  const [density, setDensity] = useState<AnswerSheetDensity>(
    (searchParams.get('density') as AnswerSheetDensity) || 'auto',
  )
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

  const slipsPerPage = useMemo(() => {
    return resolveSlipsPerPage(assessment?.items?.length || 0, density)
  }, [assessment?.items?.length, density])

  const sheets: AnswerSheetDefinition[] = useMemo(() => {
    if (!assessment) return []
    if (mode === 'personalized') {
      return selectedLearners.map((learner) =>
        generateAnswerSheetLayout(assessment, {
          mode: 'personalized',
          paperSize,
          density,
          slipsPerPage,
          learner,
        }),
      )
    }

    // Generic mode: generate requested number of identical sheets
    const single = generateAnswerSheetLayout(assessment, {
      mode: 'generic',
      paperSize,
      density,
      slipsPerPage,
    })
    return Array.from({ length: copies }, () => single)
  }, [assessment, mode, paperSize, density, slipsPerPage, selectedLearners, copies])

  const paginatedSlipGroups = useMemo(() => {
    const groups: AnswerSheetDefinition[][] = []
    for (let i = 0; i < sheets.length; i += slipsPerPage) {
      groups.push(sheets.slice(i, i + slipsPerPage))
    }
    return groups
  }, [sheets, slipsPerPage])

  const totalPages = paginatedSlipGroups.length

  function handlePrint() {
    window.print()
  }

  async function handleDownloadDocx() {
    if (!assessment) return
    setDownloadingDocx(true)
    try {
      await downloadAnswerSheetDocx(assessment, {
        mode,
        paperSize,
        density,
        copies,
        learners: selectedLearners,
        sectionName,
      })
    } catch (err) {
      console.error('Failed to download Word answer sheet:', err)
    } finally {
      setDownloadingDocx(false)
    }
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
          .sheet-page-wrapper {
            margin: 0 !important;
            box-shadow: none !important;
            page-break-after: always !important;
            break-after: page !important;
            width: 100% !important;
            max-width: none !important;
          }
        }
      `}</style>

      {/* Top Toolbar (No-Print) */}
      <div className="print-preview-toolbar no-print">
        <Link className="button ghost" to={`/assessments/${assessment.id}`}>
          <ArrowLeft size={16} /> Back to Editor
        </Link>

        <div className="print-preview-title">
          <strong>Smart Answer Sheet Print &amp; Export</strong>
          <small>
            {mode === 'personalized'
              ? `${sheets.length} Student Sheets · Section ${sectionName || 'All'}`
              : `${copies} Generic Sheet${copies > 1 ? 's' : ''}`}{' '}
            · {slipsPerPage}-Up ({totalPages} Page{totalPages > 1 ? 's' : ''}) · {paperSize.toUpperCase()}
          </small>
        </div>

        <div className="assessment-preview-actions">
          <div className="inline-density-picker flex items-center gap-2">
            <select
              className="select-input text-xs"
              value={density}
              onChange={(e) => setDensity(e.target.value as AnswerSheetDensity)}
              title="Sheets per Page"
            >
              <option value="auto">Auto ({slipsPerPage}-Up)</option>
              <option value="1-up">1-Up (Full Page)</option>
              <option value="2-up">2-Up (Half Sheet)</option>
              <option value="3-up">3-Up (1/3 Sheet)</option>
              <option value="4-up">4-Up (Quarter Sheet)</option>
            </select>
          </div>
          <button
            className="button secondary"
            type="button"
            disabled={downloadingDocx}
            onClick={() => void handleDownloadDocx()}
          >
            <Download size={16} /> {downloadingDocx ? 'Building Word…' : 'Download Word (.docx)'}
          </button>
          <button className="button primary" type="button" onClick={handlePrint}>
            <Printer size={16} /> Print {totalPages} Page{totalPages > 1 ? 's' : ''}
          </button>
        </div>
      </div>

      {/* Printable Stage */}
      <div className="print-preview-stage answer-sheet-print-stage">
        {paginatedSlipGroups.map((group, gIdx) => (
          <div
            key={`page-group-${gIdx}`}
            className="sheet-page-wrapper"
            style={{
              background: '#ffffff',
              margin: '20px auto',
              maxWidth: '850px',
              padding: '0',
              boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
              borderRadius: '4px',
              overflow: 'hidden',
            }}
          >
            {group.map((sheet, sIdx) => {
              const page = sheet.pages[0]
              if (!page) return null
              const svgContent = renderAnswerSheetPageSvg(sheet, page)
              const isLastInGroup = sIdx === group.length - 1

              return (
                <div key={`sheet-${gIdx}-${sIdx}`} className="sheet-slip-item" style={{ width: '100%' }}>
                  <div
                    className="sheet-svg-wrap"
                    style={{
                      width: '100%',
                      display: 'flex',
                      justifyContent: 'center',
                    }}
                    dangerouslySetInnerHTML={{ __html: svgContent }}
                  />
                  {!isLastInGroup && (
                    <div className="sheet-cut-divider">
                      <Scissors size={13} />
                      <span>Cut along dashed line</span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
