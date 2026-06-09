import { describe, it, expect } from 'vitest'
import { extractMock } from '@/adapters/vision.mock'
import { InvoiceSchema } from '@/core/invoice'

describe('extractMock', () => {
  it('devuelve una Invoice fija sin lanzar errores', async () => {
    const fakeImage = new Uint8Array([0xff, 0xd8, 0xff]) // bytes ficticios
    const result = await extractMock({ data: fakeImage, mediaType: 'image/jpeg' })
    expect(result).toBeDefined()
  })

  it('la Invoice devuelta es válida contra InvoiceSchema', async () => {
    const fakeImage = new Uint8Array([0xff, 0xd8, 0xff])
    const result = await extractMock({ data: fakeImage, mediaType: 'image/jpeg' })
    const parsed = InvoiceSchema.safeParse(result)
    expect(parsed.success).toBe(true)
  })

  it('contiene los campos esperados de la factura de muestra', async () => {
    const fakeImage = new Uint8Array([0xff, 0xd8, 0xff])
    const invoice = await extractMock({ data: fakeImage, mediaType: 'image/jpeg' })
    expect(invoice.proveedor).toBe('Acme S.L.')
    expect(invoice.nif).toBe('B12345678')
    expect(invoice.numero).toBe('FAC-2024-001')
    expect(invoice.fecha).toBe('2024-01-15')
    expect(invoice.total).toBe(121)
    expect(invoice.moneda).toBe('EUR')
  })

  it('los campos numéricos son number | null (nunca string, nunca NaN)', async () => {
    const fakeImage = new Uint8Array([0])
    const invoice = await extractMock({ data: fakeImage, mediaType: 'image/png' })
    const numericFields = [invoice.base, invoice.ivaTipo, invoice.ivaCuota, invoice.total]
    for (const field of numericFields) {
      if (field !== null) {
        expect(typeof field).toBe('number')
        expect(Number.isFinite(field)).toBe(true)
      }
    }
  })
})
