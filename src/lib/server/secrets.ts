import 'server-only'
import { createHmac, timingSafeEqual } from 'crypto'

/** Porównanie w stałym czasie (różna długość = false). */
export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  return left.length === right.length && timingSafeEqual(left, right)
}

/** `Authorization: Bearer <secret>` zgodny z sekretem z env (pusty sekret = zawsze false). */
export function hasBearer(header: string | null, secret: string | undefined): boolean {
  if (!secret || !header) return false
  const match = /^Bearer\s+(.+)$/i.exec(header.trim())
  return Boolean(match && safeEqual(match[1], secret))
}

// Sanity ponawia nieudane dostarczenia — nie odrzucamy ich zbyt szybko.
// Powtórzony komunikat tylko wyzwala idempotentne uzgodnienie, więc
// szerokie okno nie jest groźne.
const SIGNATURE_TOLERANCE_MS = 24 * 60 * 60 * 1000

/**
 * Podpis webhooka Sanity (`sanity-webhook-signature: t=<ms>,v1=<podpis>`),
 * gdzie podpis = HMAC-SHA256(sekret, `${t}.${body}`) w base64url
 * (tak jak @sanity/webhook; akceptujemy też zwykłe base64). `t` w milisekundach.
 */
export function verifySanitySignature(
  header: string | null,
  body: string,
  secret: string | undefined,
  now = Date.now(),
): boolean {
  if (!secret || !header) return false
  const parts = new Map<string, string>()
  for (const part of header.split(',')) {
    const index = part.indexOf('=')
    if (index > 0) parts.set(part.slice(0, index).trim(), part.slice(index + 1).trim())
  }
  const timestamp = Number(parts.get('t'))
  const signature = parts.get('v1')
  if (!Number.isFinite(timestamp) || !signature) return false
  if (Math.abs(now - timestamp) > SIGNATURE_TOLERANCE_MS) return false

  const digest = createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('base64')
  const base64url = digest.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  return safeEqual(signature, base64url) || safeEqual(signature, digest)
}
