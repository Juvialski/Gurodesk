import '../results-report.css'
import type { ReactNode } from 'react'
import type { ResultsReportModel } from '../types/resultsReport'

function pct(value: number | null) {
  return value === null ? '—' : `${Math.round(value * 1000) / 10}%`
}

function score(value: number | null, possible?: number) {
  if (value === null) return '—'
  return possible ? `${value} / ${possible}` : String(value)
}

export function ResultsReportView({ model, showLearnerNames = model.mode === 'summary' }: { model: ResultsReportModel; showLearnerNames?: boolean }) {
  const { labels } = model
  return (
    <article className="results-report-view">
      <header className="results-report-header">
        <p className="results-report-eyebrow">{model.documentTitle}</p>
        <h1>{model.title}</h1>
        <div className="results-report-metadata">
          {[
            [labels.teacher, model.metadata.teacherName],
            [labels.school, model.metadata.schoolName],
            [labels.gradeLevel, model.metadata.gradeLevel],
            [labels.learningArea, model.metadata.learningArea],
            [labels.schoolYear, model.metadata.schoolYear],
            [labels.gradingTerm, model.metadata.gradingTerm],
            [labels.section, model.metadata.sectionName],
            [labels.administrationDate, model.metadata.administrationDate],
          ].filter(([, value]) => value.trim()).map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}
        </div>
      </header>

      {model.mode === 'summary' && model.summary && <SummarySection model={model} showLearnerNames={showLearnerNames} />}
      {model.mode === 'item_analysis' && <ItemAnalysisSection model={model} />}
      {model.mode === 'competency' && <CompetencySection model={model} />}
      {model.mode === 'remediation' && <RemediationSection model={model} />}
    </article>
  )
}

function SummarySection({ model, showLearnerNames }: { model: ResultsReportModel; showLearnerNames: boolean }) {
  const summary = model.summary
  if (!summary) return <p className="results-report-empty">No summary data is available.</p>
  return <>
    <section className="results-report-stat-grid" aria-label="Class summary">
      <Stat label={model.labels.classAverage} value={`${score(summary.averageRawScore, summary.possiblePoints)} · ${pct(summary.averagePercentage)}`} />
      <Stat label={model.labels.median} value={`${score(summary.medianRawScore, summary.possiblePoints)} · ${pct(summary.medianPercentage)}`} />
      <Stat label={model.labels.highest} value={`${score(summary.highestRawScore, summary.possiblePoints)} · ${pct(summary.highestPercentage)}`} />
      <Stat label={model.labels.lowest} value={`${score(summary.lowestRawScore, summary.possiblePoints)} · ${pct(summary.lowestPercentage)}`} />
    </section>
    <section className="results-report-panel">
      <div className="results-report-panel-heading"><div><p className="results-report-eyebrow">{model.labels.summary}</p><h2>{summary.classLearnerCount} learners</h2></div><span className="results-report-chip">{summary.encodedLearnerCount} encoded</span></div>
      {showLearnerNames && <ReportTable><thead><tr><th>{model.labels.learner}</th><th>{model.labels.rawScore}</th><th>{model.labels.percentage}</th><th>{model.labels.attempted}</th><th>{model.labels.omitted}</th><th>{model.labels.correct}</th><th>{model.labels.incorrect}</th></tr></thead><tbody>{summary.learners.map((learner, index) => <tr key={`${learner.displayName}-${index}`}><td><strong>{learner.displayName || '—'}</strong></td><td>{score(learner.rawScore, learner.possiblePoints)}</td><td>{pct(learner.percentage)}</td><td>{learner.attemptedItems}</td><td>{learner.omittedItems}</td><td>{learner.correctItems}</td><td>{learner.incorrectItems}</td></tr>)}</tbody></ReportTable>}
      {!showLearnerNames && <p className="results-report-note">Learner names are intentionally omitted from this analytical view.</p>}
    </section>
    <section className="results-report-panel"><h2>Percentage distribution</h2><div className="results-report-distribution">{summary.percentageDistribution.map((bin) => <div key={bin.label}><span>{bin.label}</span><strong>{bin.count}</strong></div>)}</div></section>
  </>
}

