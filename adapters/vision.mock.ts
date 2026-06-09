import type { Invoice } from '@/core/invoice'
import type { ImageInput, VisionExtractor } from '@/adapters/vision'

/**
 * Implementación mock del extractor de visión.
 * Devuelve una Invoice fija y válida, útil para tests y desarrollo local.
 */
const MOCK_INVOICE: Invoice = {
  proveedor: 'Acme S.L.',
  nif: 'B12345678',
  numero: 'FAC-2024-001',
  fecha: '2024-01-15',
  categoria: 'Servicios TI',
  base: 100,
  ivaTipo: 21,
  ivaCuota: 21,
  total: 121,
  moneda: 'EUR',
}

export const extractMock: VisionExtractor = async (
  _image: ImageInput,
): Promise<Invoice> => {
  return { ...MOCK_INVOICE }
}
