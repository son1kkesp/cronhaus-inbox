import type { Invoice } from './invoice'
import { makeFinding, makeProposal, type Finding, type Proposal } from './findings'
import type { LedgerEntry } from './ledger'

const TOLERANCE = 0.02
const TIPOS_IVA_LEGALES = new Set([0, 4, 10, 21])

// ─── Regla A: campos obligatorios ────────────────────────────────────────────

function reglaA(invoice: Invoice): Finding[] {
  const required: Array<keyof Invoice> = ['proveedor', 'nif', 'fecha', 'total']
  const missing = required.filter((campo) => invoice[campo] === null || invoice[campo] === undefined)
  if (missing.length === 0) return []
  return [
    makeFinding(
      'missing',
      'alta',
      `Campos obligatorios ausentes: ${missing.join(', ')}`,
      missing,
    ),
  ]
}

// ─── Regla B: cuadre base + ivaCuota ≈ total ─────────────────────────────────

function reglaB(invoice: Invoice): Finding[] {
  const { base, ivaCuota, total } = invoice
  if (base === null || ivaCuota === null || total === null) return []
  const esperado = base + ivaCuota
  if (Math.abs(esperado - total) > TOLERANCE) {
    return [
      makeFinding(
        'mismatch',
        'alta',
        `Cuadre incorrecto: base(${base}) + ivaCuota(${ivaCuota}) = ${esperado.toFixed(2)}, pero total = ${total}`,
        ['base', 'ivaCuota', 'total'],
      ),
    ]
  }
  return []
}

// ─── Regla C: IVA legal y cuota correcta ─────────────────────────────────────

function reglaC(invoice: Invoice): Finding[] {
  const { base, ivaTipo, ivaCuota } = invoice
  if (ivaTipo === null || base === null || ivaCuota === null) return []

  const findings: Finding[] = []

  if (!TIPOS_IVA_LEGALES.has(ivaTipo)) {
    findings.push(
      makeFinding(
        'anomaly',
        'media',
        `Tipo IVA no legal: ${ivaTipo}%. Tipos permitidos: 0, 4, 10, 21`,
        ['ivaTipo'],
      ),
    )
  }

  const cuotaEsperada = (base * ivaTipo) / 100
  if (Math.abs(cuotaEsperada - ivaCuota) > TOLERANCE) {
    findings.push(
      makeFinding(
        'anomaly',
        'media',
        `IVA cuota incorrecta: base(${base}) × ${ivaTipo}% = ${cuotaEsperada.toFixed(2)}, pero ivaCuota = ${ivaCuota}`,
        ['ivaCuota'],
      ),
    )
  }

  return findings
}

// ─── Regla D: duplicado ───────────────────────────────────────────────────────

function reglaD(invoice: Invoice, ledger: LedgerEntry[]): Finding[] {
  const { proveedor, numero, total } = invoice
  if (proveedor === null || numero === null || total === null) return []
  const dup = ledger.find(
    (e) => e.proveedor === proveedor && e.numero === numero && e.total === total,
  )
  if (!dup) return []
  return [
    makeFinding(
      'duplicate',
      'alta',
      `Posible duplicado: factura ${numero} de ${proveedor} por ${total} ya registrada`,
      ['proveedor', 'numero', 'total'],
    ),
  ]
}

// ─── Regla E: proveedor nuevo ─────────────────────────────────────────────────

function reglaE(invoice: Invoice, ledger: LedgerEntry[]): Finding[] {
  const { proveedor } = invoice
  if (proveedor === null) return []
  const known = ledger.some((e) => e.proveedor === proveedor)
  if (known) return []
  return [
    makeFinding(
      'new_supplier',
      'baja',
      `Proveedor nuevo no visto en el libro: ${proveedor}`,
      ['proveedor'],
    ),
  ]
}

// ─── reason() ────────────────────────────────────────────────────────────────

export function reason(invoice: Invoice, ledger: LedgerEntry[]): Finding[] {
  return [
    ...reglaA(invoice),
    ...reglaB(invoice),
    ...reglaC(invoice),
    ...reglaD(invoice, ledger),
    ...reglaE(invoice, ledger),
  ]
}

// ─── propose() ───────────────────────────────────────────────────────────────

/**
 * Prioridad de acciones:
 *   1. pedir_datos  (hay missing)
 *   2. marcar_duplicado (hay duplicate)
 *   3. revisar (hay mismatch o anomaly)
 *   4. registrar (sin findings problemáticos)
 */
export function propose(findings: Finding[]): Proposal {
  if (findings.some((f) => f.tipo === 'missing')) {
    return makeProposal('pedir_datos', 'Faltan campos obligatorios para registrar la factura')
  }
  if (findings.some((f) => f.tipo === 'duplicate')) {
    return makeProposal('marcar_duplicado', 'La factura ya existe en el libro contable')
  }
  if (findings.some((f) => f.tipo === 'mismatch' || f.tipo === 'anomaly')) {
    return makeProposal('revisar', 'Se detectaron inconsistencias que requieren revisión manual')
  }
  return makeProposal('registrar', 'La factura supera todas las validaciones automáticas')
}
