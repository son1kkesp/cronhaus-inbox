import { describe, it, expect } from 'vitest'
import { seedLedger } from '@/core/ledger'
import { InvoiceSchema } from '@/core/invoice'
import { reason } from '@/core/reasoning'

describe('seedLedger()', () => {
  it('devuelve al menos 2 asientos', () => {
    const ledger = seedLedger()
    expect(ledger.length).toBeGreaterThanOrEqual(2)
  })

  it('incluye un asiento con numero FAC-012', () => {
    const ledger = seedLedger()
    const fac012 = ledger.find((e) => e.numero === 'FAC-012')
    expect(fac012).toBeDefined()
  })

  it('el asiento FAC-012 corresponde a Telefónica SA con total 363.00', () => {
    const ledger = seedLedger()
    const fac012 = ledger.find((e) => e.numero === 'FAC-012')
    expect(fac012?.proveedor).toBe('Telefónica SA')
    expect(fac012?.total).toBe(363.0)
  })
})

// ─── Test de integración (estrella) ──────────────────────────────────────────

describe('Integración: factura duplicada contra FAC-012 del ledger', () => {
  it('reason() produce Finding duplicate cuando la factura coincide exactamente con FAC-012', () => {
    // Los valores DEBEN ser idénticos a los del asiento FAC-012 en seedLedger()
    const invoice = InvoiceSchema.parse({
      proveedor: 'Telefónica SA',
      nif: 'A28015865',
      numero: 'FAC-012',
      fecha: '2024-03-01',
      categoria: 'telecomunicaciones',
      base: 300.0,
      ivaTipo: 21,
      ivaCuota: 63.0,
      total: 363.0,
      moneda: 'EUR',
    })

    const findings = reason(invoice, seedLedger())
    const dup = findings.find((f) => f.tipo === 'duplicate')

    expect(dup).toBeDefined()
    expect(dup?.tipo).toBe('duplicate')
    expect(dup?.camposAfectados).toContain('numero')
  })
})
