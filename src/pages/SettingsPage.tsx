import { Database, RotateCcw, Save, ShieldCheck } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useApp } from '../contexts/AppContext'
import { POSITION_TITLES, SCHOOL_YEARS } from '../data/constants'
import { demoStore } from '../lib/demoStore'
import { PageHeader } from '../components/PageHeader'
import type { Profile } from '../types/app'

export function SettingsPage() {
  const { profile, backendMode, backendConfigured, updateProfile, refreshWorkspace } = useApp()
  const [form, setForm] = useState<Profile | null>(profile)
  const [saved, setSaved] = useState(false)

  useEffect(() => setForm(profile), [profile])

  async function save() {
    if (!form) return
    await updateProfile(form)
    setSaved(true)
    window.setTimeout(() => setSaved(false), 1800)
  }

  function resetDemo() {
    if (backendMode !== 'demo') return
    demoStore.reset()
    void refreshWorkspace()
  }

  return (
    <>
      <PageHeader eyebrow="Workspace" title="Settings" description="Manage your teacher profile and see the current backend state." />
      <div className="settings-grid">
        <section className="panel">
          <div className="panel-heading"><div><span className="eyebrow">Profile</span><h2>Document identity</h2></div></div>
          {form && <div className="form-grid two">
            <label>Full name<input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} /></label>
            <label>Position<select value={form.positionTitle} onChange={(e) => setForm({ ...form, positionTitle: e.target.value })}>{POSITION_TITLES.map((item) => <option key={item}>{item}</option>)}</select></label>
            <label className="span-two">School<input value={form.schoolName} onChange={(e) => setForm({ ...form, schoolName: e.target.value })} /></label>
            <label>Region<input value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} /></label>
            <label>Schools Division<input value={form.division} onChange={(e) => setForm({ ...form, division: e.target.value })} /></label>
            <label>School year<select value={form.schoolYear} onChange={(e) => setForm({ ...form, schoolYear: e.target.value })}>{SCHOOL_YEARS.map((item) => <option key={item}>{item}</option>)}</select></label>
          </div>}
          <div className="inline-actions"><button className="button primary" onClick={() => void save()}><Save size={16} /> {saved ? 'Saved' : 'Save changes'}</button></div>
        </section>

        <aside className="panel system-panel">
          <span className="system-icon"><Database size={22} /></span>
          <h2>Backend status</h2>
          <div className="status-lines">
            <div><span>Mode</span><strong>{backendMode === 'demo' ? 'Local demo' : 'Supabase'}</strong></div>
            <div><span>Supabase environment</span><strong>{backendConfigured ? 'Configured' : 'Not configured'}</strong></div>
            <div><span>Row-level security</span><strong>{backendMode === 'supabase' ? 'Migration required / enabled after setup' : 'Not applicable in demo'}</strong></div>
            <div><span>Gemini browser key</span><strong>Never used</strong></div>
          </div>
          <div className="security-note"><ShieldCheck size={18} /><p>Gemini will be called only from Supabase Edge Functions. The browser gets only the Supabase publishable key.</p></div>
          {backendMode === 'demo' && <button className="button ghost" onClick={resetDemo}><RotateCcw size={16} /> Reset demo data</button>}
        </aside>
      </div>
    </>
  )
}
