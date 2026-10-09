declare const Deno: { env: { get(name: string): string | undefined } }
const encoder = new TextEncoder()
const decoder = new TextDecoder()

export type EncryptionKeySource = 'dedicated' | 'service_role'

function toBase64(bytes: Uint8Array) {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

function fromBase64(value: string) {
  const binary = atob(value)
  return Uint8Array.from(binary, (char) => char.charCodeAt(0))
}

function secretFor(source?: EncryptionKeySource) {
  if (source === 'dedicated') {
    const dedicated = Deno.env.get('GURODESK_CREDENTIAL_ENCRYPTION_KEY')
    if (!dedicated) throw new Error('Dedicated credential encryption secret is unavailable.')
    return dedicated
  }
  if (source === 'service_role') {
    const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!serviceRole) throw new Error('Supabase service-role secret is unavailable.')
    return serviceRole
  }

  const dedicated = Deno.env.get('GURODESK_CREDENTIAL_ENCRYPTION_KEY')
  if (dedicated) return { source: 'dedicated' as const, secret: dedicated }
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!serviceRole) throw new Error('No server-side credential encryption material is available.')
  return { source: 'service_role' as const, secret: serviceRole }
}

async function importKey(secret: string) {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    encoder.encode(`gurodesk:gemini-byok:v1:${secret}`),
  )
  return crypto.subtle.importKey('raw', digest, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt'])
}

export async function encryptCredential(plaintext: string) {
  const material = secretFor() as { source: EncryptionKeySource; secret: string }
  const key = await importKey(material.secret)
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoder.encode(plaintext))
  return {
    ciphertext: toBase64(new Uint8Array(encrypted)),
    iv: toBase64(iv),
    keySource: material.source,
  }
}

export async function decryptCredential(ciphertext: string, iv: string, source: EncryptionKeySource) {
  const secret = secretFor(source) as string
  const key = await importKey(secret)
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromBase64(iv) },
    key,
    fromBase64(ciphertext),
  )
  return decoder.decode(decrypted)
}
