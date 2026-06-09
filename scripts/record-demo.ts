/**
 * record-demo.ts
 * Captura screenshots de la demo de Cronhaus Inbox y los guarda en docs/.
 * Uso: pnpm tsx scripts/record-demo.ts
 *
 * Requiere que la app esté corriendo en http://localhost:3000
 */

import { chromium } from '@playwright/test'
import * as path from 'path'
import * as fs from 'fs'

const BASE_URL = 'http://localhost:3000'
const DOCS_DIR = path.resolve(process.cwd(), 'docs')

async function main() {
  // Asegurar que docs/ existe
  if (!fs.existsSync(DOCS_DIR)) {
    fs.mkdirSync(DOCS_DIR, { recursive: true })
  }

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    deviceScaleFactor: 1,
  })
  const page = await context.newPage()

  console.log('Navegando a la home…')
  await page.goto(BASE_URL, { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)

  // Screenshot 1: Hero / home inicial
  await page.screenshot({
    path: path.join(DOCS_DIR, 'demo-1-home.png'),
    fullPage: false,
  })
  console.log('  → demo-1-home.png')

  // ─── Muestra: DUPLICADA ───────────────────────────────────────────────────
  console.log('Seleccionando muestra: duplicada…')
  // Buscar botón que contenga texto "Duplicada" o "duplicada" en el selector
  const dupBtn = page.locator('button', { hasText: /duplicad/i }).first()
  await dupBtn.waitFor({ state: 'visible', timeout: 10_000 })
  await dupBtn.click()

  // Esperar resultado de análisis
  await page.waitForSelector('[data-testid="analysis-result"]', { timeout: 20_000 })
  await page.waitForTimeout(600)

  // Screenshot 2: resultado completo de la duplicada (scroll al top primero)
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.waitForTimeout(300)
  await page.screenshot({
    path: path.join(DOCS_DIR, 'demo-2-duplicada-top.png'),
    fullPage: false,
  })
  console.log('  → demo-2-duplicada-top.png')

  // Screenshot 3: scroll abajo para ver findings + ledger
  await page.evaluate(() => window.scrollTo(0, 600))
  await page.waitForTimeout(300)
  await page.screenshot({
    path: path.join(DOCS_DIR, 'demo-3-duplicada-findings.png'),
    fullPage: false,
  })
  console.log('  → demo-3-duplicada-findings.png')

  // Screenshot 4: ledger (final de página)
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
  await page.waitForTimeout(300)
  await page.screenshot({
    path: path.join(DOCS_DIR, 'demo-4-ledger.png'),
    fullPage: false,
  })
  console.log('  → demo-4-ledger.png')

  // ─── Muestra: CORRECTA ───────────────────────────────────────────────────
  console.log('Seleccionando muestra: correcta…')
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.waitForTimeout(200)
  const corrBtn = page.locator('button', { hasText: /correct/i }).first()
  await corrBtn.waitFor({ state: 'visible', timeout: 10_000 })
  await corrBtn.click()

  await page.waitForSelector('[data-testid="analysis-result"]', { timeout: 20_000 })
  await page.waitForTimeout(600)

  await page.evaluate(() => window.scrollTo(0, 0))
  await page.waitForTimeout(300)
  await page.screenshot({
    path: path.join(DOCS_DIR, 'demo-5-correcta.png'),
    fullPage: false,
  })
  console.log('  → demo-5-correcta.png')

  // Screenshot 6: ledger actualizado con ambas entradas
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
  await page.waitForTimeout(300)
  await page.screenshot({
    path: path.join(DOCS_DIR, 'demo-6-ledger-final.png'),
    fullPage: false,
  })
  console.log('  → demo-6-ledger-final.png')

  await browser.close()
  console.log('\nCaptura completada. Archivos en docs/')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