function ItemAnalysisSection({ model }: { model: ResultsReportModel }) {
  return <>
    <section className="results-report-panel"><div className="results-report-panel-heading"><div><p className="results-report-eyebrow">{model.labels.itemAnalysis}</p><h2>{model.items.length} items</h2></div><span className="results-report-chip">Deterministic</span></div><ReportTable><thead><tr><th>{model.labels.item}</th><th>{model.labels.competency}</th><th>{model.labels.cognitiveCategory}</th><th>{model.labels.attempted}</th><th>{model.labels.correct}</th><th>{model.labels.incorrect}</th><th>{model.labels.omitted}</th><th>{model.labels.points}</th><th>{model.labels.analysisBasis}</th><th>{model.labels.facility}</th><th>{model.labels.pointAchievement}</th><th>{model.labels.discrimination}</th></tr></thead><tbody>{model.items.map((item) => <tr key={item.itemNumber}><td><strong>{item.itemNumber}</strong><small>{item.questionType}</small></td><td>{item.competency}</td><td>{item.cognitiveCategory}</td><td>{item.attempted}</td><td>{item.correct}</td><td>{item.incorrect}</td><td>{item.omitted}</td><td>{item.earnedPoints} / {item.possiblePoints}</td><td>{item.analysisBasis.replaceAll('_', ' ')}</td><td>{pct(item.facility)}</td><td>{pct(item.normalizedPointAchievement)}</td><td>{item.discriminationStatus === 'available' ? pct(item.discrimination) : <span className="results-report-muted">{item.discriminationStatus}</span>}</td></tr>)}</tbody></ReportTable></section>
    <section className="results-report-panel"><h2>{model.labels.options}</h2><p className="results-report-note">An unselected distractor is an advisory review signal, not proof that an item is defective.</p><ReportTable><thead><tr><th>{model.labels.item}</th><th>Option</th><th>{model.labels.count}</th><th>{model.labels.percentage}</th><th>Correct</th><th>Advisory signal</th><th>{model.labels.omitted}</th></tr></thead><tbody>{model.options.map((option, index) => <tr key={`${option.itemNumber}-${option.option}-${index}`}><td>{option.itemNumber}</td><td>{option.option}</td><td>{option.count}</td><td>{pct(option.percentage)}</td><td>{option.correct ? 'Yes' : 'No'}</td><td>{option.distractorSignal === 'unselected' ? 'Unselected — review' : '—'}</td><td>{option.omitted}</td></tr>)}</tbody></ReportTable></section>
  </>
}

