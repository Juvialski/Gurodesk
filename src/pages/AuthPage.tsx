import { ArrowRight, CheckCircle2, LockKeyhole, Sparkles } from 'lucide-react'
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
        <div className="auth-hero-inner">
          <Brand />
          <span className="hero-kicker"><Sparkles size={15} /> Built for Philippine public-school teachers</span>
          <h1>Less paperwork.<br />More time to teach.</h1>
          <p>One workspace for curriculum-aware lesson planning, TOS, assessments, results, and teacher reports.</p>
          <div className="hero-checks">
            <span><CheckCircle2 size={18} /> School-year aware</span>
            <span><CheckCircle2 size={18} /> Curriculum-grounded architecture</span>
            <span><CheckCircle2 size={18} /> Secure Supabase foundation</span>
          </div>
        </div>
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
              <label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" /></label>
              <label>Password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} /></label>
              {message && <div className="form-message">{message}</div>}
              <button className="button primary full" disabled={busy}>{busy ? 'Working…' : mode === 'signin' ? 'Sign in' : 'Create account'} <ArrowRight size={17} /></button>
              <button type="button" className="text-button" onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setMessage(null) }}>
                {mode === 'signin' ? 'Need an account? Create one' : 'Already have an account? Sign in'}
              </button>
            </form>
          )}

          <div className="demo-actions">
            {backendConfigured && <div className="divider"><span>or preview locally</span></div>}
            <button className="button secondary full" onClick={() => void enterDemo(true)}>Open sample teacher workspace</button>
            <button className="button ghost full" onClick={() => void enterDemo(false)}>Test onboarding from scratch</button>
          </div>
          <p className="privacy-note">Demo mode stores data only in this browser. Gemini keys are never placed in browser environment variables.</p>
        </div>
      </section>
    </div>
  )
}
