import { BookOpenCheck, CheckCircle2, Save, Settings2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { loadTeacherLessonPreferences, saveTeacherLessonPreferences } from '../lib/repository'
import {
  APPROACH_OPTIONS,
  TECHNOLOGY_OPTIONS,
  createDefaultTeacherLessonPreferences,
  type TeacherLessonPreferences,
} from '../types/teachingSetup'

type Props = {
  userId: string
  isDemo: boolean
}

function lines(value: string) {
  return value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean)
}

export function TeachingSetupPanel({ userId, isDemo }: Props) {
  const [form, setForm] = useState<TeacherLessonPreferences>(() => createDefaultTeacherLessonPreferences(userId))
  const [resourcesText, setResourcesText] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    setLoading(true)
    loadTeacherLessonPreferences(userId, isDemo)
      .then((next) => {
        if (cancelled) return
        setForm(next)
        setResourcesText(next.actualResources.join('\n'))
      })
      .catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : 'Unable to load teaching setup.') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [userId, isDemo])

  const resourceCount = useMemo(() => lines(resourcesText).length, [resourcesText])

  function toggleList(key: 'availableTechnology' | 'preferredApproaches', value: string) {
    setForm((current) => ({
      ...current,
      [key]: current[key].includes(value) ? current[key].filter((item) => item !== value) : [...current[key], value],
    }))
  }

  async function save() {
    if (!userId) return
    setSaving(true)
    setMessage(null)
    setError(null)
    try {
      const next = await saveTeacherLessonPreferences({
        ...form,
        userId,
        actualResources: lines(resourcesText),
      }, isDemo)
      setForm(next)
      setResourcesText(next.actualResources.join('\n'))
      setMessage('Teaching setup saved. New lesson suggestions will use these constraints.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save teaching setup.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="panel teaching-setup-panel">
      <div className="panel-heading teaching-setup-heading">
        <div>
          <span className="eyebrow">Lesson defaults</span>
          <h2>My teaching setup</h2>
          <p>Set this once so GuroDesk can prepare better lesson suggestions without inventing books, devices, materials, or learner details.</p>
        </div>
        <span className="teaching-setup-icon"><Settings2 size={19} /></span>
      </div>

      {loading ? <div className="lesson-loading"><span className="loader" /><strong>Loading teaching setup…</strong></div> : <>
        <div className="form-grid two teaching-setup-grid">
          <label>Typical minutes per session<input type="number" min="10" max="300" value={form.defaultDurationMinutes} onChange={(event) => setForm({ ...form, defaultDurationMinutes: Math.max(10, Number(event.target.value) || 60) })} /></label>
          <label>Usual language<select value={form.languagePreference} onChange={(event) => setForm({ ...form, languagePreference: event.target.value })}><option>English</option><option>Filipino</option><option>English + Filipino</option><option>Mother tongue / local language</option></select></label>
          <label className="span-two">Typical class profile<textarea rows={3} value={form.typicalClassProfile} onChange={(event) => setForm({ ...form, typicalClassProfile: event.target.value })} placeholder="Class-level information only, e.g. mixed readiness; benefits from worked examples and short guided practice." /></label>
        </div>
        <p className="field-help privacy-help">Do not enter learner names, diagnoses, addresses, account details, or other sensitive personal information.</p>

        <div className="teaching-preference-block">
          <strong>Technology actually available</strong>
          <div className="setup-chip-grid">{TECHNOLOGY_OPTIONS.map((item) => <label className="check-chip" key={item}><input type="checkbox" checked={form.availableTechnology.includes(item)} onChange={() => toggleList('availableTechnology', item)} /> {item}</label>)}</div>
        </div>

        <div className="teaching-preference-block">
          <strong>Approaches you commonly use</strong>
          <div className="setup-chip-grid">{APPROACH_OPTIONS.map((item) => <label className="check-chip" key={item}><input type="checkbox" checked={form.preferredApproaches.includes(item)} onChange={() => toggleList('preferredApproaches', item)} /> {item}</label>)}</div>
        </div>

        <div className="resource-library-box">
          <div className="resource-library-heading"><BookOpenCheck size={17} /><div><strong>Books, modules & materials you actually use</strong><small>One resource per line. GuroDesk may mention only items you list here or explicitly add to the lesson.</small></div><span>{resourceCount}</span></div>
          <textarea rows={5} value={resourcesText} onChange={(event) => setResourcesText(event.target.value)} placeholder={'Example:\nTeacher-made slides\nDepEd Mathematics 7 module\nSchool-issued scientific calculator'} />
          <label>Resource notes<textarea rows={2} value={form.resourceNotes} onChange={(event) => setForm({ ...form, resourceNotes: event.target.value })} placeholder="Optional constraints, e.g. only one projector for the room; no student internet." /></label>
        </div>

        {message && <div className="ai-setup-notice success"><CheckCircle2 size={14} /> {message}</div>}
        {error && <div className="ai-setup-notice error">{error}</div>}
        <div className="inline-actions"><button className="button primary" disabled={saving} onClick={() => void save()}><Save size={15} /> {saving ? 'Saving…' : 'Save teaching setup'}</button></div>
      </>}
    </section>
  )
}
