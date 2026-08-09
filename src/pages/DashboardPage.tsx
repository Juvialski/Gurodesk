import { ArrowRight, BookMarked, CalendarCheck2, ClipboardList, FileCheck2, Sparkles, Table2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useApp } from '../contexts/AppContext'
import { PageHeader } from '../components/PageHeader'

export function DashboardPage() {
  const { profile, assignments, backendMode } = useApp()
  const teacherName = profile?.fullName?.split(' ')[0] || 'Teacher'
  const sectionCount = assignments.reduce((sum, item) => sum + item.sections.length, 0)

  return (
    <>
      <PageHeader
        eyebrow="Teacher workspace"
        title={`Good day, ${teacherName}.`}
        description="Your teaching load now connects to a verified, school-year-aware curriculum engine. Lesson planning, TOS, tests, and paperwork will build on the same source-grounded records."
      />

      <section className="metric-grid">
        <div className="metric-card"><span className="metric-icon blue"><BookMarked size={20} /></span><div><small>Teaching assignments</small><strong>{assignments.length}</strong><p>Grade and learning-area groups</p></div></div>
        <div className="metric-card"><span className="metric-icon green"><CalendarCheck2 size={20} /></span><div><small>Sections</small><strong>{sectionCount}</strong><p>Across your active teaching load</p></div></div>
        <div className="metric-card"><span className="metric-icon amber"><ClipboardList size={20} /></span><div><small>School year</small><strong className="metric-text">{profile?.schoolYear}</strong><p>Used for policy and curriculum versioning</p></div></div>
        <div className="metric-card"><span className="metric-icon slate"><FileCheck2 size={20} /></span><div><small>Data mode</small><strong className="metric-text">{backendMode === 'demo' ? 'Demo' : 'Supabase'}</strong><p>{backendMode === 'demo' ? 'Stored in this browser' : 'Protected by RLS policies'}</p></div></div>
      </section>

      <section className="dashboard-grid">
        <div className="panel teaching-load-panel">
          <div className="panel-heading"><div><span className="eyebrow">My teaching load</span><h2>Active classes</h2></div><Link to="/classes" className="text-link">Manage <ArrowRight size={15} /></Link></div>
          <div className="class-cards">
            {assignments.map((item) => (
              <div className="class-card" key={item.id}>
                <span className="class-grade">{item.gradeLevel.replace('Grade ', 'G')}</span>
                <div><strong>{item.learningArea}</strong><p>{item.sections.join(' · ')}</p></div>
                <span className="class-count">{item.sections.length} {item.sections.length === 1 ? 'section' : 'sections'}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="panel next-panel">
          <span className="eyebrow">Now available</span>
          <h2>Curriculum engine</h2>
          <p>Curriculum Navigator, the ILAW lesson planner, TOS Builder, and document exports share the same verified competency source, school-year context, and teacher assignments.</p>
          <div className="next-list">
            <span><BookMarked size={17} /> Verified curriculum navigator</span>
            <span><Table2 size={17} /> Academic-period mapping</span>
            <span><ClipboardList size={17} /> Deterministic TOS allocation</span>
            <span><Sparkles size={17} /> Policy-safe Gemini text support after teacher decisions</span>
          </div>
          <Link to="/curriculum" className="button secondary">Open Curriculum Navigator <ArrowRight size={16} /></Link>
        </div>
      </section>

      <section className="quick-grid">
        <Link to="/lesson-plans" className="quick-card"><span className="metric-icon blue"><CalendarCheck2 size={19} /></span><div><strong>Lesson Plans</strong><p>Teacher-led ILAW planning with verified competencies, guided AI suggestions, and Word/PDF exports.</p></div><span className="phase-pill live">Live</span></Link>
        <Link to="/tos" className="quick-card"><span className="metric-icon green"><Table2 size={19} /></span><div><strong>TOS Builder</strong><p>Verified competencies, exact item totals, mobile editing, and printable/XLSX exports.</p></div><span className="phase-pill live">Live</span></Link>
        <Link to="/assessments" className="quick-card"><span className="metric-icon amber"><ClipboardList size={19} /></span><div><strong>Assessments</strong><p>Create teacher-reviewed assessments from finalized TOS. Results, item analysis, and remediation are future.</p></div><span className="phase-pill live">Live</span></Link>
      </section>
    </>
  )
}
