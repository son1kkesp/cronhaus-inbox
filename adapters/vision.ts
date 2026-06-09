/**
 * Adaptador de visión: extrae datos de facturas a partir de imágenes.
 *
 * Implementación real usando AI SDK v6 + OpenRouter.
 * API de imagen (AI SDK v7/v6): { type: 'file', mediaType: 'image/...', data: Uint8Array | string }
 * Salida estructurada: generateText + Output.object({ schema: InvoiceSchema })
 *
 * // validación real en Phase 3
 */

import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import { generateText, Output } from 'ai'
import { InvoiceSchema } from '@/core/invoice'
import type { Invoice } from '@/core/invoice'

export type ImageInput = {
  /** Bytes de la imagen o string base64 */
  data: Uint8Array | string
  /** MIME type, p. ej. 'image/jpeg', 'image/png', 'image/webp' */
  mediaType: string
}

export type VisionExtractor = (image: ImageInput) => Promise<Invoice>

/**
 * Modelo de visión configurable por entorno.
 * Default: google/gemini-2.5-flash — buen balance coste/capacidad para OCR de facturas.
 */
const VISION_MODEL =
  process.env['VISION_MODEL'] ?? 'google/gemini-2.5-flash'

const EXTRACTION_PROMPT = `
Eres un extractor de datos de facturas. Analiza la imagen adjunta y extrae los siguientes campos:

- proveedor: nombre del emisor de la factura (string o null si no se detecta)
- nif: CIF/NIF/VAT del emisor (string o null)
- numero: número de factura (string o null)
- fecha: fecha de emisión en formato ISO 8601 YYYY-MM-DD (string o null)
- categoria: categoría del gasto, p. ej. "Material oficina", "Servicios TI" (string o null)
- base: importe base imponible como número sin unidades (number o null)
- ivaTipo: tipo de IVA en porcentaje como número, p. ej. 21 (number o null)
- ivaCuota: importe de la cuota de IVA como número (number o null)
- total: importe total de la factura como número (number o null)
- moneda: código ISO 4217, p. ej. "EUR", "USD" (string, default "EUR")

REGLAS ESTRICTAS:
- Si un campo no se puede leer con seguridad → null. NUNCA inventes valores.
- Los campos numéricos deben ser números JavaScript, NUNCA strings ni NaN.
- Responde SOLO con el JSON estructurado, sin texto adicional.
`.trim()

/**
 * Extrae datos de una factura usando visión por IA (OpenRouter).
 * // validación real en Phase 3
 */
export const extract: VisionExtractor = async (image) => {
  const openrouter = createOpenRouter({
    apiKey: process.env['OPENROUTER_API_KEY'],
  })

  const { output } = await generateText({
    model: openrouter.chat(VISION_MODEL),
    output: Output.object({ schema: InvoiceSchema }),
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: EXTRACTION_PROMPT },
          {
            type: 'file',
            mediaType: image.mediaType as `image/${string}`,
            data: image.data,
          },
        ],
      },
    ],
  })

  // Output.object garantiza que el resultado cumple InvoiceSchema
  return output as Invoice
}
