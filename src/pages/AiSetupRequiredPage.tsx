import { KeyRound, LogOut, ShieldCheck, Sparkles } from 'lucide-react'
import { AiSetupPanel } from '../components/AiSetupPanel'
import { Brand } from '../components/Brand'
import { useApp } from '../contexts/AppContext'
import type { AiCredentialStatus } from '../types/ai'

type Props = {
  onConfigured: () => void
}

export function AiSetupRequiredPage({ onConfigured }: Props) {
  const { isDemo, signOut } = useApp()

  function statusChanged(status: AiCredentialStatus) {
    if (status.configured) onConfigured()
  }

  return (
    <div className="ai-required-page">
      <header className="ai-required-topbar">
        <Brand />
        <button className="button ghost" type="button" onClick={() => void signOut()}><LogOut size={15} /> Sign out</button>
      </header>
      <main className="ai-required-layout">
        <section className="ai-required-intro">
          <span className="hero-kicker"><Sparkles size={15} /> Final account setup</span>
          <h1>Connect Gemini before opening your workspace.</h1>
          <p>GuroDesk's suggestion buttons depend on your own Gemini API key. Setting it up now prevents AI actions from looking broken later.</p>
          <div className="ai-required-points">
            <div><span><KeyRound size={16} /></span><p><strong>Your own key</strong><small>Your Google AI quota is separate from other teachers.</small></p></div>
            <div><span><ShieldCheck size={16} /></span><p><strong>Encrypted after saving</strong><small>The saved key is never returned to the browser.</small></p></div>
          </div>
        </section>
        <div className="ai-required-panel-wrap">
          <AiSetupPanel isDemo={isDemo} requiredMode onStatusChange={statusChanged} />
        </div>
      </main>
    </div>
  )
}
