import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { AiCredentialStatus } from '../types/ai'

export function AiUsageStatus({ isDemo, userId }: { isDemo: boolean; userId: string | null }) {
  const [usage, setUsage] = useState<NonNullable<AiCredentialStatus['sponsored']> | null>(null)
  const [error, setError] = useState(false)
  useEffect(() => {
    setUsage(null)
    if (isDemo || !userId || !supabase) return
    let mounted = true
    let running = false
    let timer: ReturnType<typeof setTimeout> | undefined
    const refresh = async () => {
      if (running || !mounted || !supabase) return
      running = true
      try {
        const result = await supabase.rpc('sponsored_ai_usage')
        if (mounted) { setError(Boolean(result.error)); if (!result.error) setUsage(result.data) }
      } catch { if (mounted) setError(true) }
      finally { running = false }
    }
    const schedule = () => { clearTimeout(timer); timer = setTimeout(() => void refresh(), 500) }
    void refresh()
    const interval = setInterval(() => void refresh(), 60_000)
    window.addEventListener('gurodesk-ai-usage-changed', schedule)
    window.addEventListener('focus', schedule)
    return () => { mounted = false; clearInterval(interval); clearTimeout(timer); window.removeEventListener('gurodesk-ai-usage-changed', schedule); window.removeEventListener('focus', schedule) }
  }, [isDemo, userId])
  if (isDemo || !userId) return null
  return <aside className="ai-usage-status" aria-label="Free AI allowance" aria-live="polite">
    <span>{error ? 'Free AI usage unavailable' : usage ? `Free AI calls today: ${usage.remaining} / ${usage.limit} remaining` : 'Loading free AI allowance…'}</span>
    <Link to="/settings#ai-assistance">Connect your own Gemini key</Link>
    {usage?.remaining === 0 && <p>You've used your 20 free AI calls today. Connect your own Gemini API key to continue, or use the free allowance again tomorrow.</p>}
  </aside>
}
