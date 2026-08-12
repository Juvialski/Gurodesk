import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { assessmentVisualTikzSource } from '../lib/assessmentTikz'
import type { AssessmentVisual } from '../types/assessmentVisual'
import { cacheAssessmentTikzRenderedSvg, getAssessmentTikzRenderedSvg } from '../lib/assessmentTikzRenderCache'

const TIKZJAX_SCRIPT = 'https://tikzjax.com/v1/tikzjax.js'
const TIKZJAX_FONTS = 'https://tikzjax.com/v1/fonts.css'

function escapeHtmlAttribute(value: string) {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** JSON embedded in an inline script must not be able to terminate that tag. */
function safeScriptJson(value: string) {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029')
}

function tikzFrameDocument(visual: AssessmentVisual, source: string, token: string) {
  const tokenJson = safeScriptJson(token)
  const altJson = safeScriptJson(visual.altText)
  const sourceJson = safeScriptJson(source)
  const alt = escapeHtmlAttribute(visual.altText)
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' 'wasm-unsafe-eval' https://tikzjax.com; style-src 'unsafe-inline' https://tikzjax.com; font-src https://tikzjax.com; connect-src https://tikzjax.com; img-src data: blob:; worker-src blob:; child-src blob:; object-src 'none'; base-uri 'none'; form-action 'none'">
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
    const svg = state === 'ready' ? usableSvg() : null;
    const markup = svg ? new XMLSerializer().serializeToString(svg) : '';
    parent.postMessage({ type: 'gurodesk-tikz-render', token, state, svg: markup }, '*');
  }
  let readyTimer = 0;
  function usableSvg() {
    const svg = document.querySelector('svg');
    if (!svg || !svg.isConnected) return null;
    const marks = Array.from(svg.querySelectorAll('path,polyline,polygon,line,circle,ellipse,text'));
    if (!marks.length) return null;
    const hasVisibleMark = marks.some((mark) => {
      if (mark.tagName.toLowerCase() === 'text' && (mark.textContent || '').trim()) return true;
      try {
        const box = mark.getBBox();
        return Number.isFinite(box.width) && Number.isFinite(box.height) && (box.width > 0.25 || box.height > 0.25);
      } catch (_) { return false; }
    });
    if (!hasVisibleMark) return null;
    const viewBox = svg.viewBox && svg.viewBox.baseVal;
    if (viewBox && (!(viewBox.width > 0) || !(viewBox.height > 0))) return null;
    return svg;
  }
  function inspect() {
    const svg = usableSvg();
    if (!svg) return false;
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', ${altJson});
    svg.style.width = '100%';
    svg.style.height = '100%';
    svg.style.maxWidth = '100%';
    svg.style.maxHeight = '100%';
    window.clearTimeout(readyTimer);
    // TikZJax can briefly insert an intermediate SVG while it is still
    // replacing the compiled output. Only report ready after the rendered SVG
    // remains present for a short stability window.
    readyTimer = window.setTimeout(() => {
      const stable = usableSvg();
      if (stable === svg) finish('ready');
    }, 350);
    return true;
  }
  new MutationObserver(inspect).observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener('load', () => { inspect(); setTimeout(() => { if (!usableSvg()) finish('error'); }, 18000); });
  window.addEventListener('error', () => finish('error'), true);
})();
</script>
<script src="${TIKZJAX_SCRIPT}" defer></script>
</head>
<body aria-label="${alt}">
<script>
(() => {
  const node = document.createElement('script');
  node.type = 'text/tikz';
  node.textContent = ${sourceJson};
  document.body.appendChild(node);
})();
</script>
</body>
</html>`
}

export function AssessmentTikzDiagram({ visual, className = '', fallback }: { visual: AssessmentVisual; className?: string; fallback: ReactNode }) {
  const source = useMemo(() => assessmentVisualTikzSource(visual), [visual])
  const token = useMemo(() => `tikz-${visual.id}-${Math.random().toString(36).slice(2, 10)}`, [source, visual.id])
  const frameRef = useRef<HTMLIFrameElement>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'error'>(source ? 'loading' : 'error')
  const srcDoc = useMemo(() => source ? tikzFrameDocument(visual, source, token) : '', [source, token, visual])
  const printSvg = state === 'ready' ? getAssessmentTikzRenderedSvg(visual) : ''

  useEffect(() => {
    setState(source ? 'loading' : 'error')
  }, [source])

  useEffect(() => {
    const listener = (event: MessageEvent) => {
      const data = event.data as { type?: string; token?: string; state?: string; svg?: string } | null
      if (event.source !== frameRef.current?.contentWindow || !data || data.type !== 'gurodesk-tikz-render' || data.token !== token) return
      if (data.state === 'ready') {
        if (typeof data.svg === 'string' && data.svg) cacheAssessmentTikzRenderedSvg(visual, data.svg)
        setState('ready')
      }
      else if (data.state === 'error') setState('error')
    }
    window.addEventListener('message', listener)
    return () => window.removeEventListener('message', listener)
  }, [token, visual])

  return <div className={`assessment-tikz-shell${state === 'ready' ? ' is-tikz-ready' : ''} ${className}`.trim()} data-renderer={state === 'ready' ? 'tikz' : state === 'loading' ? 'tikz-loading' : 'svg-fallback'}>
    {/* Keep the deterministic renderer mounted underneath TikZ permanently.
        This prevents a transient/blank TikZ iframe from making the diagram
        disappear after the fallback was already visible. */}
    <div className="assessment-tikz-fallback" aria-hidden={state === 'ready'}>{fallback}</div>
    {state === 'error' && visual.tikzCode && visual.primitives.length === 0 && <div className="assessment-tikz-render-error" role="status">Diagram preview unavailable. Regenerate this diagram.</div>}
    {printSvg && <div className="assessment-tikz-print-svg" aria-hidden="true" dangerouslySetInnerHTML={{ __html: printSvg }} />}
    {source && state !== 'error' && <iframe
      ref={frameRef}
      className={`assessment-tikz-frame${state === 'ready' ? ' is-ready' : ''}`}
      title={visual.altText}
      sandbox="allow-scripts"
      srcDoc={srcDoc}
      referrerPolicy="no-referrer"
    />}
  </div>
}
