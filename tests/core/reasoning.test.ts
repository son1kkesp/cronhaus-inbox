import { describe, it, expect } from 'vitest'
import { reason, propose } from '@/core/reasoning'
import { InvoiceSchema, type Invoice } from '@/core/invoice'
import type { LedgerEntry } from '@/core/ledger'

// Helper: factura completamente válida sin deuda
const baseInvoice: Invoice = InvoiceSchema.parse({
  proveedor: 'Acme SL',
  nif: 'B12345678',
  numero: 'FAC-001',
  fecha: '2024-01-15',
  categoria: 'servicios',
  base: 100,
  ivaTipo: 21,
  ivaCuota: 21,
  total: 121,
  moneda: 'EUR',
})

const emptyLedger: LedgerEntry[] = []

// ─── Regla A: missing ────────────────────────────────────────────────────────

describe('Regla A — campos obligatorios ausentes', () => {
  it('produce Finding missing cuando nif es null', () => {
    const invoice: Invoice = { ...baseInvoice, nif: null }
    const findings = reason(invoice, emptyLedger)
    expect(findings.some((f) => f.tipo === 'missing' && f.camposAfectados.includes('nif'))).toBe(true)
  })

  it('produce Finding missing cuando fecha es null', () => {
    const invoice: Invoice = { ...baseInvoice, fecha: null }
    const findings = reason(invoice, emptyLedger)
    expect(findings.some((f) => f.tipo === 'missing' && f.camposAfectados.includes('fecha'))).toBe(true)
  })

  it('produce Finding missing cuando total es null', () => {
    const invoice: Invoice = { ...baseInvoice, total: null }
    const findings = reason(invoice, emptyLedger)
    expect(findings.some((f) => f.tipo === 'missing' && f.camposAfectados.includes('total'))).toBe(true)
  })

  it('produce Finding missing cuando proveedor es null', () => {
    const invoice: Invoice = { ...baseInvoice, proveedor: null }
    const findings = reason(invoice, emptyLedger)
    expect(findings.some((f) => f.tipo === 'missing' && f.camposAfectados.includes('proveedor'))).toBe(true)
  })

  it('no produce Finding missing cuando todos los campos obligatorios están presentes', () => {
    const findings = reason(baseInvoice, emptyLedger)
    expect(findings.some((f) => f.tipo === 'missing')).toBe(false)
  })
})

// ─── Regla B: mismatch cuadre base + ivaCuota ≈ total ───────────────────────

describe('Regla B — cuadre base + ivaCuota ≈ total (tol ±0.02)', () => {
  it('produce Finding mismatch cuando base+ivaCuota difiere del total en más de 0.02', () => {
    // base=100, ivaCuota=21, total=125 → diferencia 4 → mismatch
    const invoice: Invoice = { ...baseInvoice, base: 100, ivaCuota: 21, total: 125 }
    const findings = reason(invoice, emptyLedger)
    expect(findings.some((f) => f.tipo === 'mismatch')).toBe(true)
  })

  it('no produce mismatch cuando cuadra exacto', () => {
    // 100 + 21 = 121 exacto
    const invoice: Invoice = { ...baseInvoice, base: 100, ivaCuota: 21, total: 121 }
    const findings = reason(invoice, emptyLedger)
    expect(findings.some((f) => f.tipo === 'mismatch')).toBe(false)
  })

  it('no produce mismatch dentro de tolerancia ±0.02', () => {
    // 100 + 21 = 121, total = 121.01 → delta 0.01 → ok
    const invoice: Invoice = { ...baseInvoice, base: 100, ivaCuota: 21, total: 121.01 }
    const findings = reason(invoice, emptyLedger)
    expect(findings.some((f) => f.tipo === 'mismatch')).toBe(false)
  })

  it('omite la regla B cuando alguno de los campos necesarios es null', () => {
    const invoice: Invoice = { ...baseInvoice, base: null, ivaCuota: 21, total: 121 }
    const findings = reason(invoice, emptyLedger)
    expect(findings.some((f) => f.tipo === 'mismatch')).toBe(false)
  })
})

// ─── Regla C: IVA legal ──────────────────────────────────────────────────────

describe('Regla C — tipo IVA legal y cuota correcta (tol ±0.02)', () => {
  it('produce Finding anomaly cuando ivaTipo no es legal (ej 15)', () => {
    const invoice: Invoice = { ...baseInvoice, ivaTipo: 15, ivaCuota: 15, total: 115 }
    const findings = reason(invoice, emptyLedger)
    expect(findings.some((f) => f.tipo === 'anomaly' && f.camposAfectados.includes('ivaTipo'))).toBe(true)
  })

  it('produce Finding anomaly cuando ivaCuota no corresponde a base*ivaTipo/100', () => {
    // base=100, ivaTipo=21, cuota esperada=21, cuota real=25 → anomaly
    const invoice: Invoice = { ...baseInvoice, ivaTipo: 21, ivaCuota: 25, total: 125 }
    const findings = reason(invoice, emptyLedger)
    expect(findings.some((f) => f.tipo === 'anomaly' && f.camposAfectados.includes('ivaCuota'))).toBe(true)
  })

  it('no produce anomaly cuando tipo es legal y cuota cuadra', () => {
    // IVA 21%: base=100, cuota=21, total=121
    const findings = reason(baseInvoice, emptyLedger)
    expect(findings.some((f) => f.tipo === 'anomaly')).toBe(false)
  })

  it('acepta ivaTipo 0 (exento)', () => {
    const invoice: Invoice = { ...baseInvoice, ivaTipo: 0, ivaCuota: 0, total: 100 }
    const findings = reason(invoice, emptyLedger)
    expect(findings.some((f) => f.tipo === 'anomaly')).toBe(false)
  })

  it('omite la regla C cuando ivaTipo es null', () => {
    const invoice: Invoice = { ...baseInvoice, ivaTipo: null, ivaCuota: null }
    const findings = reason(invoice, emptyLedger)
    expect(findings.some((f) => f.tipo === 'anomaly')).toBe(false)
  })
})

