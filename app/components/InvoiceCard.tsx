'use client'

import Image from 'next/image'
import type { Invoice } from '@/core/invoice'

interface InvoiceCardProps {
  invoice: Invoice
  imagePath: string
}

const FIELD_LABELS: Record<keyof Omit<Invoice, 'confidence'>, string> = {
  proveedor: 'Proveedor',
  nif: 'NIF / VAT',
  numero: 'Nº factura',
  fecha: 'Fecha',
  categoria: 'Categoría',
  base: 'Base imponible',
  ivaTipo: 'Tipo IVA (%)',
  ivaCuota: 'Cuota IVA',
  total: 'Total',
  moneda: 'Moneda',
}

function fmt(value: string | number | null, isNumeric: boolean): {
  text: string
  missing: boolean
} {
  if (value === null || value === undefined || value === '') {
    return { text: 'no detectado', missing: true }
  }
  if (isNumeric && typeof value === 'number') {
    return { text: value.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), missing: false }
  }
  return { text: String(value), missing: false }
}

const NUMERIC_FIELDS = new Set<keyof Invoice>(['base', 'ivaTipo', 'ivaCuota', 'total'])
const CURRENCY_FIELDS = new Set<keyof Invoice>(['base', 'ivaCuota', 'total'])

export function InvoiceCard({ invoice, imagePath }: InvoiceCardProps) {
  const currency = invoice.moneda ?? 'EUR'

  return (
    <div
      className="grid grid-cols-1 gap-6 rounded-xl border border-border bg-card p-6 md:grid-cols-2"
      data-testid="invoice-card"
    >
      {/* Imagen */}
      <div className="flex items-start justify-center rounded-lg bg-muted p-4">
        <div className="relative w-full max-w-xs">
          <Image
            src={imagePath}
            alt="Factura analizada"
            width={400}
            height={560}
            className="h-auto w-full rounded-md object-contain shadow-sm"
            priority
          />
        </div>
      </div>

      {/* Campos extraídos */}
      <div className="flex flex-col gap-1">
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Campos extraídos
        </p>
        <dl className="divide-y divide-border">
          {(
            Object.entries(FIELD_LABELS) as [keyof Omit<Invoice, 'confidence'>, string][]
          ).map(([key, label]) => {
            const raw = invoice[key]
            const isNumeric = NUMERIC_FIELDS.has(key)
            const isCurrency = CURRENCY_FIELDS.has(key)
            const { text, missing } = fmt(raw as string | number | null, isNumeric)

            return (
              <div key={key} className="flex items-baseline justify-between gap-4 py-2">
                <dt className="shrink-0 text-sm text-muted-foreground">{label}</dt>
                <dd
                  className={
                    missing
                      ? 'text-sm italic text-muted-foreground/60'
                      : isNumeric
                        ? 'font-mono text-sm font-medium tabular-nums'
                        : 'text-right text-sm font-medium'
                  }
                >
                  {missing ? (
                    <span aria-label={`${label}: no detectado`}>{text}</span>
                  ) : isCurrency ? (
                    <span>
                      {text} <span className="text-xs text-muted-foreground">{currency}</span>
                    </span>
                  ) : (
                    text
                  )}
                </dd>
              </div>
            )
          })}
        </dl>
      </div>
    </div>
  )
}
