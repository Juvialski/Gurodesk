import {
  CheckCircle2,
  ExternalLink,
  KeyRound,
  RefreshCw,
  ClipboardPaste,
  Eye,
  EyeOff,
  Save,
  ShieldCheck,
  Sparkles,
  Trash2,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { AI_MODELS, AI_STUDIO_API_KEY_URL, LITE_AI_MODELS, getAiModel, isLiteAiModel } from '../data/aiModels'
import {
  loadAiCredentialStatus,
  removeTeacherAiCredential,
  saveTeacherAiCredential,
  testTeacherAiCredential,
  updateTeacherAiSettings,
} from '../lib/repository'
import type { AiCredentialStatus, AiModelId, LiteAiModelId } from '../types/ai'

type Props = {
  isDemo: boolean
  onStatusChange?: (status: AiCredentialStatus) => void
  requiredMode?: boolean
}

const initialStatus: AiCredentialStatus = {
  configured: false,
  keyLast4: null,
  verifiedAt: null,
  preferredModel: 'gemini-3.5-flash-lite',
  fallbackModel: 'gemini-3.1-flash-lite',
  fallbackEnabled: true,
}

export function AiSetupPanel({ isDemo, onStatusChange, requiredMode = false }: Props) {
  const [status, setStatus] = useState<AiCredentialStatus>(initialStatus)
  const [apiKey, setApiKey] = useState('')
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState<string | null>(null)
  const [notice, setNotice] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)
  const [showKey, setShowKey] = useState(false)
  const keyInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    let mounted = true
    setLoading(true)
    loadAiCredentialStatus(isDemo)
      .then((next) => { if (mounted) { setStatus(next); onStatusChange?.(next) } })
      .catch((error) => { if (mounted) setNotice({ kind: 'error', text: error instanceof Error ? error.message : 'Unable to load AI settings.' }) })
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [isDemo, onStatusChange])

  const selectedModel = useMemo(() => getAiModel(status.preferredModel), [status.preferredModel])
  const selectedIsLite = isLiteAiModel(status.preferredModel)

  function setPreferredModel(model: AiModelId) {
    let fallbackModel = status.fallbackModel
    if (isLiteAiModel(model) && model === fallbackModel) {
      fallbackModel = model === 'gemini-3.5-flash-lite' ? 'gemini-3.1-flash-lite' : 'gemini-3.5-flash-lite'
    }
    setStatus((current) => ({ ...current, preferredModel: model, fallbackModel }))
    setNotice(null)
  }


  function cleanPastedKey(value: string) {
    return value.trim().replace(/\s+/g, '')
  }

  async function pasteFromClipboard() {
    setNotice(null)
    try {
      if (!navigator.clipboard?.readText) throw new Error('Clipboard API unavailable')
      const clipboardText = cleanPastedKey(await navigator.clipboard.readText())
      if (!clipboardText) throw new Error('Clipboard is empty')
      setApiKey(clipboardText)
      keyInputRef.current?.focus()
      setNotice({ kind: 'success', text: 'API key pasted from your clipboard. Tap Test & save key to continue.' })
    } catch {
      keyInputRef.current?.focus()
      setNotice({ kind: 'error', text: 'One-tap paste was blocked by this browser. Tap and hold inside the API key box, then choose Paste. The field is optimized for mobile text paste.' })
    }
  }

  async function saveKey() {
    if (isDemo) {
      setNotice({ kind: 'error', text: 'Sign in to the real Supabase workspace before connecting a Gemini key.' })
      return
    }
    if (apiKey.trim().length < 20) {
      setNotice({ kind: 'error', text: 'Paste your Gemini API key first.' })
      return
    }
    setWorking('save-key')
    setNotice(null)
    try {
      const result = await saveTeacherAiCredential(apiKey.trim(), {
        preferredModel: status.preferredModel,
        fallbackModel: status.fallbackModel,
        fallbackEnabled: status.fallbackEnabled,
      }, isDemo)
      setStatus(result)
      onStatusChange?.(result)
      setApiKey('')
      setNotice({ kind: 'success', text: result.message })
    } catch (error) {
      setNotice({ kind: 'error', text: error instanceof Error ? error.message : 'Unable to save Gemini key.' })
    } finally {
      setWorking(null)
    }
  }

  async function saveSettings() {
    setWorking('settings')
    setNotice(null)
    try {
      const result = await updateTeacherAiSettings({
        preferredModel: status.preferredModel,
        fallbackModel: status.fallbackModel,
        fallbackEnabled: status.fallbackEnabled,
      }, isDemo)
      setStatus(result)
      onStatusChange?.(result)
      setNotice({ kind: 'success', text: 'AI model preferences saved.' })
    } catch (error) {
      setNotice({ kind: 'error', text: error instanceof Error ? error.message : 'Unable to save AI model preferences.' })
    } finally {
      setWorking(null)
    }
  }

  async function testConnection() {
    setWorking('test')
    setNotice(null)
    try {
      const result = await testTeacherAiCredential(isDemo)
      setNotice({ kind: 'success', text: `${result.message} Tested with ${getAiModel(result.model as AiModelId).label}.` })
      const refreshed = await loadAiCredentialStatus(isDemo)
      setStatus(refreshed)
      onStatusChange?.(refreshed)
    } catch (error) {
      setNotice({ kind: 'error', text: error instanceof Error ? error.message : 'Gemini test failed.' })
    } finally {
      setWorking(null)
    }
  }

  async function removeKey() {
    if (!window.confirm('Remove your saved Gemini API key from GuroDesk? AI features will stop until you connect another key.')) return
    setWorking('remove')
    setNotice(null)
    try {
      const result = await removeTeacherAiCredential(isDemo)
      setStatus(result)
      onStatusChange?.(result)
      setApiKey('')
      setNotice({ kind: 'success', text: 'Gemini API key removed.' })
    } catch (error) {
      setNotice({ kind: 'error', text: error instanceof Error ? error.message : 'Unable to remove Gemini key.' })
    } finally {
      setWorking(null)
    }
  }

  return (
    <section className="panel ai-setup-panel">
      <div className="panel-heading ai-setup-heading">
        <div>
          <span className="eyebrow">AI Assistant</span>
          <h2>Connect your Gemini API</h2>
          <p>Your own Google API project powers your AI requests, so your quota is separate from other GuroDesk teachers.</p>
        </div>
        <span className={`ai-connection-badge ${status.configured ? 'connected' : ''}`}>
          {status.configured ? <CheckCircle2 size={14} /> : <KeyRound size={14} />}
          {status.configured ? `Connected · ••••${status.keyLast4}` : 'Not connected'}
        </span>
      </div>

      {isDemo && <div className="ai-setup-note warning"><ShieldCheck size={17} /><p>Demo mode never stores API keys. Sign in to your real GuroDesk account first.</p></div>}

      <div className="ai-key-guide">
        <div><strong>1. Get a Gemini API key</strong><span>Google AI Studio opens in a new tab.</span></div>
        <a className="button secondary" href={AI_STUDIO_API_KEY_URL} target="_blank" rel="noreferrer">
          Get Gemini API key <ExternalLink size={15} />
        </a>
      </div>

      <div className="ai-key-entry">
        <label>
          <span>2. Paste API key</span>
          <div className="ai-key-input-row">
            <input
              ref={keyInputRef}
              type={showKey ? 'text' : 'password'}
              value={apiKey}
              autoComplete="off"
              autoCapitalize="none"
              autoCorrect="off"
              inputMode="text"
              enterKeyHint="done"
              spellCheck={false}
              placeholder={status.configured ? 'Paste a new key only if you want to replace the saved key' : 'Paste Gemini API key'}
              onChange={(event) => setApiKey(event.target.value)}
              onPaste={(event) => {
                event.preventDefault()
                setApiKey(cleanPastedKey(event.clipboardData.getData('text')))
                setNotice(null)
              }}
              disabled={isDemo || Boolean(working)}
            />
            <button className="ai-key-icon-button" type="button" onClick={() => setShowKey((value) => !value)} disabled={isDemo || Boolean(working)} aria-label={showKey ? 'Hide API key' : 'Show API key'} title={showKey ? 'Hide API key' : 'Show API key'}>
              {showKey ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </div>
          <small className="mobile-paste-help">On mobile, use the Paste from clipboard button. If your browser blocks it, tap the eye icon if needed, then tap and hold this box and choose Paste.</small>
        </label>
        <div className="ai-key-entry-actions">
          <button className="button secondary" type="button" onClick={() => void pasteFromClipboard()} disabled={isDemo || Boolean(working)}>
            <ClipboardPaste size={15} /> Paste from clipboard
          </button>
          <button className="button primary" type="button" onClick={() => void saveKey()} disabled={isDemo || apiKey.trim().length < 20 || Boolean(working)}>
            {working === 'save-key' ? <span className="mini-spinner" /> : <KeyRound size={15} />}
            {status.configured ? 'Test & replace key' : 'Test & save key'}
          </button>
        </div>
      </div>
      <p className="field-help">The key is sent over the authenticated Edge Function, tested once, encrypted server-side, and never returned to your browser after saving.</p>

      <div className="ai-model-section">
        <div className="ai-section-title"><Sparkles size={17} /><div><strong>Preferred model</strong><span>Flash-Lite is prioritized for the larger free-tier call allowance.</span></div></div>
        <div className="ai-model-grid">
          {AI_MODELS.map((model) => (
            <button
              type="button"
              key={model.id}
              className={`ai-model-card ${status.preferredModel === model.id ? 'selected' : ''}`}
              onClick={() => setPreferredModel(model.id)}
              disabled={Boolean(working)}
            >
              <span className="ai-model-card-top">
                <strong>{model.label}</strong>
                {model.id === 'gemini-3.5-flash-lite' && <em>Default</em>}
              </span>
              <span>{model.thinkingLabel} · guide: {model.freeTierDailyGuide} calls/day</span>
              <small>{model.description}</small>
            </button>
          ))}
        </div>
        <p className="field-help">Daily-call numbers are guidance only; GuroDesk uses Google's actual API response as the source of truth for quota availability.</p>
      </div>

      <div className={`ai-fallback-box ${selectedIsLite ? '' : 'disabled-box'}`}>
        <div>
          <strong>Lite-model automatic fallback</strong>
          <p>{selectedIsLite ? 'If the preferred Lite model is rate-limited or temporarily unavailable, GuroDesk can try the other Lite model.' : 'Automatic fallback is intentionally disabled for the limited-call Flash models.'}</p>
        </div>
        <label className="toggle-row">
          <input
            type="checkbox"
            checked={selectedIsLite && status.fallbackEnabled}
            disabled={!selectedIsLite || Boolean(working)}
            onChange={(event) => setStatus((current) => ({ ...current, fallbackEnabled: event.target.checked }))}
          />
          <span>Enable fallback</span>
        </label>
        {selectedIsLite && status.fallbackEnabled && (
          <label className="fallback-select">Fallback model
            <select
              value={status.fallbackModel}
              disabled={Boolean(working)}
              onChange={(event) => setStatus((current) => ({ ...current, fallbackModel: event.target.value as LiteAiModelId }))}
            >
              {LITE_AI_MODELS.filter((model) => model.id !== status.preferredModel).map((model) => <option key={model.id} value={model.id}>{model.label}</option>)}
            </select>
          </label>
        )}
      </div>

      <div className="ai-settings-summary">
        <div><span>Selected</span><strong>{selectedModel.label}</strong></div>
        <div><span>Thinking</span><strong>{selectedModel.thinkingLabel}</strong></div>
        <div><span>Saved key</span><strong>{status.configured ? `••••${status.keyLast4}` : 'None'}</strong></div>
        <div><span>Last verified</span><strong>{status.verifiedAt ? new Date(status.verifiedAt).toLocaleString() : 'Not yet'}</strong></div>
      </div>

      {notice && <div className={`ai-setup-notice ${notice.kind}`}>{notice.text}</div>}

      <div className="inline-actions ai-setup-actions">
        <button className="button secondary" type="button" onClick={() => void saveSettings()} disabled={Boolean(working)}>
          {working === 'settings' ? <span className="mini-spinner" /> : <Save size={15} />} Save model settings
        </button>
        {status.configured && <button className="button ghost" type="button" onClick={() => void testConnection()} disabled={Boolean(working)}>{working === 'test' ? <span className="mini-spinner" /> : <RefreshCw size={15} />} Test saved key</button>}
        {status.configured && !requiredMode && <button className="button ghost danger-soft" type="button" onClick={() => void removeKey()} disabled={Boolean(working)}>{working === 'remove' ? <span className="mini-spinner" /> : <Trash2 size={15} />} Remove key</button>}
      </div>
    </section>
  )
}
