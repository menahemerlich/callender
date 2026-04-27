export async function sha256Hex(text) {
  const enc = new TextEncoder().encode(text)
  const buf = await crypto.subtle.digest('SHA-256', enc)
  const bytes = Array.from(new Uint8Array(buf))
  return bytes.map((b) => b.toString(16).padStart(2, '0')).join('')
}

