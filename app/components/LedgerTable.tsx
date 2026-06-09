'use client'

import { useRef, useEffect } from 'react'

export interface LedgerEntry {
  proveedor: string
  numero: string
  fecha: string
  categoria: string
  base: number
  iva: number
  total: number
}

interface LedgerTableProps {
  entries: LedgerEntry[]
  /** id de la fila más reciente (para animar) */
  latestId?: string
}

function fmtEur(n: number) {
  return n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function ExportButton({ entries }: { entries: LedgerEntry[] }) {
  function download() {
    const header = 'Proveedor,Nº Factura,Fecha,Categoría,Base,IVA,Total\n'
    const rows = entries
      .map((e) =>
        [
          `"${e.proveedor}"`,
          `"${e.numero}"`,
          `"${e.fecha}"`,
          `"${e.categoria}"`,
          e.base,
          e.iva,
          e.total,
        ].join(','),
      )
      .join('\n')

    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'cronhaus-libro-gastos.csv'
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <button
      onClick={download}
      className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      aria-label="Exportar libro de gastos como CSV"
      data-testid="export-csv-button"
    >
      <span aria-hidden="true">↓</span> Exportar CSV
    </button>
  )
}

export function LedgerTable({ entries, latestId }: LedgerTableProps) {
  const latestRef = useRef<HTMLTableRowElement>(null)

  useEffect(() => {
    if (latestRef.current) {
      latestRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [latestId])

  const total = entries.reduce((acc, e) => acc + e.total, 0)

  return (
    <div className="rounded-xl border border-border bg-card" data-testid="ledger-table">
      <div className="flex items-center justify-between border-b border-border px-5 py-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Libro de gastos
          </p>
          <p className="text-xs text-muted-foreground/60">
            {entries.length} {entries.length === 1 ? 'entrada' : 'entradas'}
          </p>
        </div>
        <ExportButton entries={entries} />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm" aria-label="Libro de gastos">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <th className="px-4 py-2.5">Proveedor</th>
              <th className="px-4 py-2.5">Nº Factura</th>
              <th className="px-4 py-2.5">Fecha</th>
              <th className="px-4 py-2.5">Categoría</th>
              <th className="px-4 py-2.5 text-right">Base</th>
              <th className="px-4 py-2.5 text-right">IVA</th>
              <th className="px-4 py-2.5 text-right">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {entries.map((e, i) => {
              const rowKey = `${e.proveedor}-${e.numero}-${i}`
              const isLatest = latestId === rowKey
              return (
                <tr
                  key={rowKey}
                  ref={isLatest ? latestRef : undefined}
                  className={`transition-colors duration-300 ${
                    isLatest ? 'animate-[highlight_1.2s_ease-out] bg-primary/5' : 'hover:bg-muted/30'
                  }`}
                  data-testid={isLatest ? 'ledger-latest-row' : undefined}
                >
                  <td className="max-w-[140px] truncate px-4 py-2.5 font-medium">{e.proveedor}</td>
                  <td className="px-4 py-2.5 font-mono text-xs">{e.numero || '—'}</td>
                  <td className="px-4 py-2.5 font-mono text-xs">{e.fecha || '—'}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{e.categoria || '—'}</td>
                  <td className="px-4 py-2.5 text-right font-mono tabular-nums">
                    {fmtEur(e.base)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono tabular-nums">{fmtEur(e.iva)}</td>
                  <td className="px-4 py-2.5 text-right font-mono font-semibold tabular-nums">
                    {fmtEur(e.total)}
                  </td>
                </tr>
              )
            })}
          </tbody>
          {entries.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-border bg-muted/20 text-sm font-semibold">
                <td colSpan={4} className="px-4 py-2.5 text-muted-foreground">
                  Total ({entries.length})
                </td>
                <td className="px-4 py-2.5 text-right font-mono tabular-nums">
                  {fmtEur(entries.reduce((a, e) => a + e.base, 0))}
                </td>
                <td className="px-4 py-2.5 text-right font-mono tabular-nums">
                  {fmtEur(entries.reduce((a, e) => a + e.iva, 0))}
                </td>
                <td className="px-4 py-2.5 text-right font-mono tabular-nums">
                  {fmtEur(total)}
                </td>
              </tr>
            </tfoot>
          )}
        </table>

        {entries.length === 0 && (
          <p className="px-5 py-8 text-center text-sm text-muted-foreground">
            Sin entradas todavía. Analiza una factura para ver el libro.
          </p>
        )}
      </div>
    </div>
  )
}
