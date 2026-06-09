import { test, expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function clickSample(page: Page, sampleId: string) {
  await page.click(`[data-testid="sample-btn-${sampleId}"]`)
  // Esperar a que aparezca el resultado (timeout 10s)
  await page.waitForSelector('[data-testid="analysis-result"]', { timeout: 10_000 })
}

// ─── Tests ───────────────────────────────────────────────────────────────────

test.describe('Cronhaus Inbox — Demo UI (modo cacheado)', () => {
  test.beforeEach(async ({ page }) => {
    // Mockear fetch ANTES de navegar para que el script esté activo al hidratar
    await page.addInitScript(() => {
      const originalFetch = window.fetch
      window.fetch = async (input, init) => {
        // Si body contiene live:true, interceptamos y devolvemos 429
        if (init?.body && typeof init.body === 'string') {
          try {
            const parsed = JSON.parse(init.body) as Record<string, unknown>
            if (parsed['live'] === true) {
              return new Response(
                JSON.stringify({ error: 'Demasiadas peticiones live. Límite: 3 por 10 minutos.' }),
                { status: 429, headers: { 'Content-Type': 'application/json' } },
              )
            }
          } catch {
            // noop
          }
        }
        return originalFetch(input, init)
      }
    })
    await page.goto('/')
  })

  test('hero: muestra titular y nota de privacidad', async ({ page }) => {
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Sube una factura')
    await expect(page.getByText(/privacidad/i).first()).toBeVisible()
    await expect(page.getByText(/efímero/i).first()).toBeVisible()
  })

  test('selector: 4 muestras visibles', async ({ page }) => {
    for (const id of ['correcta', 'sin-nif', 'duplicada', 'dificil']) {
      await expect(page.locator(`[data-testid="sample-btn-${id}"]`)).toBeVisible()
    }
  })

  test('ledger: libro visible al cargar (con filas seed)', async ({ page }) => {
    await expect(page.locator('[data-testid="ledger-table"]')).toBeVisible()
    // El seed tiene 2 entradas: FAC-007 y FAC-012
    await expect(page.getByRole('table')).toBeVisible()
    await expect(page.getByText('Telefónica SA').first()).toBeVisible()
  })

  // ─── Muestra: correcta ───────────────────────────────────────────────────

  test('correcta: extracción y registro OK', async ({ page }) => {
    await clickSample(page, 'correcta')

    // Campos extraídos
    const card = page.locator('[data-testid="invoice-card"]')
    await expect(card).toBeVisible()
    await expect(card.getByText('Suministros Ibéricos SL')).toBeVisible()
    await expect(card.getByText('B-87654321')).toBeVisible()
    await expect(card.getByText('FAC-101')).toBeVisible()
    await expect(card.getByText('2024-05-15')).toBeVisible()

    // Sin findings → estado "Todo cuadra"
    const findings = page.locator('[data-testid="findings-list"]')
    await expect(findings).toBeVisible()
    await expect(findings.getByText(/todo cuadra/i)).toBeVisible()

    // Propuesta: registrar
    await expect(page.getByText(/Registrar/i).first()).toBeVisible()

    // Ledger actualizado: nueva fila con FAC-101
    await expect(page.getByText('FAC-101').first()).toBeVisible()
  })

  // ─── Muestra: sin-nif ────────────────────────────────────────────────────

  test('sin-nif: detecta NIF ausente y solicita datos', async ({ page }) => {
    await clickSample(page, 'sin-nif')

    // Campos extraídos
    const card = page.locator('[data-testid="invoice-card"]')
    await expect(card.getByText('Consulting & Servicios Digitales SL')).toBeVisible()

    // El campo NIF debe mostrarse como "no detectado"
    await expect(card.getByText(/no detectado/i)).toBeVisible()

    // Finding: campo ausente nif
    const findings = page.locator('[data-testid="findings-list"]')
    await expect(findings.getByText(/nif/i).first()).toBeVisible()
    await expect(findings.getByText(/falt/i).first()).toBeVisible()

    // Propuesta: pedir_datos
    await expect(page.getByText(/Solicitar datos/i).first()).toBeVisible()
  })

  // ─── Muestra: duplicada ──────────────────────────────────────────────────

  test('duplicada: detecta duplicado y marca la factura', async ({ page }) => {
    await clickSample(page, 'duplicada')

    // Campos extraídos
    const card = page.locator('[data-testid="invoice-card"]')
    await expect(card.getByText('Telefónica SA')).toBeVisible()
    await expect(card.getByText('FAC-012')).toBeVisible()

    // Finding: duplicado
    const findings = page.locator('[data-testid="findings-list"]')
    await expect(findings.getByText(/duplicado/i).first()).toBeVisible()
    await expect(
      findings.locator('[data-testid="finding-item-duplicate"]'),
    ).toBeVisible()

    // Propuesta: marcar_duplicado → "Marcar duplicado"
    await expect(page.getByText(/Marcar duplicado/i).first()).toBeVisible()
  })

  // ─── Muestra: dificil ────────────────────────────────────────────────────

  test('dificil: factura en inglés, se registra con proveedor nuevo', async ({ page }) => {
    await clickSample(page, 'dificil')

    const card = page.locator('[data-testid="invoice-card"]')
    await expect(card.getByText('CloudStack Solutions Ltd.')).toBeVisible()
    await expect(card.getByText('INV-2024-089')).toBeVisible()

    // Finding: new_supplier
    const findings = page.locator('[data-testid="findings-list"]')
    await expect(findings.getByText(/proveedor nuevo/i).first()).toBeVisible()

    // Propuesta: registrar
    await expect(page.getByText(/Registrar/i).first()).toBeVisible()
  })

  // ─── Botón live: muestra 429 ─────────────────────────────────────────────

  test('live: muestra mensaje de límite al recibir 429', async ({ page }) => {
    await clickSample(page, 'correcta')

    const liveBtn = page.locator('[data-testid="live-button"]')
    await expect(liveBtn).toBeVisible()
    await liveBtn.click()

    // Debe aparecer el mensaje de rate-limit
    await expect(
      page.getByText(/límite/i).first(),
    ).toBeVisible({ timeout: 5_000 })
  })

  // ─── Exportar CSV ─────────────────────────────────────────────────────────

  test('export: botón CSV está disponible', async ({ page }) => {
    const exportBtn = page.locator('[data-testid="export-csv-button"]')
    await expect(exportBtn).toBeVisible()
  })

  // ─── Accesibilidad (axe-core) ─────────────────────────────────────────────

  test('accesibilidad: sin violaciones críticas', async ({ page }) => {
    // Analizar la página con una muestra cargada
    await clickSample(page, 'correcta')

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze()

    const criticalViolations = results.violations.filter(
      (v) => v.impact === 'critical',
    )

    if (criticalViolations.length > 0) {
      console.error(
        'Violaciones críticas de accesibilidad:',
        JSON.stringify(
          criticalViolations.map((v) => ({
            id: v.id,
            impact: v.impact,
            description: v.description,
            nodes: v.nodes.length,
          })),
          null,
          2,
        ),
      )
    }

    expect(criticalViolations).toHaveLength(0)
  })
})
