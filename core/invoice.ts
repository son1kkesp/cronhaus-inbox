import { z } from 'zod'

const nullableString = z.string().nullable().default(null)
const nullableFiniteNumber = z.number().finite().nullable().default(null)

export const InvoiceSchema = z.object({
  proveedor: nullableString,
  nif: nullableString,
  numero: nullableString,
  fecha: nullableString,
  categoria: nullableString,
  base: nullableFiniteNumber,
  ivaTipo: nullableFiniteNumber,
  ivaCuota: nullableFiniteNumber,
  total: nullableFiniteNumber,
  moneda: z.string().default('EUR'),
  confidence: z.record(z.string(), z.number()).optional(),
})

export type Invoice = z.infer<typeof InvoiceSchema>
