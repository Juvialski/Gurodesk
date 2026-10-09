/** Keep authentication/configuration in the existing Supabase client; add request identity at transport. */
export function createAiFetch(baseFetch: typeof fetch, notify: () => void): typeof fetch {
  return async (input, init) => {
    const address = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    if (!new URL(address, typeof location === 'undefined' ? 'http://localhost' : location.href).pathname.startsWith('/functions/v1/')) return baseFetch(input, init)
    const headers = new Headers(input instanceof Request ? input.headers : undefined)
    new Headers(init?.headers).forEach((value, name) => headers.set(name, value))
    if (!headers.has('x-idempotency-key')) headers.set('x-idempotency-key', crypto.randomUUID())
    try { return await baseFetch(input, { ...init, headers }) }
    finally { notify() }
  }
}

export function installAiFetch() {
  const nativeFetch = globalThis.fetch.bind(globalThis)
  globalThis.fetch = createAiFetch(nativeFetch, () => window.dispatchEvent(new Event('gurodesk-ai-usage-changed')))
}
