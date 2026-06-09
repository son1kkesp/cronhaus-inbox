/**
 * gen-samples.ts — Genera facturas de muestra (HTML→PNG) y sus expected.json
 *
 * Uso:
 *   pnpm tsx --env-file=.env.local scripts/gen-samples.ts images   # solo imágenes
 *   pnpm tsx --env-file=.env.local scripts/gen-samples.ts expected  # solo expected.json
 *   pnpm tsx --env-file=.env.local scripts/gen-samples.ts all       # todo (defecto)
 *
 * Requiere: OPENROUTER_API_KEY en .env.local (para el paso expected)
 */

import { chromium } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'
import { extract } from '@/adapters/vision'
import { reason, propose } from '@/core/reasoning'
import { seedLedger } from '@/core/ledger'
import type { Invoice } from '@/core/invoice'

// ─── HTML templates ───────────────────────────────────────────────────────────

const CSS_BASE = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, sans-serif; font-size: 14px; color: #1a1a1a; background: #fff; }
  .factura { width: 780px; min-height: 1100px; padding: 50px 60px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 30px; border-bottom: 3px solid #2c3e50; padding-bottom: 25px; }
  .emisor h1 { font-size: 22px; font-weight: 700; color: #2c3e50; }
  .emisor-field { display: flex; gap: 8px; margin-top: 6px; }
  .emisor-label { font-size: 12px; font-weight: 700; color: #888; text-transform: uppercase; min-width: 40px; }
  .emisor-value { font-size: 13px; color: #1a1a1a; font-weight: 600; }
  .emisor-addr { color: #555; margin-top: 4px; font-size: 12px; }
  .factura-meta { text-align: right; }
  .factura-meta .num { font-size: 26px; font-weight: 700; color: #2c3e50; }
  .factura-meta .tipo-doc { font-size: 13px; color: #888; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px; }
  .meta-field { display: flex; justify-content: flex-end; gap: 8px; margin-top: 5px; }
  .meta-label { font-size: 12px; font-weight: 700; color: #888; text-transform: uppercase; }
  .meta-value { font-size: 13px; color: #1a1a1a; font-weight: 600; }
  .receptor { background: #f8f9fa; border-radius: 6px; padding: 20px; margin-bottom: 30px; border-left: 4px solid #3498db; }
  .receptor h3 { font-size: 11px; text-transform: uppercase; color: #888; letter-spacing: 1px; margin-bottom: 8px; }
  .receptor p { font-size: 13px; color: #1a1a1a; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
  thead th { background: #2c3e50; color: #fff; padding: 10px 14px; text-align: left; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; }
  thead th:last-child { text-align: right; }
  tbody tr:nth-child(even) { background: #f8f9fa; }
  tbody td { padding: 10px 14px; border-bottom: 1px solid #e8e8e8; font-size: 13px; }
  tbody td:last-child { text-align: right; }
  .totales { display: flex; justify-content: flex-end; margin-bottom: 30px; }
  .totales-box { width: 340px; border: 1px solid #e0e0e0; border-radius: 6px; overflow: hidden; }
  .totales-row { display: flex; justify-content: space-between; padding: 8px 16px; border-bottom: 1px solid #e8e8e8; font-size: 14px; }
  .totales-row .lbl { color: #555; }
  .totales-row .val { font-weight: 600; color: #1a1a1a; }
  .totales-row.final { background: #2c3e50; color: #fff; border-bottom: none; }
  .totales-row.final .lbl { color: #fff; font-weight: 700; font-size: 15px; }
  .totales-row.final .val { color: #fff; font-weight: 700; font-size: 15px; }
  .footer { border-top: 1px solid #e8e8e8; padding-top: 20px; color: #888; font-size: 11px; text-align: center; }
  .tag-categoria { display: inline-block; background: #e8f4f8; color: #2980b9; padding: 3px 10px; border-radius: 12px; font-size: 12px; margin-bottom: 20px; font-weight: 600; }
`

// ─── Muestra 1: correcta ──────────────────────────────────────────────────────
function htmlCorrecta(): string {
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><title>Factura FAC-101</title>
<style>${CSS_BASE}</style></head>
<body>
<div class="factura">
  <div class="header">
    <div class="emisor">
      <h1>Suministros Ibéricos SL</h1>
      <div class="emisor-field">
        <span class="emisor-label">NIF:</span>
        <span class="emisor-value">B-87654321</span>
      </div>
      <p class="emisor-addr">Polígono Industrial Norte, Nave 12</p>
      <p class="emisor-addr">28050 Madrid, España</p>
      <p class="emisor-addr">Tel: +34 91 234 5678</p>
    </div>
    <div class="factura-meta">
      <div class="tipo-doc">Factura</div>
      <div class="num">FAC-101</div>
      <div class="meta-field">
        <span class="meta-label">Fecha emisión:</span>
        <span class="meta-value">2024-05-15</span>
      </div>
      <div class="meta-field">
        <span class="meta-label">Vencimiento:</span>
        <span class="meta-value">2024-06-14</span>
      </div>
    </div>
  </div>

  <div class="receptor">
    <h3>Facturado a</h3>
    <p><strong>Cronhaus SL</strong> — NIF: A-12345678</p>
    <p>Calle Mayor 42, 28001 Madrid</p>
  </div>

  <table>
    <thead>
      <tr>
        <th>Descripción</th>
        <th>Uds.</th>
        <th>Precio unitario</th>
        <th>Importe</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>Material de oficina (papel A4, bolígrafos, carpetas)</td>
        <td>1</td>
        <td>120,00 EUR</td>
        <td>120,00 EUR</td>
      </tr>
      <tr>
        <td>Tóner impresora HP LaserJet M404dn</td>
        <td>1</td>
        <td>80,00 EUR</td>
        <td>80,00 EUR</td>
      </tr>
    </tbody>
  </table>

  <div class="totales">
    <div class="totales-box">
      <div class="totales-row">
        <span class="lbl">Base imponible</span>
        <span class="val">200,00 EUR</span>
      </div>
      <div class="totales-row">
        <span class="lbl">IVA 21%</span>
        <span class="val">42,00 EUR</span>
      </div>
      <div class="totales-row final">
        <span class="lbl">TOTAL FACTURA</span>
        <span class="val">242,00 EUR</span>
      </div>
    </div>
  </div>

  <div><span class="tag-categoria">Categoría: suministros</span></div>

  <div class="footer">
    <p>Suministros Ibéricos SL — NIF B-87654321 — Registro Mercantil de Madrid, Tomo 1234, Folio 56, Hoja M-98765</p>
    <p>Forma de pago: Transferencia bancaria — IBAN: ES76 0049 1234 5678 9012 3456</p>
  </div>
</div>
</body></html>`
}

// ─── Muestra 2: sin-nif ───────────────────────────────────────────────────────
function htmlSinNif(): string {
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><title>Factura FAC-205</title>
<style>${CSS_BASE}</style></head>
<body>
<div class="factura">
  <div class="header">
    <div class="emisor">
      <h1>Consulting &amp; Servicios Digitales SL</h1>
      <p class="emisor-addr">Avda. Diagonal 567, 3º 2ª</p>
      <p class="emisor-addr">08029 Barcelona, España</p>
      <p class="emisor-addr">Tel: +34 93 456 7890</p>
      <p class="emisor-addr">contacto@csd-consulting.es</p>
    </div>
    <div class="factura-meta">
      <div class="tipo-doc">Factura</div>
      <div class="num">FAC-205</div>
      <div class="meta-field">
        <span class="meta-label">Fecha emisión:</span>
        <span class="meta-value">2024-06-20</span>
      </div>
      <div class="meta-field">
        <span class="meta-label">Vencimiento:</span>
        <span class="meta-value">2024-07-20</span>
      </div>
    </div>
  </div>

  <div class="receptor">
    <h3>Facturado a</h3>
    <p><strong>Cronhaus SL</strong> — NIF: A-12345678</p>
    <p>Calle Mayor 42, 28001 Madrid</p>
  </div>

  <table>
    <thead>
      <tr>
        <th>Descripción</th>
        <th>Horas</th>
        <th>Precio/hora</th>
        <th>Importe</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>Consultoría estratégica digital — Sprint 4</td>
        <td>8</td>
        <td>75,00 EUR</td>
        <td>600,00 EUR</td>
      </tr>
      <tr>
        <td>Auditoría de presencia web</td>
        <td>4</td>
        <td>75,00 EUR</td>
        <td>300,00 EUR</td>
      </tr>
    </tbody>
  </table>

  <div class="totales">
    <div class="totales-box">
      <div class="totales-row">
        <span class="lbl">Base imponible</span>
        <span class="val">900,00 EUR</span>
      </div>
      <div class="totales-row">
        <span class="lbl">IVA 21%</span>
        <span class="val">189,00 EUR</span>
      </div>
      <div class="totales-row final">
        <span class="lbl">TOTAL FACTURA</span>
        <span class="val">1.089,00 EUR</span>
      </div>
    </div>
  </div>

  <div><span class="tag-categoria">Categoría: servicios TI</span></div>

  <div class="footer">
    <p>Consulting &amp; Servicios Digitales SL — Registro Mercantil de Barcelona, Tomo 789, Folio 12</p>
    <p>Forma de pago: Transferencia bancaria — IBAN: ES91 2038 5678 9012 3456 7890</p>
    <p><em>Nota: El NIF fiscal del emisor está en trámite de actualización en el Registro Mercantil y no puede consignarse en este momento.</em></p>
  </div>
</div>
</body></html>`
}

// ─── Muestra 3: duplicada ─────────────────────────────────────────────────────
function htmlDuplicada(): string {
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><title>Factura FAC-012</title>
<style>${CSS_BASE}</style></head>
<body>
<div class="factura">
  <div class="header">
    <div class="emisor">
      <h1>Telefónica SA</h1>
      <div class="emisor-field">
        <span class="emisor-label">NIF:</span>
        <span class="emisor-value">A-82018474</span>
      </div>
      <p class="emisor-addr">Gran Vía 28, 28013 Madrid</p>
      <p class="emisor-addr">Tel: +34 900 512 512</p>
    </div>
    <div class="factura-meta">
      <div class="tipo-doc">Factura</div>
      <div class="num">FAC-012</div>
      <div class="meta-field">
        <span class="meta-label">Fecha emisión:</span>
        <span class="meta-value">2024-03-01</span>
      </div>
      <div class="meta-field">
        <span class="meta-label">Vencimiento:</span>
        <span class="meta-value">2024-03-31</span>
      </div>
    </div>
  </div>

  <div class="receptor">
    <h3>Facturado a</h3>
    <p><strong>Cronhaus SL</strong> — NIF: A-12345678</p>
    <p>Calle Mayor 42, 28001 Madrid</p>
  </div>

  <table>
    <thead>
      <tr>
        <th>Descripción</th>
        <th>Período</th>
        <th>Importe</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>Fibra Empresas 600 Mb/s + Telefonía fija</td>
        <td>Marzo 2024</td>
        <td>300,00 EUR</td>
      </tr>
    </tbody>
  </table>

  <div class="totales">
    <div class="totales-box">
      <div class="totales-row">
        <span class="lbl">Base imponible</span>
        <span class="val">300,00 EUR</span>
      </div>
      <div class="totales-row">
        <span class="lbl">IVA 21%</span>
        <span class="val">63,00 EUR</span>
      </div>
      <div class="totales-row final">
        <span class="lbl">TOTAL FACTURA</span>
        <span class="val">363,00 EUR</span>
      </div>
    </div>
  </div>

  <div><span class="tag-categoria">Categoría: telecomunicaciones</span></div>

  <div class="footer">
    <p>Telefónica SA — NIF A-82018474 — Domicilio Social: Gran Vía 28, 28013 Madrid</p>
    <p>Inscrita en el Registro Mercantil de Madrid, Tomo 5781, Folio 7, Hoja M-95834</p>
    <p>Forma de pago: Domiciliación bancaria</p>
  </div>
</div>
</body></html>`
}

// ─── Muestra 4: dificil (en inglés) ──────────────────────────────────────────
function htmlDificil(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Invoice INV-2024-089</title>
<style>
  ${CSS_BASE}
  .factura { font-family: 'Georgia', serif; }
  .emisor h1 { font-size: 20px; color: #1a3a5c; }
  thead th { background: #1a3a5c; }
  .totales-row.final { background: #1a3a5c; }
  .stamp { display: inline-block; border: 3px solid #27ae60; color: #27ae60; padding: 5px 18px; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; border-radius: 4px; margin-bottom: 18px; }
</style>
</head>
<body>
<div class="factura">
  <div class="header">
    <div class="emisor">
      <h1>CloudStack Solutions Ltd.</h1>
      <div class="emisor-field">
        <span class="emisor-label">VAT:</span>
        <span class="emisor-value">GB-985432100</span>
      </div>
      <p class="emisor-addr">15 Innovation Park, Tech Campus</p>
      <p class="emisor-addr">EC2A 4NE London, United Kingdom</p>
      <p class="emisor-addr">billing@cloudstack-solutions.co.uk</p>
    </div>
    <div class="factura-meta">
      <div class="tipo-doc">Invoice</div>
      <div class="num">INV-2024-089</div>
      <div class="meta-field">
        <span class="meta-label">Issue date:</span>
        <span class="meta-value">2024-07-10</span>
      </div>
      <div class="meta-field">
        <span class="meta-label">Due date:</span>
        <span class="meta-value">2024-08-09</span>
      </div>
      <div class="meta-field">
        <span class="meta-label">Currency:</span>
        <span class="meta-value">EUR</span>
      </div>
    </div>
  </div>

  <div class="receptor">
    <h3>Bill To</h3>
    <p><strong>Cronhaus SL</strong> — VAT: A-12345678</p>
    <p>Calle Mayor 42, 28001 Madrid, Spain</p>
  </div>

  <table>
    <thead>
      <tr>
        <th>Description</th>
        <th>Qty</th>
        <th>Unit Price</th>
        <th>Amount</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>Cloud Infrastructure — Professional Plan (monthly)</td>
        <td>1</td>
        <td>EUR 350.00</td>
        <td>EUR 350.00</td>
      </tr>
      <tr>
        <td>24/7 Support &amp; Monitoring add-on</td>
        <td>1</td>
        <td>EUR 150.00</td>
        <td>EUR 150.00</td>
      </tr>
    </tbody>
  </table>

  <div class="totales">
    <div class="totales-box">
      <div class="totales-row">
        <span class="lbl">Subtotal (excl. VAT)</span>
        <span class="val">EUR 500.00</span>
      </div>
      <div class="totales-row">
        <span class="lbl">VAT 21%</span>
        <span class="val">EUR 105.00</span>
      </div>
      <div class="totales-row final">
        <span class="lbl">TOTAL DUE</span>
        <span class="val">EUR 605.00</span>
      </div>
    </div>
  </div>

  <div><div class="stamp">Approved</div></div>

  <div class="footer">
    <p>CloudStack Solutions Ltd. — Registered in England &amp; Wales No. 12345678</p>
    <p>Payment by SEPA Transfer — IBAN: GB29 NWBK 6016 1331 9268 19 — BIC: NWBKGB2L</p>
    <p>For billing queries: billing@cloudstack-solutions.co.uk · +44 20 7946 0958</p>
  </div>
</div>
</body></html>`
}

// ─── Generador de imágenes con Playwright ────────────────────────────────────

const SAMPLES = [
  { id: 'correcta', html: htmlCorrecta() },
  { id: 'sin-nif', html: htmlSinNif() },
  { id: 'duplicada', html: htmlDuplicada() },
  { id: 'dificil', html: htmlDificil() },
]

async function generateImages(): Promise<void> {
  console.log('📸 Generando imágenes HTML→PNG con Playwright...')
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext()

  for (const sample of SAMPLES) {
    const dir = path.join(process.cwd(), 'samples', sample.id)
    fs.mkdirSync(dir, { recursive: true })

    const page = await context.newPage()
    await page.setViewportSize({ width: 900, height: 1200 })
    await page.setContent(sample.html, { waitUntil: 'networkidle' })

    const imgPath = path.join(dir, 'image.png')
    await page.screenshot({ path: imgPath, fullPage: true })
    await page.close()
    console.log(`  ✓ samples/${sample.id}/image.png`)
  }

  await browser.close()
  console.log('Imágenes generadas.\n')
}

// ─── Pipeline expected.json ───────────────────────────────────────────────────

async function generateExpected(): Promise<void> {
  console.log('🔍 Ejecutando pipeline de visión para generar expected.json...')
  const ledger = seedLedger()

  for (const sample of SAMPLES) {
    const imgPath = path.join(process.cwd(), 'samples', sample.id, 'image.png')
    if (!fs.existsSync(imgPath)) {
      throw new Error(`Imagen no encontrada: ${imgPath}. Ejecuta primero el paso 'images'.`)
    }

    console.log(`\n  → Procesando ${sample.id}...`)
    const data = fs.readFileSync(imgPath)
    const imageInput = { data: data as unknown as Uint8Array, mediaType: 'image/png' }

    let invoice: Invoice
    try {
      invoice = await extract(imageInput)
      console.log(`    extract() OK: proveedor="${invoice.proveedor}", numero="${invoice.numero}", total=${invoice.total}`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      // Nunca imprimir la API key
      const sanitized = msg.replace(/sk-[a-zA-Z0-9_-]+/g, 'sk-***')
      console.error(`    ERROR en extract() para ${sample.id}: ${sanitized}`)
      throw new Error(`Pipeline fallido en ${sample.id}: ${sanitized}`)
    }

    // Ajustes deterministas: si la IA no leyó algún campo crítico que conocemos
    // del HTML, corregimos y lo documentamos.
    const adjustments: string[] = []

    if (sample.id === 'correcta') {
      // Valores exactos del HTML: NIF B-87654321, FAC-101, fecha 2024-05-15, base 200, IVA 21%, cuota 42, total 242
      if (invoice.proveedor !== 'Suministros Ibéricos SL') {
        adjustments.push(`proveedor ajustado de "${invoice.proveedor}" a "Suministros Ibéricos SL"`)
        invoice.proveedor = 'Suministros Ibéricos SL'
      }
      if (invoice.nif !== 'B-87654321') {
        adjustments.push(`nif ajustado de "${invoice.nif}" a "B-87654321" (campo presente en el HTML)`)
        invoice.nif = 'B-87654321'
      }
      if (invoice.numero !== 'FAC-101') {
        adjustments.push(`numero ajustado de "${invoice.numero}" a "FAC-101"`)
        invoice.numero = 'FAC-101'
      }
      if (invoice.fecha !== '2024-05-15') {
        adjustments.push(`fecha ajustada de "${invoice.fecha}" a "2024-05-15"`)
        invoice.fecha = '2024-05-15'
      }
      if (invoice.base !== 200) {
        adjustments.push(`base ajustada de ${invoice.base} a 200`)
        invoice.base = 200
      }
      if (invoice.ivaTipo !== 21) {
        adjustments.push(`ivaTipo ajustado de ${invoice.ivaTipo} a 21`)
        invoice.ivaTipo = 21
      }
      if (invoice.ivaCuota !== 42) {
        adjustments.push(`ivaCuota ajustada de ${invoice.ivaCuota} a 42`)
        invoice.ivaCuota = 42
      }
      if (invoice.total !== 242) {
        adjustments.push(`total ajustado de ${invoice.total} a 242`)
        invoice.total = 242
      }
    }

    if (sample.id === 'sin-nif') {
      // Valores exactos del HTML: sin NIF emisor, FAC-205, fecha 2024-06-20, base 900, IVA 21%, cuota 189, total 1089
      // El NIF DEBE ser null: el HTML deliberadamente no incluye NIF del emisor
      if (invoice.nif !== null) {
        adjustments.push(`nif forzado a null (el HTML no incluye NIF del emisor — es el finding esperado)`)
        invoice.nif = null
      }
      if (invoice.numero !== 'FAC-205') {
        adjustments.push(`numero ajustado de "${invoice.numero}" a "FAC-205"`)
        invoice.numero = 'FAC-205'
      }
      if (invoice.fecha !== '2024-06-20') {
        adjustments.push(`fecha ajustada de "${invoice.fecha}" a "2024-06-20"`)
        invoice.fecha = '2024-06-20'
      }
      if (invoice.total !== 1089) {
        adjustments.push(`total ajustado de ${invoice.total} a 1089`)
        invoice.total = 1089
      }
      if (invoice.base !== 900) {
        adjustments.push(`base ajustada de ${invoice.base} a 900`)
        invoice.base = 900
      }
      if (invoice.ivaTipo !== 21) {
        adjustments.push(`ivaTipo ajustado de ${invoice.ivaTipo} a 21`)
        invoice.ivaTipo = 21
      }
      if (invoice.ivaCuota !== 189) {
        adjustments.push(`ivaCuota ajustada de ${invoice.ivaCuota} a 189`)
        invoice.ivaCuota = 189
      }
    }

    if (sample.id === 'duplicada') {
      // Campos exactos del ledger: Telefónica SA, FAC-012, NIF A-82018474, fecha 2024-03-01, base 300, IVA 21%, cuota 63, total 363
      if (invoice.proveedor !== 'Telefónica SA') {
        adjustments.push(`proveedor ajustado de "${invoice.proveedor}" a "Telefónica SA"`)
        invoice.proveedor = 'Telefónica SA'
      }
      if (invoice.nif !== 'A-82018474') {
        adjustments.push(`nif ajustado de "${invoice.nif}" a "A-82018474"`)
        invoice.nif = 'A-82018474'
      }
      if (invoice.numero !== 'FAC-012') {
        adjustments.push(`numero ajustado de "${invoice.numero}" a "FAC-012"`)
        invoice.numero = 'FAC-012'
      }
      if (invoice.fecha !== '2024-03-01') {
        adjustments.push(`fecha ajustada de "${invoice.fecha}" a "2024-03-01"`)
        invoice.fecha = '2024-03-01'
      }
      if (invoice.total !== 363) {
        adjustments.push(`total ajustado de ${invoice.total} a 363`)
        invoice.total = 363
      }
      if (invoice.base !== 300) {
        adjustments.push(`base ajustada de ${invoice.base} a 300`)
        invoice.base = 300
      }
      if (invoice.ivaTipo !== 21) {
        adjustments.push(`ivaTipo ajustado de ${invoice.ivaTipo} a 21`)
        invoice.ivaTipo = 21
      }
      if (invoice.ivaCuota !== 63) {
        adjustments.push(`ivaCuota ajustada de ${invoice.ivaCuota} a 63`)
        invoice.ivaCuota = 63
      }
    }

    if (sample.id === 'dificil') {
      // Valores exactos del HTML: CloudStack Solutions Ltd., VAT GB-985432100, INV-2024-089, fecha 2024-07-10, base 500, IVA 21%, cuota 105, total 605
      if (invoice.proveedor === null || !invoice.proveedor.includes('CloudStack')) {
        adjustments.push(`proveedor ajustado de "${invoice.proveedor}" a "CloudStack Solutions Ltd."`)
        invoice.proveedor = 'CloudStack Solutions Ltd.'
      }
      if (invoice.nif !== 'GB-985432100') {
        adjustments.push(`nif ajustado de "${invoice.nif}" a "GB-985432100"`)
        invoice.nif = 'GB-985432100'
      }
      if (invoice.numero !== 'INV-2024-089') {
        adjustments.push(`numero ajustado de "${invoice.numero}" a "INV-2024-089"`)
        invoice.numero = 'INV-2024-089'
      }
      if (invoice.fecha !== '2024-07-10') {
        adjustments.push(`fecha ajustada de "${invoice.fecha}" a "2024-07-10"`)
        invoice.fecha = '2024-07-10'
      }
      if (invoice.base !== 500) {
        adjustments.push(`base ajustada de ${invoice.base} a 500`)
        invoice.base = 500
      }
      if (invoice.ivaTipo !== 21) {
        adjustments.push(`ivaTipo ajustado de ${invoice.ivaTipo} a 21`)
        invoice.ivaTipo = 21
      }
      if (invoice.ivaCuota !== 105) {
        adjustments.push(`ivaCuota ajustada de ${invoice.ivaCuota} a 105`)
        invoice.ivaCuota = 105
      }
      if (invoice.total !== 605) {
        adjustments.push(`total ajustado de ${invoice.total} a 605`)
        invoice.total = 605
      }
    }

    if (adjustments.length > 0) {
      console.log(`    Ajustes aplicados (${adjustments.length}):`)
      adjustments.forEach((a) => console.log(`      - ${a}`))
    } else {
      console.log(`    Sin ajustes necesarios.`)
    }

    const findings = reason(invoice, ledger)
    const proposal = propose(findings)

    console.log(`    findings: [${findings.map((f) => f.tipo).join(', ')}]`)
    console.log(`    proposal.accion: ${proposal.accion}`)

    // Validaciones de coherencia
    if (sample.id === 'correcta' && proposal.accion !== 'registrar') {
      throw new Error(`FAIL correcta: se esperaba 'registrar', obtenido '${proposal.accion}'. findings=${JSON.stringify(findings)}`)
    }
    if (sample.id === 'sin-nif' && !findings.some((f) => f.tipo === 'missing')) {
      throw new Error(`FAIL sin-nif: se esperaba finding 'missing'. findings=${JSON.stringify(findings)}`)
    }
    if (sample.id === 'duplicada' && !findings.some((f) => f.tipo === 'duplicate')) {
      throw new Error(`FAIL duplicada: se esperaba finding 'duplicate'. findings=${JSON.stringify(findings)}`)
    }

    const expectedPath = path.join(process.cwd(), 'samples', sample.id, 'expected.json')
    fs.writeFileSync(
      expectedPath,
      JSON.stringify(
        {
          _meta: {
            generatedAt: new Date().toISOString(),
            adjustments: adjustments.length > 0 ? adjustments : undefined,
          },
          invoice,
          findings,
          proposal,
        },
        null,
        2,
      ),
    )
    console.log(`    ✓ samples/${sample.id}/expected.json`)
  }

  console.log('\nexpected.json generados.\n')
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const mode = process.argv[2] ?? 'all'

  if (mode === 'images' || mode === 'all') {
    await generateImages()
  }
  if (mode === 'expected' || mode === 'all') {
    await generateExpected()
  }
  if (mode !== 'images' && mode !== 'expected' && mode !== 'all') {
    console.error(`Modo desconocido: ${mode}. Usa 'images', 'expected', o 'all'.`)
    process.exit(1)
  }
}

main().catch((err) => {
  const msg = err instanceof Error ? err.message : String(err)
  console.error('\nFATAL:', msg.replace(/sk-[a-zA-Z0-9_-]+/g, 'sk-***'))
  process.exit(1)
})
