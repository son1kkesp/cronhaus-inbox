/**
 * Registro global de stores por sesión.
 *
 * En producción multi-instancia un store nuevo por proceso no es problema
 * para una demo: el estado es puramente efímero.
 *
 * Usa un Map en memoria — no persiste entre reinicios del servidor.
 */

import { createStore, type InvoiceStore } from '@/adapters/store'

const registry = new Map<string, InvoiceStore>()

export function getStoreForSession(sessionId: string): InvoiceStore {
  let store = registry.get(sessionId)
  if (!store) {
    store = createStore()
    registry.set(sessionId, store)
  }
  return store
}
