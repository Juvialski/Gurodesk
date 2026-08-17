import { CheckCircle2, FileDown, Save } from 'lucide-react'
import { useEffect, useState } from 'react'
import { EXPORT_DOCUMENT_LANGUAGE_OPTIONS, EXPORT_PAPER_OPTIONS, EXPORT_TEMPLATE_OPTIONS, createDefaultTeacherExportPreferences, type TeacherExportPreferences } from '../types/export'
import type { Profile } from '../types/app'
import { loadTeacherExportPreferences, saveTeacherExportPreferences } from '../lib/repository'

export function ExportSettingsPanel({ userId, profile, isDemo }: { userId: string; profile: Profile; isDemo: boolean }) {
  const [preferences, setPreferences] = useState<TeacherExportPreferences>(() => createDefaultTeacherExportPreferences(userId))
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    let mounted = true
    setLoading(true)
    loadTeacherExportPreferences(userId, isDemo)
      .then((value) => { if (mounted) setPreferences({ ...value, includeAiDeclaration: false, includeSourceProvenance: false }) })
      .catch((err) => { if (mounted) setMessage(err instanceof Error ? err.message : 'Unable to load export settings.') })
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [userId, isDemo])

  async function save() {
    setSaving(true)
    setMessage('')
    try {
      const saved = await saveTeacherExportPreferences({ ...preferences, includeAiDeclaration: false, includeSourceProvenance: false }, isDemo)
      setPreferences({ ...saved, includeAiDeclaration: false, includeSourceProvenance: false })
      setMessage('Document export settings saved.')
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Unable to save export settings.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="panel export-settings-panel">
      <div className="panel-heading">
        <div><span className="eyebrow">Document exports</span><h2>Printable document defaults</h2><p>The built-in ILAW layout remains the fallback. Custom school DOCX templates can be added below and set as the default for lesson-plan exports.</p></div>
        <span className="settings-feature-icon"><FileDown size={20} /></span>
      </div>

      {loading ? <div className="settings-inline-loading">Loading export settings…</div> : <>
        <div className="settings-subsection export-template-selector">
          <strong>Default lesson-plan format</strong>
          <p className="field-help">Choose the built-in format opened by default when you preview or download a lesson plan.</p>
          <div className="export-template-options">
            {EXPORT_TEMPLATE_OPTIONS.map((item) => (
              <button
                type="button"
                key={item.id}
                className={`export-template-option ${preferences.defaultTemplateId === item.id ? 'selected' : ''}`}
                aria-pressed={preferences.defaultTemplateId === item.id}
                onClick={() => setPreferences((current) => ({ ...current, defaultTemplateId: item.id }))}
              >
                <span className="export-template-option-copy"><strong>{item.label}</strong><small>{item.description}</small></span>
                {preferences.defaultTemplateId === item.id && <CheckCircle2 size={17} aria-hidden="true" />}
              </button>
            ))}
          </div>
        </div>


        <div className="settings-subsection">
          <strong>Document labels</strong>
          <p className="field-help">This changes headings and labels only. Your actual lesson content is never translated during export.</p>
          <div className="choice-row export-language-choices">
            {EXPORT_DOCUMENT_LANGUAGE_OPTIONS.map((item) => (
              <button
                type="button"
                key={item.id}
                className={`choice-chip ${preferences.documentLanguage === item.id ? 'selected' : ''}`}
                onClick={() => setPreferences((current) => ({ ...current, documentLanguage: item.id }))}
                title={item.description}
              >
                {preferences.documentLanguage === item.id && <CheckCircle2 size={14} />}{item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="settings-subsection">
          <strong>Default paper size</strong>
          <div className="choice-row">
            {EXPORT_PAPER_OPTIONS.map((item) => (
              <button
                type="button"
                key={item.id}
                className={`choice-chip ${preferences.paperSize === item.id ? 'selected' : ''}`}
                onClick={() => setPreferences((current) => ({ ...current, paperSize: item.id }))}
              >
                {preferences.paperSize === item.id && <CheckCircle2 size={14} />}{item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="form-grid two export-signatory-grid">
          <label>Prepared by name<input value={preferences.preparedByName} onChange={(event) => setPreferences((current) => ({ ...current, preparedByName: event.target.value }))} placeholder={profile.fullName || 'Defaults to teacher profile'} /></label>
          <label>Prepared by title<input value={preferences.preparedByTitle} onChange={(event) => setPreferences((current) => ({ ...current, preparedByTitle: event.target.value }))} placeholder={profile.positionTitle || 'Defaults to position'} /></label>
          <label>Reviewed by name<input value={preferences.reviewedByName} onChange={(event) => setPreferences((current) => ({ ...current, reviewedByName: event.target.value }))} placeholder="Optional" /></label>
          <label>Reviewed by title<input value={preferences.reviewedByTitle} onChange={(event) => setPreferences((current) => ({ ...current, reviewedByTitle: event.target.value }))} placeholder="e.g. Master Teacher I" /></label>
          <label>Noted by name<input value={preferences.notedByName} onChange={(event) => setPreferences((current) => ({ ...current, notedByName: event.target.value }))} placeholder="Optional" /></label>
          <label>Noted by title<input value={preferences.notedByTitle} onChange={(event) => setPreferences((current) => ({ ...current, notedByTitle: event.target.value }))} placeholder="e.g. School Principal" /></label>
        </div>

        {message && <div className={`form-message ${message.toLowerCase().includes('unable') ? 'error' : ''}`}>{message}</div>}
        <div className="inline-actions"><button className="button primary" disabled={saving} onClick={() => void save()}><Save size={16} /> {saving ? 'Saving…' : 'Save export settings'}</button></div>
      </>}
    </section>
  )
}
