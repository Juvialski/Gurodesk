import { Check, Languages, Lightbulb, ListTree, RefreshCw, Sparkles, SpellCheck2, X } from 'lucide-react'
import { useState } from 'react'
import { runLessonAiSupport } from '../lib/repository'
import type { AiSuggestionSupportType, AiSupportType, LessonAiSupportRequest } from '../types/lessonPlan'

type Props = {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  rows?: number
  sectionKey: string
  isDemo: boolean
  context: LessonAiSupportRequest['lessonContext']
  onAiUsed: (supportType: AiSupportType) => void
  documentId?: string
  help?: string
  suggestionType?: Exclude<AiSuggestionSupportType, 'quick_draft'>
  suggestionLabel?: string
  pendingQuickDraft?: boolean
}

const tools: Array<{ type: AiSupportType; label: string; icon: typeof Sparkles }> = [
  { type: 'refine_clarity', label: 'Clarity', icon: Sparkles },
  { type: 'organize_text', label: 'Organize', icon: ListTree },
  { type: 'grammar_spelling', label: 'Grammar', icon: SpellCheck2 },
]

export function AiAssistTextarea({
  label,
  value,
  onChange,
  placeholder,
  rows = 5,
  sectionKey,
  isDemo,
  context,
  onAiUsed,
  documentId,
  help,
  suggestionType,
  suggestionLabel = 'Suggest 3',
  pendingQuickDraft = false,
}: Props) {
  const [loading, setLoading] = useState<AiSupportType | null>(null)
  const [revision, setRevision] = useState<{ text: string; supportType: AiSupportType; model: string; fallbackUsed?: boolean; thinkingLevel?: string } | null>(null)
  const [suggestions, setSuggestions] = useState<{ items: string[]; supportType: AiSupportType; model: string; fallbackUsed?: boolean; thinkingLevel?: string } | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function assist(supportType: AiSupportType, targetLanguage?: string) {
    if (value.trim().length < 10) return
    setLoading(supportType)
    setError(null)
    setRevision(null)
    try {
      const result = await runLessonAiSupport({ supportType, sectionKey, text: value, targetLanguage, documentId: documentId || undefined, lessonContext: context }, isDemo)
      if (!result.output) throw new Error('AI support returned no revised text.')
      setRevision({ text: result.output, supportType, model: result.model, fallbackUsed: result.fallbackUsed, thinkingLevel: result.thinkingLevel })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI support could not be completed.')
    } finally {
      setLoading(null)
    }
  }

  async function generateSuggestions() {
    if (!suggestionType || !context.competencyText.trim()) return
    setLoading(suggestionType)
    setError(null)
    setSuggestions(null)
    try {
      const result = await runLessonAiSupport({ supportType: suggestionType, sectionKey, text: value, documentId: documentId || undefined, lessonContext: context }, isDemo)
      if (!result.suggestions?.length) throw new Error('Gemini returned no usable suggestions.')
      setSuggestions({ items: result.suggestions.slice(0, 4), supportType: suggestionType, model: result.model, fallbackUsed: result.fallbackUsed, thinkingLevel: result.thinkingLevel })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Suggestions could not be generated.')
    } finally {
      setLoading(null)
    }
  }

  const modelNote = (model: string, thinkingLevel?: string, fallbackUsed?: boolean) => model === 'demo-local-preview'
    ? 'Local demo preview · no Gemini call'
    : `${model}${thinkingLevel === 'high' ? ' · high thinking' : ''}${fallbackUsed ? ' · Lite fallback used' : ''}`

  return (
    <div className={`ai-field ${pendingQuickDraft ? 'pending-ai-review' : ''}`}>
      <label>
        <span className="field-label-row"><span>{label}</span>{pendingQuickDraft ? <small className="pending-review-label">Quick Draft · review</small> : <small>{suggestionType ? 'Teacher selects final wording' : 'Teacher-controlled'}</small>}</span>
        <textarea rows={rows} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
      </label>
      {help && <p className="field-help">{help}</p>}

      <div className="ai-tools" aria-label={`AI support for ${label}`}>
        {suggestionType && <button type="button" className="ai-tool-button suggestion-button" disabled={!context.competencyText.trim() || Boolean(loading)} onClick={() => void generateSuggestions()}>{loading === suggestionType ? <span className="mini-spinner" /> : <Lightbulb size={13} />}{suggestions ? 'Generate 3 more' : suggestionLabel}</button>}
        {value.trim().length >= 10 && <>
          <span className="ai-tools-label">Polish</span>
          {tools.map(({ type, label: toolLabel, icon: Icon }) => (
            <button key={type} type="button" className="ai-tool-button" disabled={Boolean(loading)} onClick={() => void assist(type)}>
              {loading === type ? <span className="mini-spinner" /> : <Icon size={13} />}{toolLabel}
            </button>
          ))}
          <button type="button" className="ai-tool-button" disabled={Boolean(loading)} onClick={() => void assist('translate', 'Filipino')}><Languages size={13} /> Filipino</button>
          <button type="button" className="ai-tool-button" disabled={Boolean(loading)} onClick={() => void assist('translate', 'English')}><Languages size={13} /> English</button>
          {context.teachingSetup?.localLanguageName?.trim() && <button type="button" className="ai-tool-button" disabled={Boolean(loading)} onClick={() => void assist('translate', context.teachingSetup?.localLanguageName?.trim())}><Languages size={13} /> {context.teachingSetup.localLanguageName.trim()}</button>}
        </>}
      </div>
      {suggestionType && !context.competencyText.trim() && <small className="ai-guardrail">Choose a verified competency first so suggestions stay curriculum-grounded.</small>}
      {!suggestionType && value.trim().length < 10 && <small className="ai-guardrail">AI can polish this field after you enter the information that only you can verify.</small>}
      {error && <small className="field-error">{error}</small>}

      {suggestions && (
        <div className="ai-suggestion suggestion-options">
          <div className="ai-suggestion-head"><strong>Optional starting points</strong><small>{modelNote(suggestions.model, suggestions.thinkingLevel, suggestions.fallbackUsed)} · choose, edit, or ignore</small></div>
          <div className="suggestion-option-list">
            {suggestions.items.map((item, index) => <div className="suggestion-option" key={`${suggestions.supportType}-${index}`}><div><span>Option {index + 1}</span><p>{item}</p></div><button type="button" className="button secondary" onClick={() => { onChange(item); onAiUsed(suggestions.supportType); setSuggestions(null) }}><Check size={14} /> Use this</button></div>)}
          </div>
          <div className="ai-suggestion-actions"><button type="button" className="button ghost" onClick={() => setSuggestions(null)}><X size={14} /> Close</button><button type="button" className="button ghost" disabled={Boolean(loading)} onClick={() => void generateSuggestions()}><RefreshCw size={14} /> New options</button></div>
        </div>
      )}

      {revision && (
        <div className="ai-suggestion">
          <div className="ai-suggestion-head"><strong>AI-assisted revision</strong><small>{modelNote(revision.model, revision.thinkingLevel, revision.fallbackUsed)} · review before applying</small></div>
          <div className="ai-suggestion-copy">{revision.text}</div>
          <div className="ai-suggestion-actions">
            <button type="button" className="button ghost" onClick={() => setRevision(null)}><X size={14} /> Discard</button>
            <button type="button" className="button secondary" onClick={() => { onChange(revision.text); onAiUsed(revision.supportType); setRevision(null) }}><Check size={14} /> Apply after review</button>
          </div>
        </div>
      )}
    </div>
  )
}
