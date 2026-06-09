/**
 * Tests para el handler de la tool MCP `reason_invoice`.
 *
 * Estrategia: testamos la función pura `handleReasonInvoice(invoice)`
 * exportada desde adapters/mcp-server.ts, no el transporte stdio.
 */
import { describe, it, expect } from 'vitest'
import { handleReasonInvoice } from '@/adapters/mcp-server'
import type { Invoice } from '@/core/invoice'

// Factura limpia — usa un proveedor conocido del seedLedger para que no
// dispare new_supplier, y pasa todas las reglas numéricas. Debe proponer "registrar".
const invoiceLimpia: Invoice = {
  proveedor: 'Suministros Ibéricos SL', // proveedor del seedLedger → no dispara new_supplier
  nif: 'B12345678',
  numero: 'FAC-100',                    // número distinto → no dispara duplicate
  fecha: '2024-06-01',
  categoria: 'suministros',
  base: 100,
  ivaTipo: 21,
  ivaCuota: 21,
  total: 121,
  moneda: 'EUR',
}

// Factura duplicada — coincide exactamente con el asiento FAC-012 del seedLedger
const invoiceDuplicada: Invoice = {
  proveedor: 'Telefónica SA',
  nif: 'A12345678',
  numero: 'FAC-012',
  fecha: '2024-03-01',
  categoria: 'telecomunicaciones',
  base: 300,
  ivaTipo: 21,
  ivaCuota: 63,
  total: 363,
  moneda: 'EUR',
}

// Factura con campos obligatorios ausentes
const invoiceIncompleta: Invoice = {
  proveedor: null,
  nif: null,
  numero: 'FAC-001',
  fecha: null,
  categoria: null,
  base: null,
  ivaTipo: null,
  ivaCuota: null,
  total: null,
  moneda: 'EUR',
}

describe('handleReasonInvoice', () => {
  it('devuelve proposal=registrar para una factura limpia sin anomalías', () => {
    const result = handleReasonInvoice(invoiceLimpia)
    // No debe haber findings problemáticos (missing, duplicate, mismatch, anomaly)
    const problematicos = result.findings.filter(
      (f) => f.tipo !== 'new_supplier',
    )
    expect(problematicos).toHaveLength(0)
    expect(result.proposal.accion).toBe('registrar')
  })

  it('detecta duplicado para FAC-012 de Telefónica SA / 363 €', () => {
    const result = handleReasonInvoice(invoiceDuplicada)
    const dupFinding = result.findings.find((f) => f.tipo === 'duplicate')
    expect(dupFinding).toBeDefined()
    expect(result.proposal.accion).toBe('marcar_duplicado')
  })

  it('detecta campos obligatorios ausentes y propone pedir_datos', () => {
    const result = handleReasonInvoice(invoiceIncompleta)
    const missingFinding = result.findings.find((f) => f.tipo === 'missing')
    expect(missingFinding).toBeDefined()
    expect(result.proposal.accion).toBe('pedir_datos')
  })

  it('devuelve un objeto con findings (array) y proposal (objeto con accion y motivo)', () => {
    const result = handleReasonInvoice(invoiceLimpia)
    expect(Array.isArray(result.findings)).toBe(true)
    expect(result.proposal).toHaveProperty('accion')
    expect(result.proposal).toHaveProperty('motivo')
  })
})
