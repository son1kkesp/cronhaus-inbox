/**
 * Rate limiter best-effort en memoria por sesión.
 *
 * NOTA: Solo aplica a peticiones live. No es garantizado entre múltiples
 * instancias del proceso (p. ej. serverless con múltiples funciones).
 * Es suficiente para una demo de un solo proceso.
 *
 * Límite: 3 peticiones live por sesión en ventana deslizante de 10 min.
 */

const WINDOW_MS = 10 * 60 * 1000 // 10 minutos
const MAX_REQUESTS = 3

// sessionId → timestamps de peticiones live
const timestamps = new Map<string, number[]>()

/** Devuelve true si la petición está permitida (y la registra). */
export function checkRateLimit(sessionId: string): boolean {
  const now = Date.now()
  const cutoff = now - WINDOW_MS
  const prev = (timestamps.get(sessionId) ?? []).filter((t) => t > cutoff)

  if (prev.length >= MAX_REQUESTS) {
    return false
  }

  timestamps.set(sessionId, [...prev, now])
  return true
}
