import {
  ArrowRight,
  BookOpenCheck,
  CalendarRange,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useApp } from '../contexts/AppContext'
import { Brand } from '../components/Brand'

export function AuthPage() {
  const { backendConfigured, enterDemo, signIn, signUp } = useApp()
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setMessage(null)
    try {
      if (mode === 'signin') await signIn(email, password)
      else setMessage(await signUp(email, password))
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Authentication failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-page">
      <section className="auth-hero">
        <header className="auth-hero-top">
          <Brand />
        </header>

        <div className="auth-hero-body">
          <div className="hero-kicker">
            <Sparkles size={14} className="hero-kicker-icon" />
            <span>Built for Philippine public-school teachers</span>
          </div>

          <h1 className="auth-hero-title">
            Less paperwork.
            <span className="auth-hero-highlight">More time to teach.</span>
          </h1>

          <p className="auth-hero-desc">
            One unified workspace for curriculum-aware lesson planning, Table of Specifications (TOS), DepEd assessments, and student analytics.
          </p>

          <div className="hero-feature-pills">
            <span className="hero-pill">
              <CalendarRange size={15} />
              <span>School-year aware</span>
            </span>
            <span className="hero-pill">
              <BookOpenCheck size={15} />
              <span>196 DepEd curriculum manifests</span>
            </span>
            <span className="hero-pill">
              <ShieldCheck size={15} />
              <span>Zero-leak AI boundaries</span>
            </span>
          </div>
        </div>

        <footer className="auth-hero-footer">
          <span className="auth-hero-footer-note">DepEd K-12 & Matatag Standards Compliant</span>
        </footer>
      </section>

      <section className="auth-panel-wrap">
        <div className="auth-card">
          <div className="auth-heading">
            <span className="lock-icon"><LockKeyhole size={20} /></span>
            <div>
              <h2>{backendConfigured ? (mode === 'signin' ? 'Welcome back' : 'Create teacher account') : 'Local preview'}</h2>
              <p>{backendConfigured ? 'Use your GuroDesk teacher account.' : 'Supabase is not connected yet. Explore safely with local demo data.'}</p>
            </div>
          </div>

          {backendConfigured && (
            <form onSubmit={submit} className="stack-form">
              <label>
                Email
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  placeholder="teacher@deped.gov.ph"
                />
              </label>
              <label>
                Password
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                  placeholder="••••••••"
                />
              </label>
              {message && <div className="form-message">{message}</div>}
              <button className="button primary full" disabled={busy} type="submit">
                {busy ? 'Working…' : mode === 'signin' ? 'Sign in' : 'Create account'} <ArrowRight size={17} />
              </button>
              <button
                type="button"
                className="text-button auth-switch-button"
                onClick={() => {
                  setMode(mode === 'signin' ? 'signup' : 'signin')
                  setMessage(null)
                }}
              >
                {mode === 'signin' ? 'Need an account? Create one' : 'Already have an account? Sign in'}
              </button>
            </form>
          )}

          <div className="demo-actions">
            {backendConfigured && <div className="divider"><span>or preview locally</span></div>}
            <button className="button secondary full" type="button" onClick={() => void enterDemo(true)}>
              Open sample teacher workspace
            </button>
            <button className="button ghost full" type="button" onClick={() => void enterDemo(false)}>
              Test onboarding from scratch
            </button>
          </div>

          <div className="privacy-callout">
            <ShieldCheck size={16} className="privacy-callout-icon" />
            <p className="privacy-note">
              Demo mode stores data only in this browser. Gemini API keys are never placed in client bundles.
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}