function CompetencySection({ model }: { model: ResultsReportModel }) {
  return <>
    <section className="results-report-panel"><div className="results-report-panel-heading"><div><p className="results-report-eyebrow">{model.labels.competencyPerformance}</p><h2>{model.competencies.length} mapped competencies</h2></div><span className="results-report-chip">Verified mappings</span></div><ReportTable><thead><tr><th>{model.labels.competency}</th><th>{model.labels.curriculumPeriod}</th><th>Items</th><th>{model.labels.attempted}</th><th>{model.labels.correct}</th><th>{model.labels.incorrect}</th><th>{model.labels.omitted}</th><th>{model.labels.points}</th><th>{model.labels.pointAchievement}</th><th>{model.labels.facility}</th></tr></thead><tbody>{model.competencies.map((row) => <tr key={`${row.competency}-${row.curriculumPeriod}`}><td><strong>{row.competency}</strong>{row.code && <small>{row.code}</small>}</td><td>{row.curriculumPeriod}</td><td>{row.itemNumbers.join(', ')}</td><td>{row.attempts}</td><td>{row.correct}</td><td>{row.incorrect}</td><td>{row.omitted}</td><td>{row.earnedPoints} / {row.pointsPossibleForAll}</td><td>{pct(row.normalizedPointAchievement)}</td><td>{pct(row.facility)}</td></tr>)}</tbody></ReportTable></section>
    <section className="results-report-panel"><h2>{model.labels.cognitiveCategory}</h2><ReportTable><thead><tr><th>{model.labels.cognitiveCategory}</th><th>{model.labels.curriculumPeriod}</th><th>Items</th><th>{model.labels.attempted}</th><th>{model.labels.correct}</th><th>{model.labels.incorrect}</th><th>{model.labels.omitted}</th><th>{model.labels.points}</th><th>{model.labels.pointAchievement}</th><th>{model.labels.facility}</th></tr></thead><tbody>{model.cognitiveCategories.map((row) => <tr key={`${row.category}-${row.curriculumPeriod}`}><td>{row.category}</td><td>{row.curriculumPeriod}</td><td>{row.itemNumbers.join(', ')}</td><td>{row.attempts}</td><td>{row.correct}</td><td>{row.incorrect}</td><td>{row.omitted}</td><td>{row.earnedPoints} / {row.pointsPossibleForAll}</td><td>{pct(row.normalizedPointAchievement)}</td><td>{pct(row.facility)}</td></tr>)}</tbody></ReportTable></section>
    <section className="results-report-panel"><h2>{model.labels.curriculumPeriod}</h2><ReportTable><thead><tr><th>{model.labels.curriculumPeriod}</th><th>Items</th><th>{model.labels.attempted}</th><th>{model.labels.correct}</th><th>{model.labels.incorrect}</th><th>{model.labels.omitted}</th><th>{model.labels.points}</th><th>{model.labels.pointAchievement}</th><th>{model.labels.facility}</th></tr></thead><tbody>{model.curriculumPeriods.map((row) => <tr key={row.curriculumPeriod}><td>{row.curriculumPeriod}</td><td>{row.itemNumbers.join(', ')}</td><td>{row.attempts}</td><td>{row.correct}</td><td>{row.incorrect}</td><td>{row.omitted}</td><td>{row.earnedPoints} / {row.pointsPossibleForAll}</td><td>{pct(row.normalizedPointAchievement)}</td><td>{pct(row.facility)}</td></tr>)}</tbody></ReportTable></section>
  </>
}

function RemediationSection({ model }: { model: ResultsReportModel }) {
  return <section className="results-report-panel"><div className="results-report-panel-heading"><div><p className="results-report-eyebrow">{model.labels.remediationPlan}</p><h2>{model.remediation.length} teacher-reviewable signals</h2></div><span className="results-report-chip">Neutral instructional language</span></div>{model.remediation.length === 0 ? <p className="results-report-empty">No remediation signals have been selected.</p> : <div className="results-remediation-list">{model.remediation.map((row, index) => <article className="results-remediation-card" key={`${row.targetCompetency}-${row.curriculumPeriod}-${index}`}><div className="results-remediation-card-heading"><div><span className="results-report-eyebrow">{row.scope === 'whole_class' ? 'Whole class' : 'Selected learners'}</span><h3>{row.targetCompetency}</h3><p>{row.curriculumPeriod} · Items {row.itemNumbers.join(', ')}</p></div><strong>{pct(row.evidence)} / {pct(row.threshold)}</strong></div><p>{row.evidenceLabel === 'point_facility' ? 'Point-weighted evidence: ' : 'Correctness evidence: '}{row.denominatorLabel}</p><p>{row.instructionalMessage}</p><dl><div><dt>{model.labels.plannedActivity}</dt><dd>{row.plannedActivity || 'Not yet entered'}</dd></div><div><dt>{model.labels.schedule}</dt><dd>{row.schedule || 'Not yet entered'}</dd></div><div><dt>{model.labels.followUpEvidence}</dt><dd>{row.followUpEvidence || 'Not yet entered'}</dd></div><div><dt>{model.labels.notes}</dt><dd>{row.notes || '—'}</dd></div></dl><span className="results-report-review-state">{row.teacherReviewed ? 'Reviewed by teacher' : 'Review pending'}</span></article>)}</div>}</section>
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="results-report-stat"><span>{label}</span><strong>{value}</strong></div>
}

function ReportTable({ children }: { children: ReactNode }) {
  return <div className="results-report-table-wrap"><table>{children}</table></div>
}
