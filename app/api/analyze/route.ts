/**
 * POST /api/analyze
 *
 * Body: { sampleId: SampleId; live?: boolean }
 *
 * Modo cacheado (sin live):
 *   - Devuelve el expected.json de la muestra (invoice + findings + proposal).
 *   - Aplica la entrada al store de sesión si la acción lo requiere.
 *   - Sin IA.
 *
 * Modo live (live: true):
 *   - Rate-limit: 3 req / 10 min por sesión (best-effort en memoria).
 *     NOTA: no garantizado entre múltiples instancias de proceso (es una demo).
 *   - Carga la imagen de la muestra vía fetch de la URL pública (CDN).
 *     (readFile no funciona en Vercel serverless ya que public/ está en CDN, no en disco.)
 *   - Llama a extract() con timeout configurable (LIVE_TIMEOUT_MS, default 30 s).
 *   - Ante error 5xx / timeout / fallo de validación → fallback al expected.json
 *     con flag fallback: true.
 *   - Si extract tiene éxito: corre reason() + propose() con seedLedger().
 */

import { isSampleId, SAMPLES } from '@/app/lib/samples'
import { getSessionId } from '@/app/lib/session'
import { getStoreForSession } from '@/app/lib/storeRegistry'
import { checkRateLimit } from '@/app/lib/rateLimiter'
import { extract } from '@/adapters/vision'
import { reason, propose } from '@/core/reasoning'
import { seedLedger } from '@/core/ledger'
import type { Invoice } from '@/core/invoice'

/**
 * Tiempo máximo de espera para la llamada a la IA en modo live.
 * Se lee en cada petición para que los tests puedan controlarlo con vi.stubEnv.
 * Default en producción: 30 000 ms.
 */
function getLiveTimeoutMs(): number {
  return Number(process.env['LIVE_TIMEOUT_MS'] ?? 30_000)
}

/**
 * Duración máxima de la función serverless en Vercel (en segundos).
 * Necesario para que la función no sea cortada antes del timeout de la IA (~10-20 s).
 */
export const maxDuration = 60

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Devuelve true si la propuesta implica añadir la factura al ledger.
 * - registrar: la factura es válida → se añade.
 * - marcar_duplicado: se registra igualmente el intento (trazabilidad).
 * - pedir_datos / revisar: datos incompletos o incorrectos → no se añade.
 */
function shouldApplyToLedger(accion: string): boolean {
  return accion === 'registrar' || accion === 'marcar_duplicado'
}

function invoiceToLedgerEntry(invoice: Invoice) {
  return {
    proveedor: invoice.proveedor ?? '',
    numero: invoice.numero ?? '',
    total: invoice.total ?? 0,
    base: invoice.base ?? 0,
    iva: invoice.ivaCuota ?? 0,
    fecha: invoice.fecha ?? '',
    categoria: invoice.categoria ?? '',
  }
}

// ─── Timeout wrapper ──────────────────────────────────────────────────────────

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms),
    ),
  ])
}

// ─── Route Handler ────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  // 1. Parsear body
  let body: { sampleId?: unknown; live?: unknown }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const { sampleId, live } = body

  // 2. Validar sampleId
  if (typeof sampleId !== 'string' || !isSampleId(sampleId)) {
    return Response.json(
      { error: `sampleId inválido. Valores permitidos: correcta, sin-nif, duplicada, dificil` },
      { status: 400 },
    )
  }

  const sample = SAMPLES[sampleId]

  // 3. Obtener sesión y store
  const sessionId = await getSessionId()
  const store = getStoreForSession(sessionId)

  // ─── Modo live ──────────────────────────────────────────────────────────────

  if (live === true) {
    // Rate-limit (best-effort en memoria por sesión)
    if (!checkRateLimit(sessionId)) {
      return Response.json(
        { error: 'Demasiadas peticiones live. Límite: 3 por 10 minutos.' },
        { status: 429 },
      )
    }

    try {
      // Cargar imagen vía fetch de la URL pública (CDN).
      // En Vercel serverless, public/ se sirve por CDN y no está en el filesystem
      // de la función → readFile daría ENOENT. fetch de la URL propia siempre funciona.
      const imageUrl = new URL(`/samples/${sampleId}.png`, request.url)
      const imageResponse = await fetch(imageUrl)
      if (!imageResponse.ok) {
        throw new Error(`No se pudo cargar la imagen: ${imageResponse.status} ${imageUrl}`)
      }
      const imageData = new Uint8Array(await imageResponse.arrayBuffer())

      // Llamar a extract con timeout configurable (leído en runtime para test-ability)
      const invoice = await withTimeout(
        extract({ data: imageData, mediaType: 'image/png' }),
        getLiveTimeoutMs(),
      )

      // Razonar con seedLedger() (no el store de sesión, para coherencia con live)
      const findings = reason(invoice, seedLedger())
      const proposal = propose(findings)

      // Aplicar al store de sesión si corresponde
      if (shouldApplyToLedger(proposal.accion)) {
        store.applyEntry(invoiceToLedgerEntry(invoice))
      }

      return Response.json({ invoice, findings, proposal })
    } catch {
      // Fallback al expected.json ante cualquier error (timeout, red, validación…)
      const { invoice, findings, proposal } = sample
      return Response.json({ invoice, findings, proposal, fallback: true })
    }
  }

  // ─── Modo cacheado (por defecto) ────────────────────────────────────────────

  const { invoice, findings, proposal } = sample

  // Aplicar al store si la propuesta lo requiere
  if (shouldApplyToLedger(proposal.accion)) {
    store.applyEntry(invoiceToLedgerEntry(invoice))
  }

  return Response.json({ invoice, findings, proposal })
}