// ─── Regla D: duplicado ──────────────────────────────────────────────────────

describe('Regla D — duplicado vs ledger', () => {
  const ledgerWithDuplicate: LedgerEntry[] = [
    {
      proveedor: 'Acme SL',
      numero: 'FAC-001',
      total: 121,
      base: 100,
      iva: 21,
      fecha: '2024-01-15',
      categoria: 'servicios',
    },
  ]

  it('produce Finding duplicate cuando proveedor+numero+total coinciden con un asiento del ledger', () => {
    const findings = reason(baseInvoice, ledgerWithDuplicate)
    expect(findings.some((f) => f.tipo === 'duplicate')).toBe(true)
  })

  it('no produce duplicate cuando el numero difiere', () => {
    const invoice: Invoice = { ...baseInvoice, numero: 'FAC-002' }
    const findings = reason(invoice, ledgerWithDuplicate)
    expect(findings.some((f) => f.tipo === 'duplicate')).toBe(false)
  })

  it('no produce duplicate cuando el ledger está vacío', () => {
    const findings = reason(baseInvoice, emptyLedger)
    expect(findings.some((f) => f.tipo === 'duplicate')).toBe(false)
  })
})

// ─── Regla E: new_supplier ───────────────────────────────────────────────────

describe('Regla E — proveedor nuevo vs recurrente', () => {
  const ledgerWithKnownSupplier: LedgerEntry[] = [
    {
      proveedor: 'Acme SL',
      numero: 'FAC-000',
      total: 50,
      base: 41.32,
      iva: 8.68,
      fecha: '2023-12-01',
      categoria: 'servicios',
    },
  ]

  it('produce Finding new_supplier (severidad baja) cuando el proveedor no está en el ledger', () => {
    const invoice: Invoice = { ...baseInvoice, proveedor: 'Nuevo Proveedor SL' }
    const findings = reason(invoice, ledgerWithKnownSupplier)
    const f = findings.find((f) => f.tipo === 'new_supplier')
    expect(f).toBeDefined()
    expect(f?.severidad).toBe('baja')
  })

  it('no produce new_supplier cuando el proveedor ya aparece en el ledger', () => {
    // Acme SL está en el ledger
    const findings = reason(baseInvoice, ledgerWithKnownSupplier)
    expect(findings.some((f) => f.tipo === 'new_supplier')).toBe(false)
  })

  it('no produce new_supplier cuando proveedor es null', () => {
    const invoice: Invoice = { ...baseInvoice, proveedor: null }
    const findings = reason(invoice, ledgerWithKnownSupplier)
    expect(findings.some((f) => f.tipo === 'new_supplier')).toBe(false)
  })
})

// ─── propose() ───────────────────────────────────────────────────────────────

describe('propose()', () => {
  it('propone pedir_datos cuando hay un finding missing', () => {
    const findings = [
      { tipo: 'missing' as const, severidad: 'alta' as const, mensajeHumano: 'falta NIF', camposAfectados: ['nif'] },
    ]
    const proposal = propose(findings)
    expect(proposal.accion).toBe('pedir_datos')
  })

  it('propone marcar_duplicado cuando hay un finding duplicate', () => {
    const findings = [
      { tipo: 'duplicate' as const, severidad: 'alta' as const, mensajeHumano: 'duplicado', camposAfectados: [] },
    ]
    const proposal = propose(findings)
    expect(proposal.accion).toBe('marcar_duplicado')
  })

  it('propone pedir_datos antes que marcar_duplicado cuando ambos concurren (missing tiene prioridad)', () => {
    const findings = [
      { tipo: 'missing' as const, severidad: 'alta' as const, mensajeHumano: 'falta NIF', camposAfectados: ['nif'] },
      { tipo: 'duplicate' as const, severidad: 'alta' as const, mensajeHumano: 'duplicado', camposAfectados: [] },
    ]
    const proposal = propose(findings)
    expect(proposal.accion).toBe('pedir_datos')
  })

  it('propone registrar cuando no hay findings', () => {
    const proposal = propose([])
    expect(proposal.accion).toBe('registrar')
  })

  it('propone revisar cuando solo hay anomaly o mismatch', () => {
    const findings = [
      { tipo: 'anomaly' as const, severidad: 'media' as const, mensajeHumano: 'IVA raro', camposAfectados: ['ivaTipo'] },
    ]
    const proposal = propose(findings)
    expect(proposal.accion).toBe('revisar')
  })
})
