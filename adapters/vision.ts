/**
 * Adaptador de visión: extrae datos de facturas a partir de imágenes.
 *
 * Implementación directa via node:https → API REST de OpenRouter.
 *
 * Por qué no fetch() / AI SDK v6:
 *   Next.js 16 + Turbopack en Vercel serverless intercepta el fetch global
 *   y construye `new Headers(responseHeaders)` usando undici internamente.
 *   OpenRouter devuelve al menos un header con BOM (U+FEFF, charCode 65279)
 *   que undici rechaza: TypeError "Cannot convert argument to a ByteString".
 *   Usar node:https directamente evita ese path por completo.
 *
 * Salida estructurada: response_format json_schema.
 */

import * as https from 'node:https'
import { InvoiceSchema } from '@/core/invoice'
import type { Invoice } from '@/core/invoice'

export type ImageInput = {
  /**
   * URL pública de la imagen (string que empieza por http/https),
   * bytes Uint8Array, o string base64.
   */
  data: Uint8Array | string
  /** MIME type, p. ej. 'image/png' */
  mediaType: string
}

export type VisionExtractor = (image: ImageInput) => Promise<Invoice>

/**
 * Modelo de visión configurable por entorno.
 * Default: google/gemini-2.5-pro — extracción estructurada fiable en facturas con visión.
 */
const VISION_MODEL =
  process.env['VISION_MODEL'] ?? 'google/gemini-2.5-pro'

const OPENROUTER_API = 'https://openrouter.ai/api/v1/chat/completions'

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

Responde ÚNICAMENTE con JSON válido siguiendo exactamente el schema indicado, sin texto adicional.
`.trim()

/** Schema JSON para el modo json_schema de OpenRouter */
const JSON_SCHEMA = {
  name: 'invoice',
  strict: true,
  schema: {
    type: 'object',
    properties: {
      proveedor: { type: ['string', 'null'] },
      nif: { type: ['string', 'null'] },
      numero: { type: ['string', 'null'] },
      fecha: { type: ['string', 'null'] },
      categoria: { type: ['string', 'null'] },
      base: { type: ['number', 'null'] },
      ivaTipo: { type: ['number', 'null'] },
      ivaCuota: { type: ['number', 'null'] },
      total: { type: ['number', 'null'] },
      moneda: { type: 'string' },
    },
    required: ['proveedor', 'nif', 'numero', 'fecha', 'categoria', 'base', 'ivaTipo', 'ivaCuota', 'total', 'moneda'],
    additionalProperties: false,
  },
}

/**
 * Construye el content-part de imagen para la API de OpenRouter.
 * Soporta URL pública, Uint8Array y string base64.
 */
function buildImagePart(image: ImageInput): Record<string, unknown> {
  const { data, mediaType } = image

  // URL pública: usar image_url directamente
  if (typeof data === 'string' && (data.startsWith('http://') || data.startsWith('https://'))) {
    return {
      type: 'image_url',
      image_url: { url: data },
    }
  }

  // Bytes o base64: convertir a data URI
  let base64: string
  if (data instanceof Uint8Array) {
    // Convertir a base64 sin Buffer (disponible en Node.js pero también en Edge)
    let binary = ''
    for (let i = 0; i < data.length; i++) {
      binary += String.fromCharCode(data[i] as number)
    }
    base64 = btoa(binary)
  } else {
    base64 = data
  }

  return {
    type: 'image_url',
    image_url: { url: `data:${mediaType};base64,${base64}` },
  }
}

/**
 * Realiza una petición HTTPS sin pasar por el fetch polyfill de Next.js/undici.
 * Devuelve el body como string para que lo parsee el llamador.
 */
function httpsPost(url: string, headers: Record<string, string>, bodyStr: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url)
    const req = https.request(
      {
        hostname: parsed.hostname,
        path: parsed.pathname + parsed.search,
        method: 'POST',
        headers: {
          ...headers,
          'Content-Length': Buffer.byteLength(bodyStr),
        },
      },
      (res) => {
        const chunks: Buffer[] = []
        res.on('data', (chunk: Buffer) => chunks.push(chunk))
        res.on('end', () => {
          const body = Buffer.concat(chunks).toString('utf8')
          if ((res.statusCode ?? 0) >= 400) {
            reject(new Error(`OpenRouter HTTP ${res.statusCode}: ${body}`))
          } else {
            resolve(body)
          }
        })
      },
    )
    req.on('error', reject)
    req.write(bodyStr)
    req.end()
  })
}

/**
 * Extrae datos de una factura usando visión por IA (OpenRouter REST API via node:https).
 *
 * Usa node:https directamente para evitar el bug de BOM en headers de respuesta
 * que afecta a fetch() en Next.js 16 + Turbopack + undici con OpenRouter/Gemini.
 */
export const extract: VisionExtractor = async (image) => {
  const apiKey = process.env['OPENROUTER_API_KEY']
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY no configurada')
  }

  const imagePart = buildImagePart(image)

  const bodyObj = {
    model: VISION_MODEL,
    response_format: { type: 'json_schema', json_schema: JSON_SCHEMA },
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: EXTRACTION_PROMPT },
          imagePart,
        ],
      },
    ],
  }
  const bodyStr = JSON.stringify(bodyObj)

  const rawBody = await httpsPost(
    OPENROUTER_API,
    {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    bodyStr,
  )

  const json = JSON.parse(rawBody) as {
    choices: Array<{ message: { content: string } }>
    error?: { message: string }
  }

  if (json.error) {
    throw new Error(`OpenRouter API error: ${json.error.message}`)
  }

  const content = json.choices?.[0]?.message?.content
  if (!content) {
    throw new Error('Respuesta vacía del modelo')
  }

  // Parsear y validar con Zod
  const parsed = JSON.parse(content) as unknown
  const result = InvoiceSchema.parse(parsed)
  return result
}
