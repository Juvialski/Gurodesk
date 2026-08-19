import {
  CheckCircle2,
  ClipboardPaste,
  ExternalLink,
  Eye,
  EyeOff,
  KeyRound,
  ShieldCheck,
  Sparkles,
  Zap,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { AI_STUDIO_API_KEY_URL } from '../data/aiModels'
import { loadAiCredentialStatus, saveTeacherAiCredential } from '../lib/repository'
import type { AiCredentialStatus } from '../types/ai'

export type AiKeyPromptModalProps = {
  isDemo: boolean
  userId: string | null
}

export function AiKeyPromptModal({ isDemo, userId }: AiKeyPromptModalProps) {
  const [aiStatus, setAiStatus] = useState<AiCredentialStatus | null>(null)
  const [apiKey, setApiKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [working, setWorking] = useState(false)
  const [notice, setNotice] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)
  const keyInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (isDemo || !userId) return

    let mounted = true
    loadAiCredentialStatus(false)
      .then((status) => {
        if (mounted) setAiStatus(status)
      })
      .catch(() => {})

    return () => {
      mounted = false
    }
  }, [isDemo, userId])

  if (isDemo || !userId || aiStatus === null || aiStatus.configured) {
    return null
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
      setNotice({ kind: 'success', text: 'API key pasted! Tap "Verify & Connect API Key" below.' })
    } catch {
      keyInputRef.current?.focus()
      setNotice({
        kind: 'error',
        text: 'Browser blocked one-tap paste. Tap and hold inside the text box, then choose Paste.',
      })
    }
  }

  async function handleSaveKey() {
    if (apiKey.trim().length < 20) {
      setNotice({ kind: 'error', text: 'Please paste a valid Gemini API key (starts with AIzaSy...).' })
      return
    }

    setWorking(true)
    setNotice(null)

    try {
      const result = await saveTeacherAiCredential(
        apiKey.trim(),
        {
          preferredModel: aiStatus?.preferredModel || 'gemini-3.5-flash-lite',
          fallbackModel: aiStatus?.fallbackModel || 'gemini-3.1-flash-lite',
          fallbackEnabled: true,
        },
        false,
      )

      setAiStatus(result)
      setApiKey('')
      setNotice({ kind: 'success', text: 'Gemini API Key successfully verified and connected!' })
    } catch (err) {
      setNotice({
        kind: 'error',
        text: err instanceof Error ? err.message : 'Unable to verify API key. Please check the key and try again.',
      })
    } finally {
      setWorking(false)
    }
  }

  return (
    <div
      className="modal-backdrop ai-prompt-backdrop"
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.85)',
        backdropFilter: 'blur(6px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
    >
      <div
        className="modal-content panel max-w-lg w-full bg-surface border border-border shadow-2xl rounded-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        style={{ maxHeight: '90vh', overflowY: 'auto' }}
      >
        {/* Header Banner */}
        <div className="p-5 bg-gradient-to-r from-primary/15 via-primary/5 to-transparent border-b border-border">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-primary text-primary-foreground">
              <Sparkles size={22} />
            </span>
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-primary">Required Teacher Setup</span>
              <h2 className="text-lg font-bold text-foreground leading-tight">Connect Free Google Gemini API Key</h2>
            </div>
          </div>
          <p className="text-xs text-foreground-muted mt-2">
            To generate DepEd Lesson Plans (DO 42), Tables of Specifications (TOS), test questions, and handwriting OCR, connect your free personal Gemini API key.
          </p>
        </div>

        {/* Free Tier Guarantees */}
        <div className="p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            <div className="flex items-start gap-2 p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-950 dark:text-emerald-200">
              <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <strong>100% Free Forever</strong>
                <p className="text-[11px] text-foreground-muted">Google provides a free tier with high daily quotas for teachers.</p>
              </div>
            </div>
            <div className="flex items-start gap-2 p-2.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-950 dark:text-blue-200">
              <ShieldCheck size={16} className="text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
              <div>
                <strong>No Credit Card Needed</strong>
                <p className="text-[11px] text-foreground-muted">Google AI Studio never asks for billing or subscription fees.</p>
              </div>
            </div>
          </div>

          {/* Step by step guide */}
          <div className="rounded-xl border border-border bg-surface-muted/60 p-3.5 space-y-3 text-xs">
            <strong className="block font-semibold text-foreground">How to get your free API key in 30 seconds:</strong>
            <ol className="list-decimal list-inside space-y-1.5 text-foreground-muted">
              <li>
                Open Google AI Studio and tap <strong className="text-foreground">"Create API key"</strong>:
                <div className="mt-1.5">
                  <a
                    href={AI_STUDIO_API_KEY_URL}
                    target="_blank"
                    rel="noreferrer"
                    className="button primary compact inline-flex items-center gap-1 text-xs py-1 px-2.5"
                  >
                    <span>Open Google AI Studio</span>
                    <ExternalLink size={13} />
                  </a>
                </div>
              </li>
              <li>Sign in with your Google account (DepEd or personal Gmail).</li>
              <li>Copy your generated key, paste it below, and tap verify.</li>
            </ol>
          </div>

          {/* Key Input Field */}
          <div className="space-y-1.5 pt-1">
            <label className="text-xs font-semibold text-foreground block">Paste Gemini API Key</label>
            <div className="relative flex items-center">
              <input
                ref={keyInputRef}
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                autoComplete="off"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                placeholder="AIzaSy..."
                className="w-full text-sm py-2 pl-3 pr-10 rounded-lg border border-border bg-surface text-foreground font-mono focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                onChange={(e) => setApiKey(e.target.value)}
                onPaste={(e) => {
                  e.preventDefault()
                  setApiKey(cleanPastedKey(e.clipboardData.getData('text')))
                  setNotice(null)
                }}
                disabled={working}
              />
              <button
                type="button"
                className="absolute right-2 text-foreground-muted hover:text-foreground p-1"
                onClick={() => setShowKey((v) => !v)}
                aria-label={showKey ? 'Hide key' : 'Show key'}
              >
                {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            <div className="flex items-center justify-between gap-2 pt-1 text-xs">
              <button
                type="button"
                className="button ghost compact text-xs flex items-center gap-1 py-1"
                onClick={() => void pasteFromClipboard()}
                disabled={working}
              >
                <ClipboardPaste size={13} />
                <span>Paste from Clipboard</span>
              </button>
              <span className="text-[11px] text-foreground-muted">Stored with AES-256 encryption</span>
            </div>
          </div>

          {/* Status / Error Toast */}
          {notice && (
            <div
              className={`p-2.5 rounded-lg text-xs flex items-center gap-2 ${
                notice.kind === 'success'
                  ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                  : 'bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300'
              }`}
            >
              {notice.kind === 'success' ? <CheckCircle2 size={15} /> : <KeyRound size={15} />}
              <span>{notice.text}</span>
            </div>
          )}

          {/* Primary Submit Button */}
          <div className="pt-2">
            <button
              type="button"
              className="button primary w-full flex items-center justify-center gap-2 py-2.5 text-sm font-semibold rounded-lg shadow-md"
              disabled={apiKey.trim().length < 20 || working}
              onClick={() => void handleSaveKey()}
            >
              {working ? (
                <>
                  <span className="mini-spinner" />
                  <span>Verifying API Key with Google…</span>
                </>
              ) : (
                <>
                  <KeyRound size={16} />
                  <span>Verify & Connect API Key</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
