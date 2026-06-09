import { describe, it, expect } from 'vitest'
import { InvoiceSchema } from '@/core/invoice'

describe('InvoiceSchema', () => {
  it('valida un objeto con todos los campos nulos y moneda EUR', () => {
    const input = {
      proveedor: null,
      nif: null,
      numero: null,
      fecha: null,
      categoria: null,
      base: null,
      ivaTipo: null,
      ivaCuota: null,
      total: null,
      moneda: 'EUR',
    }
    const result = InvoiceSchema.safeParse(input)
    expect(result.success).toBe(true)
  })

  it('rechaza cuando total es un string crudo', () => {
    const input = { total: 'cien' }
    const result = InvoiceSchema.safeParse(input)
    expect(result.success).toBe(false)
  })

  it('rechaza cuando total es NaN', () => {
    const input = { total: NaN }
    const result = InvoiceSchema.safeParse(input)
    expect(result.success).toBe(false)
  })

  it('aplica moneda EUR por defecto cuando no se pasa moneda', () => {
    const result = InvoiceSchema.safeParse({})
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.moneda).toBe('EUR')
    }
  })
})
