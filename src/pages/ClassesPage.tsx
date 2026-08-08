import { Plus, School, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useApp } from '../contexts/AppContext'
import { GRADE_LEVELS, LEARNING_AREAS } from '../data/constants'
import { PageHeader } from '../components/PageHeader'

export function ClassesPage() {
  const { user, profile, assignments, createAssignment, removeAssignment } = useApp()
  const [open, setOpen] = useState(false)
  const [gradeLevel, setGradeLevel] = useState('Grade 7')
  const [learningArea, setLearningArea] = useState('Mathematics')
  const [sectionsText, setSectionsText] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const sections = useMemo(() => sectionsText.split(',').map((x) => x.trim()).filter(Boolean), [sectionsText])

  async function add() {
    if (!user || sections.length === 0) {
      setMessage('Add at least one section.')
      return
    }
    await createAssignment({
      userId: user.id,
      schoolYear: profile?.schoolYear ?? '2026-2027',
      gradeLevel,
      learningArea,
      sections,
      isActive: true,
    })
    setSectionsText('')
    setOpen(false)
    setMessage(null)
  }

  return (
    <>
      <PageHeader
        eyebrow="Teaching setup"
        title="My Classes"
        description="Your teaching load is the main filter for curriculum, plans, assessments, and paperwork."
        actions={<button className="button primary" onClick={() => setOpen(!open)}><Plus size={17} /> Add assignment</button>}
      />

      {open && (
        <div className="panel inline-form-panel">
          <div className="form-grid three">
            <label>Grade level<select value={gradeLevel} onChange={(e) => setGradeLevel(e.target.value)}>{GRADE_LEVELS.map((item) => <option key={item}>{item}</option>)}</select></label>
            <label>Learning area<select value={learningArea} onChange={(e) => setLearningArea(e.target.value)}>{LEARNING_AREAS.map((item) => <option key={item}>{item}</option>)}</select></label>
            <label>Sections<input value={sectionsText} onChange={(e) => setSectionsText(e.target.value)} placeholder="Rizal, Mabini" /></label>
          </div>
          {message && <div className="form-message error">{message}</div>}
          <div className="inline-actions"><button className="button ghost" onClick={() => setOpen(false)}>Cancel</button><button className="button secondary" onClick={() => void add()}>Save assignment</button></div>
        </div>
      )}

      <div className="panel table-panel">
        <div className="responsive-table">
          <table>
            <thead><tr><th>Grade</th><th>Learning area</th><th>Sections</th><th>School year</th><th></th></tr></thead>
            <tbody>
              {assignments.map((item) => (
                <tr key={item.id}>
                  <td><span className="table-grade"><School size={15} /> {item.gradeLevel}</span></td>
                  <td><strong>{item.learningArea}</strong></td>
                  <td>{item.sections.map((section) => <span className="tag" key={section}>{section}</span>)}</td>
                  <td>{item.schoolYear}</td>
                  <td><button className="icon-button danger" onClick={() => void removeAssignment(item.id)} aria-label="Delete assignment"><Trash2 size={16} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {assignments.length === 0 && <div className="mini-empty">No teaching assignments yet.</div>}
      </div>
    </>
  )
}
