import { Check, Languages, ListTree, Sparkles, SpellCheck2, X } from 'lucide-react'
import { useState } from 'react'
import { runLessonAiSupport } from '../lib/repository'
import type { AiSupportType } from '../types/lessonPlan'

type Props = {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  rows?: number
  sectionKey: string
  isDemo: boolean
  context: {
    gradeLevel: string
    learningArea: string
    competencyText: string
    teacherIntent: string
  }
  onAiUsed: (supportType: AiSupportType) => void
  documentId?: string
  help?: string
}

const tools: Array<{ type: AiSupportType; label: string; icon: typeof Sparkles }> = [
  { type: 'refine_clarity', label: 'Clarity', icon: Sparkles },
  { type: 'organize_text', label: 'Organize', icon: ListTree },
  { type: 'grammar_spelling', label: 'Grammar', icon: SpellCheck2 },
]

export function AiAssistTextarea({ label, value, onChange, placeholder, rows = 5, sectionKey, isDemo, context, onAiUsed, documentId, help }: Props) {
  const [loading, setLoading] = useState<AiSupportType | null>(null)
  const [suggestion, setSuggestion] = useState<{ text: string; supportType: AiSupportType; model: string } | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function assist(supportType: AiSupportType) {
    if (value.trim().length < 10) return
    setLoading(supportType)
    setError(null)
    setSuggestion(null)
    try {
      const result = await runLessonAiSupport({ supportType, sectionKey, text: value, documentId: documentId || undefined, lessonContext: context }, isDemo)
      setSuggestion({ text: result.output, supportType, model: result.model })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI support could not be completed.')
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="ai-field">
      <label>
        <span className="field-label-row"><span>{label}</span><small>Teacher-authored first</small></span>
        <textarea rows={rows} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
      </label>
      {help && <p className="field-help">{help}</p>}
      <div className="ai-tools" aria-label={`AI support for ${label}`}>
        <span className="ai-tools-label">AI support</span>
        {tools.map(({ type, label: toolLabel, icon: Icon }) => (
          <button key={type} type="button" className="ai-tool-button" disabled={value.trim().length < 10 || Boolean(loading)} onClick={() => void assist(type)}>
            {loading === type ? <span className="mini-spinner" /> : <Icon size={13} />}{toolLabel}
          </button>
        ))}
        <button type="button" className="ai-tool-button" disabled title="Translation support is wired server-side and will be exposed with language selection in a later polish pass."><Languages size={13} /> Translate</button>
      </div>
      {value.trim().length < 10 && <small className="ai-guardrail">Write your instructional decision first. GuroDesk will not use AI to invent an empty ILAW section.</small>}
      {error && <small className="field-error">{error}</small>}
      {suggestion && (
        <div className="ai-suggestion">
          <div className="ai-suggestion-head"><strong>AI-assisted revision</strong><small>{suggestion.model === 'demo-local-preview' ? 'Local demo preview · no Gemini call' : 'Gemini support · review before applying'}</small></div>
          <div className="ai-suggestion-copy">{suggestion.text}</div>
          <div className="ai-suggestion-actions">
            <button type="button" className="button ghost" onClick={() => setSuggestion(null)}><X size={14} /> Discard</button>
            <button type="button" className="button secondary" onClick={() => { onChange(suggestion.text); onAiUsed(suggestion.supportType); setSuggestion(null) }}><Check size={14} /> Apply after review</button>
          </div>
        </div>
      )}
    </div>
  )
}
