import { ArrowLeft, BarChart3, CircleAlert, Info, UsersRound } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { EmptyState } from '../components/EmptyState'
import { ResultMetric } from '../components/results/ResultMetric'
import { useApp } from '../contexts/AppContext'
import { loadResultSession } from '../lib/resultsRepository'
import { analyzeResultSession } from '../lib/itemAnalysis'
import { formatScore } from '../lib/resultsScoring'
import type { AssessmentResultSession } from '../types/results'
import type { ItemAnalysisAggregate, ItemAnalysisItem, LearnerAnalysisSummary } from '../types/itemAnalysis'

function percentage(value: number | null | undefined) {
  return value === null || value === undefined || !Number.isFinite(value) ? '—' : `${Math.round(value * 10000) / 100}%`
}

function aggregateLabel(item: ItemAnalysisAggregate) {
  return item.competencyText || item.cognitiveCategoryLabel || item.key
}

function itemNumberLabel(item: Pick<ItemAnalysisItem, 'itemNumber' | 'pointStart' | 'pointEnd'>) {
  const start = Number(item.pointStart)
  const end = Number(item.pointEnd)
  if (Number.isSafeInteger(start) && start > 0 && Number.isSafeInteger(end) && end >= start) return start === end ? String(start) : `${start}–${end}`
  return String(item.itemNumber)
}

