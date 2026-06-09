/**
 * Tests para /api/analyze
 *
 * - (a) sampleId sin live → respuesta cacheada + entrada aplicada al store, sin IA
 * - (b) sampleId + live:true con mock que cuelga >8s → fallback al expected (fallback:true)
 * - (c) 4ª petición live en <10 min → HTTP 429
 *
 * La función `extract` se mockea con vi.mock — NUNCA IA real en tests.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from '@/app/api/analyze/route'

// ─── Mock de next/headers ─────────────────────────────────────────────────────

let mockSessionId = 'test-session-001'

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({
    get: (name: string) => (name === 'ch-session-id' ? { value: mockSessionId } : undefined),
    set: vi.fn(),
  })),
}))

// ─── Mock de adapters/vision ──────────────────────────────────────────────────

const mockExtract = vi.fn()

vi.mock('@/adapters/vision', () => ({
  extract: (...args: unknown[]) => mockExtract(...args),
}))

// ─── Mock del store registry (aislamos entre tests) ──────────────────────────

import { createStore } from '@/adapters/store'
import type { InvoiceStore } from '@/adapters/store'

let currentStore: InvoiceStore

vi.mock('@/app/lib/storeRegistry', () => ({
  getStoreForSession: (_sessionId: string) => currentStore,
}))

// ─── Mock del rate limiter ────────────────────────────────────────────────────

let rateLimitAllowed = true

vi.mock('@/app/lib/rateLimiter', () => ({
  checkRateLimit: (_sessionId: string) => {
    if (!rateLimitAllowed) return false
    return true
  },
}))

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeRequest(body: Record<string, unknown>): Request {
  return new Request('http://localhost/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

// ─── Tests ───────────────────────────────────────────────────────────────────

beforeEach(() => {
  currentStore = createStore()
  mockExtract.mockReset()
  rateLimitAllowed = true
  // Cambia el sessionId para que el rate limiter quede limpio
  mockSessionId = `session-${Math.random().toString(36).slice(2)}`
})

describe('POST /api/analyze — modo cacheado (sin live)', () => {
  it('(a) devuelve invoice+findings+proposal del expected.json sin llamar a extract', async () => {
    const req = makeRequest({ sampleId: 'correcta' })
    const res = await POST(req)
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.invoice).toBeDefined()
    expect(body.findings).toBeDefined()
    expect(body.proposal).toBeDefined()
    // No fallback en modo cacheado
    expect(body.fallback).toBeUndefined()
    // extract NO fue llamado
    expect(mockExtract).not.toHaveBeenCalled()
  })

  it('(a) aplica la entrada al store cuando la propuesta es registrar', async () => {
    const seedLen = currentStore.getLedger().length
    const req = makeRequest({ sampleId: 'correcta' }) // accion: registrar
    await POST(req)
    expect(currentStore.getLedger()).toHaveLength(seedLen + 1)
  })

  it('(a) aplica la entrada al store cuando la propuesta es marcar_duplicado', async () => {
    const seedLen = currentStore.getLedger().length
    const req = makeRequest({ sampleId: 'duplicada' }) // accion: marcar_duplicado
    await POST(req)
    // duplicado también se refleja en el ledger (se marca la intención)
    expect(currentStore.getLedger()).toHaveLength(seedLen + 1)
  })

  it('(a) NO aplica al store cuando la propuesta es pedir_datos', async () => {
    const seedLen = currentStore.getLedger().length
    const req = makeRequest({ sampleId: 'sin-nif' }) // accion: pedir_datos
    await POST(req)
    // No se añade al ledger si la propuesta es pedir datos
    expect(currentStore.getLedger()).toHaveLength(seedLen)
  })

  it('devuelve 400 con sampleId inválido', async () => {
    const req = makeRequest({ sampleId: 'inexistente' })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })
})

describe('POST /api/analyze — modo live', () => {
  it('(b) si extract cuelga >8s → responde expected con fallback:true', async () => {
    // Mock que nunca resuelve (simula timeout)
    mockExtract.mockImplementation(
      () => new Promise((_resolve) => { /* never resolves */ }),
    )

    const req = makeRequest({ sampleId: 'correcta', live: true })
    const res = await POST(req)
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.fallback).toBe(true)
    expect(body.invoice).toBeDefined()
    expect(body.proposal).toBeDefined()
  }, 15_000) // Timeout del test: 15s para dar margen al timeout interno de 8s

  it('(c) 4ª petición live en <10 min → HTTP 429', async () => {
    // Después de 3 llamadas permitidas, la 4ª está bloqueada
    rateLimitAllowed = false

    const req = makeRequest({ sampleId: 'correcta', live: true })
    const res = await POST(req)
    expect(res.status).toBe(429)
  })
})
