/**
 * Gestión de sesión efímera.
 *
 * Usa una cookie de sesión (sin datos personales) para identificar
 * al cliente entre peticiones. El ID es un UUID v4 generado en el
 * primer acceso y almacenado en cookie HttpOnly + SameSite=Strict.
 *
 * Sin persistencia: al reiniciar el servidor el ledger vuelve al seed.
 */

import { cookies } from 'next/headers'

const SESSION_COOKIE = 'ch-session-id'

/**
 * Devuelve el ID de sesión actual, creando uno nuevo si no existe.
 * Llama a cookies() de next/headers (async en Next 16).
 */
export async function getSessionId(): Promise<string> {
  const cookieStore = await cookies()
  const existing = cookieStore.get(SESSION_COOKIE)
  if (existing?.value) {
    return existing.value
  }
  // Genera un nuevo UUID v4
  const id = crypto.randomUUID()
  cookieStore.set(SESSION_COOKIE, id, {
    httpOnly: true,
    sameSite: 'strict',
    path: '/',
    // Sin maxAge → cookie de sesión (se elimina al cerrar el navegador)
  })
  return id
}
