/**
 * Adaptador de visión: extrae datos de facturas a partir de imágenes.
 *
 * Implementación real usando AI SDK v6 + OpenRouter.
 * API de imagen: { type: 'file', mediaType: 'image/...', data: Uint8Array | string }
 * Salida estructurada: generateObject con schema Zod (más fiable que generateText+Output.object
 * para visión en OpenRouter/Gemini, que frecuentemente devuelve texto en lugar de JSON).
 */

import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import { generateObject } from 'ai'
import { InvoiceSchema } from '@/core/invoice'
import type { Invoice } from '@/core/invoice'

export type ImageInput = {
  /**
   * Bytes de la imagen, string base64, o URL pública como string.
   * Pasar URL evita transferir bytes a través del SDK y elude el bug
   * de BOM en headers de respuesta del proveedor OpenRouter/Gemini.
   */
  data: Uint8Array | string
  /** MIME type, p. ej. 'image/jpeg', 'image/png', 'image/webp' */
  mediaType: string
}

export type VisionExtractor = (image: ImageInput) => Promise<Invoice>

/**
 * Modelo de visión configurable por entorno.
 * Default: google/gemini-2.5-pro — extracción estructurada fiable en facturas con visión.
 * gemini-2.5-flash devuelve null en la mayoría de campos numéricos/estructurados con OpenRouter.
 */
const VISION_MODEL =
  process.env['VISION_MODEL'] ?? 'google/gemini-2.5-pro'

const EXTRACTION_PROMPT = `
Eres un extractor especializado de datos de facturas y documentos fiscales.
Analiza la imagen adjunta con detalle y extrae TODOS los campos visibles.

CAMPOS A EXTRAER (lee la imagen completa, incluyendo cabecera, pie y tabla de totales):

- proveedor: nombre completo del EMISOR (quien emite la factura, no el destinatario).
  Busca el nombre de empresa en la cabecera superior izquierda. (string o null)

- nif: CIF, NIF o VAT ID del EMISOR. Busca etiquetas "NIF:", "CIF:", "VAT:", "Tax ID:"
  junto al nombre del emisor. Si la factura indica explícitamente que no tiene NIF o está en trámite → null.
  NUNCA confundas el NIF del emisor con el NIF del destinatario. (string o null)

- numero: número de factura. Busca etiquetas "Factura", "Nº", "Invoice", "Invoice No.",
  "Ref" en la cabecera. Ejemplos: "FAC-101", "INV-2024-089". (string o null)

- fecha: fecha de EMISIÓN de la factura en formato YYYY-MM-DD.
  Busca "Fecha emisión", "Issue date", "Fecha". NO uses fecha de vencimiento. (string o null)

- categoria: categoría del gasto inferida de la descripción de los artículos/servicios.
  Ejemplos: "suministros", "servicios TI", "telecomunicaciones", "consultoría". (string o null)

- base: importe BASE IMPONIBLE como número decimal sin símbolo de moneda.
  Busca "Base imponible", "Subtotal", "Subtotal (excl. VAT)".
  Ejemplo: si ves "200,00 EUR" devuelve 200. (number o null)

- ivaTipo: tipo de IVA como número entero de porcentaje.
  Busca "IVA 21%", "VAT 21%". Devuelve solo el número, p. ej. 21. (number o null)

- ivaCuota: importe de la CUOTA de IVA como número decimal.
  Busca "IVA", "VAT" en la tabla de totales, junto a la base imponible.
  Ejemplo: si ves "42,00 EUR" devuelve 42. (number o null)

- total: importe TOTAL de la factura como número decimal.
  Busca "TOTAL FACTURA", "TOTAL DUE", "Total a pagar".
  Ejemplo: si ves "242,00 EUR" devuelve 242. (number o null)

- moneda: código ISO 4217 de la moneda. Busca "EUR", "USD", etc. Default "EUR". (string)

REGLAS CRÍTICAS:
1. Lee TODA la imagen antes de responder — los datos fiscales suelen estar en la cabecera Y en el pie.
2. Si un campo está claramente presente en la imagen → extráelo. NO lo marques null si lo ves.
3. Si un campo genuinamente no aparece → null. NUNCA inventes ni calcules valores.
4. Los importes usan coma decimal en español (200,00) y punto en inglés (200.00) — devuelve siempre número JS.
5. El NIF del EMISOR y el NIF del DESTINATARIO son distintos — extrae siempre el del emisor.
`.trim()

/**
 * Extrae datos de una factura usando visión por IA (OpenRouter).
 *
 * Usa generateObject (no generateText+Output.object) para garantizar
 * salida estructurada robusta con modelos de visión en OpenRouter.
 */
export const extract: VisionExtractor = async (image) => {
  const openrouter = createOpenRouter({
    apiKey: process.env['OPENROUTER_API_KEY'],
  })

  const { object } = await generateObject({
    model: openrouter.chat(VISION_MODEL),
    schema: InvoiceSchema,
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

  return object as Invoice
}
