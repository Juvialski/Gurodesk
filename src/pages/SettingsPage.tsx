import { Database, RotateCcw, Save, ShieldCheck, UserRound, School, FileText, Sparkles, Settings2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { AiSetupPanel } from '../components/AiSetupPanel'
import { TeachingSetupPanel } from '../components/TeachingSetupPanel'
import { ExportSettingsPanel } from '../components/ExportSettingsPanel'
import { DocumentTemplatesPanel } from '../components/DocumentTemplatesPanel'
import { TosTemplatesPanel } from '../components/TosTemplatesPanel'
import { useApp } from '../contexts/AppContext'
import { POSITION_TITLES, SCHOOL_YEARS } from '../data/constants'
import { demoStore } from '../lib/demoStore'
import { clearDemoTosDocuments } from '../lib/tosRepository'
import { PageHeader } from '../components/PageHeader'
import { SchoolPicker } from '../components/SchoolPicker'
import type { Profile } from '../types/app'
import '../workflows.css'

type SettingsCategory = 'profile' | 'teaching' | 'documents' | 'ai' | 'system'

const SETTINGS_CATEGORIES: Array<{ id: SettingsCategory; label: string; detail: string; icon: typeof UserRound }> = [
  { id: 'profile', label: 'Profile', detail: 'Teacher and school identity', icon: UserRound },
  { id: 'teaching', label: 'Teaching', detail: 'Class and planning defaults', icon: School },
  { id: 'documents', label: 'Documents', detail: 'Exports and templates', icon: FileText },
  { id: 'ai', label: 'AI assistance', detail: 'Gemini and language preferences', icon: Sparkles },
  { id: 'system', label: 'Advanced / System', detail: 'Backend, security, and diagnostics', icon: Settings2 },
]

const SETTINGS_HASH: Record<SettingsCategory, string> = {
  profile: '#profile',
  teaching: '#teaching',
  documents: '#documents',
  ai: '#ai-assistance',
  system: '#advanced',
}

function categoryFromHash(hash: string): SettingsCategory | null {
  if (hash === '#ai-assistance' || hash === '#ai') return 'ai'
  if (hash === '#advanced' || hash === '#system') return 'system'
  if (hash === '#teaching') return 'teaching'
  if (hash === '#documents') return 'documents'
  if (hash === '#profile') return 'profile'
  return null
}

export function SettingsPage() {
  const { profile, backendMode, backendConfigured, isDemo, updateProfile, refreshWorkspace } = useApp()
  const location = useLocation()
  const navigate = useNavigate()
  const [form, setForm] = useState<Profile | null>(profile)
  const [saved, setSaved] = useState(false)
  const [category, setCategory] = useState<SettingsCategory>(() => {
    try {
      const hashCategory = categoryFromHash(window.location.hash)
      if (hashCategory) return hashCategory
      const value = localStorage.getItem('gurodesk.settings.category') as SettingsCategory | null
      return SETTINGS_CATEGORIES.some((item) => item.id === value) ? value as SettingsCategory : 'profile'
    } catch {
      return 'profile'
    }
  })

  useEffect(() => setForm(profile), [profile])

  useEffect(() => {
    try {
      localStorage.setItem('gurodesk.settings.category', category)
    } catch {
      // Local preference is optional.
    }
  }, [category])

  useEffect(() => {
    const hashCategory = categoryFromHash(location.hash)
    if (hashCategory) setCategory(hashCategory)
  }, [location.hash])

  async function save() {
    if (!form) return
    await updateProfile(form)
    setSaved(true)
    window.setTimeout(() => setSaved(false), 1800)
  }

  function resetDemo() {
    if (backendMode !== 'demo') return
    clearDemoTosDocuments()
    demoStore.reset()
    void refreshWorkspace()
  }

  function selectCategory(nextCategory: SettingsCategory) {
    setCategory(nextCategory)
    const hash = SETTINGS_HASH[nextCategory]
    if (location.hash !== hash) navigate({ pathname: location.pathname, search: location.search, hash }, { replace: true })
  }

  return (
    <>
      <PageHeader eyebrow="Workspace" title="Settings" description="Choose a category to update your teacher workspace. Technical details stay under Advanced / System." />
      <div className="settings-workflow-layout">
        <nav className="settings-category-nav" aria-label="Settings categories">{SETTINGS_CATEGORIES.map(({ id, label, detail, icon: Icon }) => <button type="button" key={id} className={category === id ? 'active' : ''} aria-current={category === id ? 'page' : undefined} onClick={() => selectCategory(id)}><span className="settings-category-icon"><Icon size={17} /></span><span><strong>{label}</strong><small>{detail}</small></span></button>)}</nav>
        <section className="settings-category-content">
          {category === 'profile' && <section className="panel settings-profile-panel workflow-settings-card"><div className="panel-heading"><div><span className="eyebrow">Profile</span><h2>Teacher and school identity</h2><p>These details appear on your documents.</p></div></div>{form && <div className="form-grid two"><label>Full name<input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} /></label><label>Position<select value={form.positionTitle} onChange={(e) => setForm({ ...form, positionTitle: e.target.value })}>{POSITION_TITLES.map((item) => <option key={item}>{item}</option>)}</select></label><div className="span-two"><SchoolPicker value={form} onChange={(patch) => setForm((current) => current ? ({ ...current, ...patch }) : current)} isDemo={isDemo} /></div><label>School year<select value={form.schoolYear} onChange={(e) => setForm({ ...form, schoolYear: e.target.value })}>{SCHOOL_YEARS.map((item) => <option key={item}>{item}</option>)}</select></label></div>}<div className="inline-actions"><button className="button primary" onClick={() => void save()}><Save size={16} /> {saved ? 'Saved' : 'Save changes'}</button></div></section>}
          {category === 'teaching' && <section className="settings-stack"><section className="panel workflow-settings-card"><div className="panel-heading"><div><span className="eyebrow">Teaching</span><h2>Classes and planning defaults</h2><p>Update your classes or adjust the defaults used when a new lesson starts.</p></div><Link className="button secondary" to="/classes">Open Classes</Link></div></section>{profile && <TeachingSetupPanel userId={profile.id} isDemo={isDemo} />}</section>}
          {category === 'documents' && <section className="settings-stack"><section className="panel workflow-settings-card"><span className="eyebrow">Documents</span><h2>Export defaults and templates</h2><p>Choose how new documents are prepared. Existing records keep their saved content.</p></section>{profile && <ExportSettingsPanel userId={profile.id} profile={profile} isDemo={isDemo} />}{profile && <DocumentTemplatesPanel userId={profile.id} isDemo={isDemo} />}{profile && <TosTemplatesPanel userId={profile.id} isDemo={isDemo} />}</section>}
          {category === 'ai' && <section className="settings-stack"><section className="panel workflow-settings-card"><span className="eyebrow">AI assistance</span><h2>Optional Gemini help</h2><p>Connect your own Gemini key if you want AI-assisted drafts. GuroDesk still works without it.</p></section><AiSetupPanel isDemo={isDemo} /></section>}
          {category === 'system' && <section className="panel system-panel workflow-settings-card"><span className="system-icon"><Database size={22} /></span><span className="eyebrow">Advanced / System</span><h2>Technical workspace details</h2><p className="workflow-system-intro">These details help with troubleshooting. They are not needed for everyday teaching.</p><div className="status-lines"><div><span>Backend mode</span><strong>{backendMode === 'demo' ? 'Local demo' : 'Supabase'}</strong></div><div><span>Supabase environment</span><strong>{backendConfigured ? 'Configured' : 'Not configured'}</strong></div><div><span>Row-level security</span><strong>{backendMode === 'supabase' ? 'Enabled by migrations' : 'Not applicable in demo'}</strong></div><div><span>AI connection</span><strong>Teacher-owned Gemini setup</strong></div></div><div className="security-note"><ShieldCheck size={18} /><p>GuroDesk keeps technical provider and security diagnostics in this advanced area. Your document workflows remain usable when AI is disconnected.</p></div>{backendMode === 'demo' && <button className="button ghost" onClick={resetDemo}><RotateCcw size={16} /> Reset demo data</button>}</section>}
        </section>
      </div>
    </>
  )
}
