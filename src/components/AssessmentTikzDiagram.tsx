import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { assessmentVisualTikzSource } from '../lib/assessmentTikz'
import type { AssessmentVisual } from '../types/assessmentVisual'

const TIKZJAX_SCRIPT = 'https://tikzjax.com/v1/tikzjax.js'
const TIKZJAX_FONTS = 'https://tikzjax.com/v1/fonts.css'

function escapeHtmlAttribute(value: string) {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function tikzFrameDocument(visual: AssessmentVisual, source: string, token: string) {
  const tokenJson = JSON.stringify(token)
  const alt = escapeHtmlAttribute(visual.altText)
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="stylesheet" href="${TIKZJAX_FONTS}">
<style>
  html,body{margin:0;padding:0;background:transparent;overflow:hidden;width:100%;height:100%;}
  body{display:flex;align-items:center;justify-content:center;color:#111827;font-family:Arial,Helvetica,sans-serif;}
  svg{display:block;max-width:100%;max-height:100%;width:100%;height:100%;overflow:visible;}
</style>
<script>
(() => {
  const token = ${tokenJson};
  let settled = false;
  function finish(state) {
    if (settled) return;
    settled = true;
    parent.postMessage({ type: 'gurodesk-tikz-render', token, state }, '*');
  }
  function inspect() {
    const svg = document.querySelector('svg');
    if (svg) {
      svg.setAttribute('role', 'img');
      svg.setAttribute('aria-label', ${JSON.stringify(visual.altText)});
      svg.style.width = '100%';
      svg.style.height = '100%';
      svg.style.maxWidth = '100%';
      svg.style.maxHeight = '100%';
      finish('ready');
      return true;
    }
    return false;
  }
  new MutationObserver(inspect).observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener('load', () => { inspect(); setTimeout(() => { if (!inspect()) finish('error'); }, 12000); });
  window.addEventListener('error', () => finish('error'));
})();
</script>
<script src="${TIKZJAX_SCRIPT}" defer></script>
</head>
<body aria-label="${alt}">
<script type="text/tikz">${source}</script>
</body>
</html>`
}

export function AssessmentTikzDiagram({ visual, className = '', fallback }: { visual: AssessmentVisual; className?: string; fallback: ReactNode }) {
  const source = useMemo(() => assessmentVisualTikzSource(visual), [visual])
  const token = useMemo(() => `tikz-${visual.id}-${Math.random().toString(36).slice(2, 10)}`, [visual.id])
  const [state, setState] = useState<'loading' | 'ready' | 'error'>(source ? 'loading' : 'error')
  const srcDoc = useMemo(() => source ? tikzFrameDocument(visual, source, token) : '', [source, token, visual])

  useEffect(() => {
    setState(source ? 'loading' : 'error')
  }, [source])

  useEffect(() => {
    const listener = (event: MessageEvent) => {
      const data = event.data as { type?: string; token?: string; state?: string } | null
      if (!data || data.type !== 'gurodesk-tikz-render' || data.token !== token) return
      if (data.state === 'ready') setState('ready')
      else if (data.state === 'error') setState('error')
    }
    window.addEventListener('message', listener)
    return () => window.removeEventListener('message', listener)
  }, [token])

  return <div className={`assessment-tikz-shell ${className}`.trim()} data-renderer={state === 'ready' ? 'tikz' : 'svg-fallback'}>
    {state !== 'ready' && <div className="assessment-tikz-fallback">{fallback}</div>}
    {source && state !== 'error' && <iframe
      className={`assessment-tikz-frame${state === 'ready' ? ' is-ready' : ''}`}
      title={visual.altText}
      sandbox="allow-scripts"
      srcDoc={srcDoc}
      loading="lazy"
      referrerPolicy="no-referrer"
    />}
  </div>
}
