'use client'

import type { Finding, FindingSeveridad, FindingTipo } from '@/core/findings'

interface FindingsListProps {
  findings: Finding[]
}

const SEVERITY_STYLES: Record<FindingSeveridad, string> = {
  alta: 'bg-red-50 border-red-200 text-red-800',
  media: 'bg-amber-50 border-amber-200 text-amber-800',
  baja: 'bg-blue-50 border-blue-200 text-blue-800',
}

const SEVERITY_BADGE: Record<FindingSeveridad, string> = {
  alta: 'bg-red-100 text-red-700',
  media: 'bg-amber-100 text-amber-700',
  baja: 'bg-blue-100 text-blue-700',
}

const SEVERITY_LABEL: Record<FindingSeveridad, string> = {
  alta: 'Alta',
  media: 'Media',
  baja: 'Baja',
}

const TYPE_ICON: Record<FindingTipo, string> = {
  missing: '⊘',
  mismatch: '≠',
  duplicate: '⊔',
  anomaly: '⚠',
  new_supplier: '★',
}

const TYPE_LABEL: Record<FindingTipo, string> = {
  missing: 'Campo ausente',
  mismatch: 'Discrepancia',
  duplicate: 'Duplicado',
  anomaly: 'Anomalía',
  new_supplier: 'Proveedor nuevo',
}

export function FindingsList({ findings }: FindingsListProps) {
  if (findings.length === 0) {
    return (
      <div
        className="flex items-center gap-3 rounded-xl border border-border bg-card px-5 py-4"
        data-testid="findings-list"
        role="status"
      >
        <span className="text-lg leading-none text-green-600" aria-hidden="true">✓</span>
        <p className="text-sm font-medium text-green-700">Todo cuadra — sin avisos</p>
      </div>
    )
  }

  return (
    <div data-testid="findings-list">
      <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        Avisos del razonamiento ({findings.length})
      </p>
      <ul className="flex flex-col gap-2" role="list" aria-label="Avisos detectados">
        {findings.map((f, i) => (
          <li
            key={i}
            className={`flex items-start gap-3 rounded-lg border px-4 py-3 ${SEVERITY_STYLES[f.severidad]}`}
            data-testid={`finding-item-${f.tipo}`}
          >
            {/* Icono de tipo */}
            <span
              className="mt-0.5 shrink-0 font-mono text-base leading-none"
              aria-hidden="true"
              title={TYPE_LABEL[f.tipo]}
            >
              {TYPE_ICON[f.tipo]}
            </span>
            <div className="flex flex-1 flex-col gap-1">
              <p className="text-sm font-medium leading-snug">{f.mensajeHumano}</p>
              <div className="flex flex-wrap items-center gap-1.5">
                <span
                  className={`rounded px-1.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide ${SEVERITY_BADGE[f.severidad]}`}
                >
                  {SEVERITY_LABEL[f.severidad]}
                </span>
                <span className="text-[0.65rem] uppercase tracking-wide opacity-60">
                  {TYPE_LABEL[f.tipo]}
                </span>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