export function ResultAnalysisPage() {
  const { id = '' } = useParams()
  const { user, isDemo } = useApp()
  const [session, setSession] = useState<AssessmentResultSession | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<'class' | 'items' | 'competencies' | 'cognitive' | 'learners'>('class')
  const [selectedLearner, setSelectedLearner] = useState('')

  useEffect(() => {
    if (!user || !id) return
    let active = true
    setLoading(true)
    void loadResultSession(id, user.id, isDemo)
      .then((nextSession) => { if (active) { if (!nextSession) throw new Error('Result session not found or you do not have access to it.'); setSession(nextSession); setSelectedLearner(nextSession.learners[0]?.participantId ?? '') } })
      .catch((nextError) => { if (active) setError(nextError instanceof Error ? nextError.message : 'Unable to load analysis.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [id, isDemo, user?.id])

  const analysis = useMemo(() => session ? analyzeResultSession(session) : null, [session])
  const learner = analysis?.learners.find((item) => item.participantId === selectedLearner) ?? analysis?.learners[0]

  if (loading) return <div className="panel results-loading"><span className="loader" /><strong>Calculating deterministic analysis…</strong></div>
  if (!session || !analysis) return <div className="form-message error results-alert">{error || 'Analysis unavailable.'}</div>

  const summary = analysis.classSummary
  const facilityItems = analysis.items.filter((item) => item.facility !== null)
  const higherFacilityItems = [...facilityItems].sort((left, right) => (right.facility ?? -1) - (left.facility ?? -1) || left.itemNumber - right.itemNumber).slice(0, 3)
  const lowerFacilityItems = [...facilityItems].sort((left, right) => (left.facility ?? 2) - (right.facility ?? 2) || left.itemNumber - right.itemNumber).slice(0, 3)
  const tabs: Array<[typeof tab, string]> = [['class', 'Class summary'], ['items', 'Item analysis'], ['competencies', 'Competencies'], ['cognitive', 'Cognitive'], ['learners', 'Individual learner']]
  return <>
    <div className="results-sticky-actions analysis-actions"><div><Link className="text-link" to={`/results/${session.id}`}><ArrowLeft size={15} /> Results</Link><strong>{session.title}</strong><small>{session.assessmentSnapshot.assessmentTitle} · {session.sectionName}</small></div><div className="results-analysis-report-links"><Link className="button ghost" to="/results">All results</Link>{analysis.available && <><Link className="button ghost" to={`/results/${session.id}/print`}>Printable report</Link>{session.status !== 'archived' && <Link className="button secondary" to={`/results/${session.id}/remediation`}>Plan remediation</Link>}</>}</div></div>
    <header className="results-analysis-header"><div><span className="eyebrow">Teacher-facing deterministic report</span><h1>Results analysis</h1><p>Computed from the immutable assessment snapshot and teacher-entered outcomes. No learner identity or raw answers are sent to Gemini.</p></div><span className={`results-status ${session.status}`}>{session.status}</span></header>
    {!analysis.available && <section className="panel results-score-only-note large"><CircleAlert size={19} /><div><strong>{analysis.reason === 'score_only_mode' ? 'Item analysis is unavailable in score-only mode.' : 'Item analysis is waiting for encoded item outcomes.'}</strong><p>{analysis.reason === 'score_only_mode' ? 'You can still view overall scores and percentage summaries. Enter item-level answers in a new result set if item, option, competency, or cognitive analysis is needed.' : 'Encode at least one learner’s item outcomes to calculate deterministic statistics.'}</p></div></section>}
    <section className="results-metric-grid"><ResultMetric label="Learners" value={summary.learnerCount} hint={`${summary.encodedLearnerCount} with entries`} icon={<UsersRound size={17} />} /><ResultMetric label="Average raw score" value={summary.averageRawScore === null ? '—' : formatScore(summary.averageRawScore)} hint={`of ${formatScore(session.assessmentSnapshot.totalPossiblePoints)}`} tone="green" /><ResultMetric label="Average percentage" value={percentage(summary.averagePercentage)} hint="No ranking is created" tone="blue" /><ResultMetric label="Median percentage" value={percentage(summary.medianPercentage)} hint={`${summary.scoredLearnerCount} scored learners`} tone="slate" /></section>
    <nav className="results-analysis-tabs" aria-label="Analysis views">{tabs.map(([value, label]) => <button type="button" key={value} className={tab === value ? 'selected' : ''} onClick={() => setTab(value)}>{label}</button>)}</nav>
    {tab === 'class' && <section className="results-analysis-grid"><section className="panel results-analysis-card"><div className="results-section-heading"><div><span className="eyebrow">Class summary</span><h2>Overall evidence</h2><p>Descriptive statistics only; GuroDesk does not create public learner ranks.</p></div><BarChart3 size={20} /></div><div className="results-summary-stats"><div><small>Highest percentage</small><strong>{percentage(summary.highestPercentage)}</strong></div><div><small>Lowest percentage</small><strong>{percentage(summary.lowestPercentage)}</strong></div><div><small>Encoded learners</small><strong>{summary.encodedLearnerCount}/{summary.learnerCount}</strong></div></div><div className="results-distribution"><strong>Percentage distribution</strong>{summary.percentageDistribution.map((bin) => <div className="results-distribution-row" key={bin.label}><span>{bin.label}%</span><div className="results-progress-track"><span style={{ width: `${summary.scoredLearnerCount ? bin.count / summary.scoredLearnerCount * 100 : 0}%` }} /></div><b>{bin.count}</b></div>)}</div>{facilityItems.length > 0 && <div className="results-facility-cues"><strong>Instructional review cues</strong><p>Observed item facility only—these are not quality judgments or mandated cutoffs.</p><div><section><small>Higher observed facility</small>{higherFacilityItems.map((item) => <span key={`high-${item.itemId}`}>Item {itemNumberLabel(item)} <b>{percentage(item.facility)}</b></span>)}</section><section><small>Lower observed facility</small>{lowerFacilityItems.map((item) => <span key={`low-${item.itemId}`}>Item {itemNumberLabel(item)} <b>{percentage(item.facility)}</b></span>)}</section></div></div>}</section><section className="panel results-analysis-card"><div className="results-section-heading"><div><span className="eyebrow">Interpretation notes</span><h2>Use evidence carefully</h2></div><Info size={20} /></div><ul className="results-note-list"><li>Facility is a mathematical proportion, not a national DepEd threshold.</li><li>Unselected distractors are advisory review signals; they do not prove an item is defective.</li><li>Discrimination is shown only when the configured sample-size and variance conditions are met.</li><li>Competency and cognitive labels come from the finalized assessment mapping, not AI inference.</li><li>Use “Needs additional evidence/practice” language and review instructional decisions yourself.</li></ul><details className="results-formula-details"><summary>Show formulas</summary><ul><li>{analysis.formulas.facility}</li><li>{analysis.formulas.optionPercentage}</li><li>{analysis.formulas.pointFacility}</li><li>{analysis.formulas.distractorSignal}</li><li>{analysis.formulas.discrimination}</li><li>{analysis.formulas.smallClassRule}</li></ul></details></section></section>}
    {tab === 'items' && <section className="results-analysis-list">{analysis.items.map((item) => <ItemAnalysisCard item={item} key={item.itemId} />)}{!analysis.items.length && <EmptyState icon={BarChart3} title="No item outcomes yet" description="Return to encoding and enter item-level responses before opening this view." />}</section>}
    {tab === 'competencies' && <AggregateList label="verified competency" rows={analysis.competencies} empty="No mapped competency evidence yet." />}
    {tab === 'cognitive' && <AggregateList label="cognitive category" rows={analysis.cognitiveCategories} empty="No cognitive-category evidence yet." />}
    {tab === 'learners' && <section className="results-analysis-grid individual"><section className="panel results-analysis-card"><div className="results-section-heading"><div><span className="eyebrow">Private teacher view</span><h2>Learners</h2><p>Only the owning teacher can view these summaries.</p></div></div><div className="results-analysis-learner-list">{analysis.learners.map((candidate) => <button type="button" className={candidate.participantId === learner?.participantId ? 'selected' : ''} key={candidate.participantId} onClick={() => setSelectedLearner(candidate.participantId)}><strong>{candidate.displayName}</strong><small>{candidate.rawScore === null ? 'No score yet' : `${formatScore(candidate.rawScore)}/${formatScore(candidate.possiblePoints)} · ${percentage(candidate.percentage)}`}</small></button>)}</div></section><section className="panel results-analysis-card"><LearnerDetail learner={learner} /></section></section>}
  </>
}

function ItemAnalysisCard({ item }: { item: ItemAnalysisItem }) {
  return <article className="panel results-analysis-card results-item-analysis-card"><div className="results-analysis-card-top"><div><span className="results-item-number">{itemNumberLabel(item)}</span><strong>{item.questionType.replaceAll('_', ' ')}</strong></div><span className="results-facility-pill">Facility {percentage(item.facility)}</span></div><p className="results-item-prompt">{item.prompt}</p><div className="results-analysis-mini-grid"><div><small>Attempted</small><strong>{item.attempted}</strong></div><div><small>Correct</small><strong>{item.correct}</strong></div><div><small>Incorrect</small><strong>{item.incorrect}</strong></div><div><small>Omitted</small><strong>{item.omitted}</strong></div><div><small>Earned points</small><strong>{formatScore(item.earnedPoints)}</strong></div><div><small>Discrimination</small><strong>{item.discrimination.value === null ? '—' : item.discrimination.value.toFixed(2)}</strong><small>{item.discrimination.status === 'insufficient_data' ? 'Insufficient data' : item.discrimination.status === 'undefined' ? 'Undefined variance' : item.discrimination.method}</small></div></div>{item.options.length > 0 && <div className="results-option-list"><strong>Option distribution</strong>{item.options.map((option) => <div key={option.choiceId}><span className={option.correct ? 'correct' : ''}>{option.label}{option.correct ? ' · correct' : option.distractorSignal === 'unselected' ? ' · unselected signal' : ''}</span><div className="results-progress-track"><span style={{ width: `${(option.percentage ?? 0) * 100}%` }} /></div><b>{option.count} · {percentage(option.percentage)}</b></div>)}</div>}<small className="results-traceability">Mapped competency: {item.competencyCode || item.competencyText} · {item.cognitiveCategoryLabel} · question {itemNumberLabel(item)}</small></article>
}

function AggregateList({ label, rows, empty }: { label: string; rows: ItemAnalysisAggregate[]; empty: string }) {
  return <section className="results-analysis-list">{rows.map((row) => <article className="panel results-analysis-card results-aggregate-card" key={row.key}><div><span className="eyebrow">{label}</span><h2>{aggregateLabel(row)}</h2><p>{row.mappedItems} mapped item{row.mappedItems === 1 ? '' : 's'} · item numbers {row.itemNumbers.join(', ')}</p></div><div className="results-aggregate-score"><strong>{percentage(row.percentageCorrect)}</strong><small>{row.correct}/{row.correct + row.incorrect} correctness-applicable</small></div><div className="results-analysis-mini-grid"><div><small>Attempts</small><strong>{row.attempts}</strong></div><div><small>Omitted</small><strong>{row.omitted}</strong></div><div><small>Earned points</small><strong>{formatScore(row.earnedPoints)}</strong></div><div><small>Point facility</small><strong>{percentage(row.pointFacility)}</strong></div></div></article>)}{!rows.length && <EmptyState icon={BarChart3} title="No mapped evidence yet" description={empty} />}</section>
}

function LearnerDetail({ learner }: { learner?: LearnerAnalysisSummary }) {
  if (!learner) return <div className="results-muted">Choose a learner to view their private summary.</div>
  return <><span className="eyebrow">Selected learner</span><h2>{learner.displayName}</h2><div className="results-summary-stats"><div><small>Raw score</small><strong>{learner.rawScore === null ? '—' : `${formatScore(learner.rawScore)}/${formatScore(learner.possiblePoints)}`}</strong></div><div><small>Percentage</small><strong>{percentage(learner.percentage)}</strong></div><div><small>Omitted</small><strong>{learner.omittedItems}</strong></div></div><div className="results-analysis-detail-block"><strong>Missed or unanswered items</strong><p>{learner.missedItemNumbers.length ? learner.missedItemNumbers.join(', ') : 'None recorded.'}</p></div><div className="results-analysis-detail-block"><strong>Competency performance</strong>{learner.competencyPerformance.map((row) => <div className="results-detail-row" key={row.key}><span>{aggregateLabel(row)}</span><b>{percentage(row.percentageCorrect)}</b></div>)}</div><div className="results-analysis-detail-block"><strong>Cognitive-category performance</strong>{learner.cognitivePerformance.map((row) => <div className="results-detail-row" key={row.key}><span>{aggregateLabel(row)}</span><b>{percentage(row.percentageCorrect)}</b></div>)}</div></>
}
