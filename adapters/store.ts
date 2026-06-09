import { seedLedger, type LedgerEntry } from '@/core/ledger'

export interface InvoiceStore {
  getLedger(): LedgerEntry[]
  applyEntry(entry: LedgerEntry): void
  toCSV(): string
}

/**
 * Crea un store en memoria aislado por sesión.
 * Arranca sembrado con seedLedger().
 */
export function createStore(): InvoiceStore {
  // Copia profunda del seed para que cada instancia sea independiente
  const entries: LedgerEntry[] = seedLedger().map((e) => ({ ...e }))

  return {
    getLedger(): LedgerEntry[] {
      // Devuelve copia superficial para evitar mutaciones externas
      return entries.map((e) => ({ ...e }))
    },

    applyEntry(entry: LedgerEntry): void {
      entries.push({ ...entry })
    },

    toCSV(): string {
      const HEADERS: Array<keyof LedgerEntry> = [
        'proveedor',
        'numero',
        'total',
        'base',
        'iva',
        'fecha',
        'categoria',
      ]

      const escapeCsv = (value: string | number): string => {
        const str = String(value)
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`
        }
        return str
      }

      const header = HEADERS.join(',')
      const rows = entries.map((entry) =>
        HEADERS.map((k) => escapeCsv(entry[k])).join(','),
      )

      return [header, ...rows].join('\n')
    },
  }
}
