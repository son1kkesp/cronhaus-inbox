/**
 * LedgerEntry — asiento registrado en el libro contable.
 *
 * Asiento FAC-012 (referencia para Phase 3):
 *   proveedor : 'Telefónica SA'
 *   numero    : 'FAC-012'
 *   total     : 363.00
 *   base      : 300.00
 *   iva       : 63.00   (21 %)
 *   fecha     : '2024-03-01'
 *   categoria : 'telecomunicaciones'
 */
export interface LedgerEntry {
  proveedor: string
  numero: string
  total: number
  base: number
  iva: number
  fecha: string
  categoria: string
}

/**
 * seedLedger — devuelve asientos fijos de prueba.
 * Incluye FAC-012 (ver documentación arriba) para tests de duplicado.
 */
export function seedLedger(): LedgerEntry[] {
  return [
    {
      proveedor: 'Suministros Ibéricos SL',
      numero: 'FAC-007',
      total: 484.0,
      base: 400.0,
      iva: 84.0,
      fecha: '2024-01-10',
      categoria: 'suministros',
    },
    {
      // Asiento de referencia Phase 3 — mantener sincronizado con samples/
      proveedor: 'Telefónica SA',
      numero: 'FAC-012',
      total: 363.0,
      base: 300.0,
      iva: 63.0,
      fecha: '2024-03-01',
      categoria: 'telecomunicaciones',
    },
  ]
}
