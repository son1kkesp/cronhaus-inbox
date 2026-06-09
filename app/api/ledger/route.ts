/**
 * GET /api/ledger
 *
 * Devuelve el libro de gastos de la sesión actual.
 * Arranca sembrado con seedLedger(); se actualiza via POST /api/analyze.
 */

import { getSessionId } from '@/app/lib/session'
import { getStoreForSession } from '@/app/lib/storeRegistry'

export async function GET() {
  const sessionId = await getSessionId()
  const store = getStoreForSession(sessionId)
  return Response.json({ entries: store.getLedger() })
}
