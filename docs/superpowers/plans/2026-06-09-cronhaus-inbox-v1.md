# Cronhaus Inbox v1 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir la v1 de Cronhaus Inbox: un agente que lee una factura (imagen), la razona (huecos/duplicados/descuadres) y la registra en un sandbox sembrado, con demo pública cacheada y servidor MCP.

**Architecture:** Hexagonal. `core/` puro y testeable sin IA ni red (Invoice + reglas + ledger sembrado). `adapters/` para visión (AI SDK v6), store y MCP. `app/` Next.js sirve la demo con resultados **precalculados** por defecto; la IA en vivo es opt-in.

**Tech Stack:** Next.js 16, TypeScript estricto, Tailwind v4, shadcn/ui, AI SDK v6 + Vercel AI Gateway, Zod, Vitest, Playwright + axe-core, MCP SDK, pnpm/Node 24, Vercel.

**Spec:** `docs/superpowers/specs/2026-06-09-cronhaus-inbox-design.md` — leer antes de empezar.

**Reglas globales:** DRY · YAGNI (nada marcado v2 en el spec) · TDD para `core/` · commits frecuentes y atómicos · **verificar con context7 la API actual antes de tocar AI SDK v6, MCP SDK o Next.js 16** · **secretos solo en `.env.local` y Vercel env, jamás en el repo**.

> **v1.1 — cambios tras revisión:** (1) **orden corregido** — el adaptador de visión (ahora Phase 2) va ANTES de la generación de muestras (Phase 3), porque las muestras necesitan el pipeline real. (2) `expected.json` se genera con el pipeline completo `vision → reason → propose`. (3) muestras con validación + plan B si nano banana no da cifras exactas. (4) rate-limit, timeout/fallback y carga de `expected.json` con contrato explícito. (5) política numérica de Zod definida. (6) `extract_invoice` (MCP) declarado fuera de v1.

**Orden de fases:** 0 Scaffold → 1 core → 2 visión → 3 muestras → 4 API+UI → 5 MCP → 6 deploy.

---

## File Structure

```
cronhaus-inbox/
├── core/        invoice.ts · findings.ts · reasoning.ts · ledger.ts   (puro, sin IA)
├── adapters/    vision.ts · vision.mock.ts · store.ts · mcp-server.ts
├── app/         api/analyze/route.ts · page.tsx · components/* · lib/session.ts · lib/samples.ts
├── samples/     <id>/image.png · <id>/expected.json
├── scripts/     gen-samples.ts
├── tests/       core/* · adapters/* · api/* · e2e/*
├── .env.example (claves sin valor)
└── docs/superpowers/
```

---

## Phase 0 — Scaffolding

### Task 0.1: Proyecto + estructura

**Files:** scaffold completo.

- [ ] **Step 1:** Verificar con context7 el comando actual de `create-next-app` (Next.js 16) y la config de Tailwind v4.
- [ ] **Step 2:** **Scaffold sin machacar `docs/` ni `.env.local`**: generar Next.js en un dir temporal y mover el contenido a `cronhaus-inbox/`, o usar el flag de "directorio actual" tras respaldar `docs/` y `.env.local`. (Iván ya ha colocado `.env.local` con `OPENROUTER_API_KEY` — **no debe borrarse ni leerse**.)
- [ ] **Step 3:** **Crear `.gitignore` ANTES de `git init`** y confirmar que cubre `.env.local`, `.env*`, `node_modules`, `.next`, `playwright-report`. (Crítico: la key ya está en disco; el primer commit no debe incluirla.)
- [ ] **Step 4:** TS estricto (`strict`, `noUncheckedIndexedAccess`), ESLint, Prettier. Crear `.env.example` (sin valores).
- [ ] **Step 5:** Instalar shadcn/ui, Zod, Vitest + @testing-library, Playwright + @axe-core/playwright, MCP SDK, AI SDK v6 (`ai` + gateway). Versiones vía context7.
- [ ] **Step 6:** `git init` → `git status` (verificar que `.env.local` NO aparece) → commit inicial.

### Task 0.2: CI

- [ ] Crear `.github/workflows/ci.yml`: install → typecheck → lint → `vitest run` → `playwright test` → `next build`. Scripts en `package.json`. Commit.

---

## Phase 1 — `core/` (TDD, sin IA)

### Task 1.1: Esquema `Invoice`

**Files:** Create `core/invoice.ts`, Test `tests/core/invoice.test.ts`

**Política numérica (decidida):** el esquema NO usa `coerce`. Los campos numéricos son `z.number().nullable()`; es responsabilidad del adaptador entregar `number | null` (texto no parseable → `null`, nunca `NaN`). El test verifica que un `null` pasa y que un string crudo es rechazado.

- [ ] **Step 1: Test que falla** (campos null válidos; `total: 'cien'` rechazado; `NaN` rechazado vía la forma del schema).
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implementar `InvoiceSchema` (todos `.nullable()`, números `z.number()`, `moneda` default `'EUR'`, `confidence?: Record<string,number>` orientativo).
- [ ] **Step 4:** Run → PASS. **Step 5:** Commit.

### Task 1.2: `Finding` / `Proposal`

- [ ] Definir tipos + factories en `core/findings.ts`. Commit. (Se ejercitan en 1.3.)

### Task 1.3: `reason()` — una regla por sub-tarea (TDD)

**Files:** Create `core/reasoning.ts`, Test `tests/core/reasoning.test.ts`

- [ ] **Regla A** campos obligatorios ausentes (NIF/fecha/total/proveedor) → `missing`. fail→impl→pass→commit.
- [ ] **Regla B** `base+ivaCuota ≈ total` (tol. ±0,02) → `mismatch`. ciclo+commit.
- [ ] **Regla C** `ivaTipo ∈ {0,4,10,21}` y `ivaCuota ≈ base×ivaTipo` → `anomaly`. ciclo+commit.
- [ ] **Regla D** duplicado por `(proveedor+numero+total)` contra `ledger` → `duplicate`. ciclo+commit.
- [ ] **Regla E** proveedor nuevo vs. recurrente → `new_supplier` (sev. baja). ciclo+commit.
- [ ] **`propose(findings)`**: `missing`→`pedir_datos`; `duplicate`→`marcar_duplicado`; limpio→`registrar`. ciclo+commit.

`reason(invoice, ledger): Finding[]` compone A-E. Sin imports externos.

### Task 1.4: `ledger` sembrado + test de integración del duplicado

**Files:** `core/ledger.ts`, Test `tests/core/ledger.test.ts`

- [ ] **Step 1: Test** — `seedLedger()` ≥2 asientos e incluye `FAC-012` con `(proveedor, numero, total)` fijos.
- [ ] **Step 2:** FAIL → implementar `seedLedger()` → PASS.
- [ ] **Step 3: Test de integración (aviso estrella):** una `Invoice` con los MISMOS `(proveedor, numero, total)` que `FAC-012` → `reason()` produce `duplicate`. PASS.
- [ ] **Step 4:** Commit.

---

## Phase 2 — Adaptador de visión

### Task 2.1: Interfaz + mock

**Files:** `adapters/vision.ts` (interfaz `extract(image): Promise<Invoice>`), `adapters/vision.mock.ts`, Test `tests/adapters/vision.mock.test.ts`

- [ ] Test: el mock devuelve la `Invoice` fija para una imagen de prueba. fail→impl→pass→commit.

### Task 2.2: Implementación real (AI SDK v6 + Gateway)

**Files:** Modify `adapters/vision.ts`

- [ ] **Step 1:** context7 → API exacta de AI SDK v6 para **imagen + salida estructurada** (`Output.object`/`generateObject` con mensaje que incluye `image`).
- [ ] **Step 2:** Implementar `extract`: prompt + esquema Zod `Invoice`; campos no fiables → `null` (nunca inventar); modelo de visión vía AI Gateway (env). Devuelve `number | null` en numéricos.
- [ ] **Step 3:** Prueba manual con una imagen (no CI). Commit.

---

## Phase 3 — Muestras sintéticas (nano banana)

> **Requiere Phase 1 y Phase 2 hechas** (usa `vision.extract`, `reason`, `propose`, `seedLedger`). `.env.local` con `OPENROUTER_API_KEY` ya está puesto.

### Task 3.1: Generador de imágenes

**Files:** Create `scripts/gen-samples.ts`

- [ ] **Step 1:** context7 → endpoint de imágenes de OpenRouter (Gemini "nano banana") y formato de request. Leer `process.env.OPENROUTER_API_KEY` (**no leer el archivo a mano**).
- [ ] **Step 2:** Definir 4 muestras con sus **valores objetivo** explícitos: (a) correcta, (b) sin NIF, (c) duplicada = mismos `(proveedor,numero,total)` que `FAC-012`, (d) difícil/otro idioma. Generar `samples/<id>/image.png`.
- [ ] **Step 3: Validación + plan B** — comprobar que cada imagen muestra los valores objetivo (sobre todo (c) duplicada y (b) hueco). Si nano banana no produce cifras exactas/legibles, **plan B: maquetar la factura en HTML y capturarla** (determinista). Regenerar hasta que cuadre.
- [ ] **Step 4:** Commit imágenes.

### Task 3.2: `expected.json` (pipeline completo)

**Files:** `samples/<id>/expected.json`

- [ ] **Step 1:** Para cada muestra, ejecutar el **pipeline completo**: `vision.extract(image)` → `Invoice`; `reason(invoice, seedLedger())` → `findings`; `propose(findings)` → `proposal`. Serializar `{ invoice, findings, proposal }`.
- [ ] **Step 2:** Revisar a mano que los `findings` son los esperados (la (c) debe traer `duplicate`, la (b) `missing`). Ajustar la imagen si no cuadra.
- [ ] **Step 3:** Commit `expected.json` versionados.

---

## Phase 4 — API + UI

### Task 4.1: Sesión + store

**Files:** `app/lib/session.ts`, `adapters/store.ts`, Test `tests/adapters/store.test.ts`

- [ ] Test: `createStore()` arranca con `seedLedger()`; `applyEntry()` añade; `toCSV()` exporta; aislado por sesión. fail→impl→pass→commit.

### Task 4.2: API `analyze` (cacheado + live con contrato)

**Files:** `app/lib/samples.ts` (carga de muestras), `app/api/analyze/route.ts`, Test `tests/api/analyze.test.ts`

**Decisiones de contrato:**
- **Carga de `expected.json`:** `import` estático del JSON (bundleado), NO `fs.readFile` (en serverless los assets fuera de `public/` no se sirven solos). `app/lib/samples.ts` mapea `sampleId → expected`.
- **Rate-limit (live):** best-effort in-memory por sesión, **3 peticiones / 10 min**; al exceder → `429` con mensaje. Aceptado como "no garantizado entre instancias" (es demo).
- **Timeout/fallback (live):** `vision.extract` envuelto en timeout **8 s**; ante error 5xx / timeout / fallo Zod → responder el `expected.json` de esa muestra con un flag `fallback:true`.

- [ ] **Step 1: Tests** — (a) POST `{sampleId}` → expected cacheado + entrada en store, sin IA; (b) POST `{sampleId, live:true}` con mock que cuelga → tras timeout, fallback al expected; (c) 4ª petición live en <10 min → 429.
- [ ] **Step 2:** FAIL → implementar la ruta con las tres decisiones. → PASS. Commit.

### Task 4.3: UI

**Files:** `app/page.tsx`, `app/components/*` (verificar shadcn/Tailwind con context7)

- [ ] Landing (titular + selector de muestras + nota de privacidad). Commit.
- [ ] `InvoiceCard` (campos + confianza; "no detectado" si null). Commit.
- [ ] `FindingsList` (avisos por severidad). Commit.
- [ ] `LedgerTable` (sandbox sembrado que se actualiza) + `ExportButton` (CSV). Commit.
- [ ] Botón "⚡ Ejecutar en vivo" (opt-in, `live:true`, maneja 429/fallback). Commit.

### Task 4.4: E2E

**Files:** `tests/e2e/demo.spec.ts`

- [ ] Playwright contra **cacheado**: por muestra → click → assert extracción + avisos + fila nueva en ledger. axe sin violaciones críticas. Excluir/mock el botón "en vivo". Run→PASS. Commit.

---

## Phase 5 — Servidor MCP

### Task 5.1: `reason_invoice` (stdio)

**Files:** `adapters/mcp-server.ts`, Test `tests/adapters/mcp.test.ts`

> `extract_invoice(image)` queda **fuera de v1** (YAGNI; ver spec §12). Solo exponemos el cerebro.

- [ ] **Step 1:** context7 → API actual del MCP TS SDK (server, tool, stdio).
- [ ] **Step 2: Test** — invocar `reason_invoice(invoice)` → `{findings, proposal}` (usa `core`, sin IA). fail→impl→pass.
- [ ] **Step 3:** Commit + documentar conexión (Claude/Cursor) en README.

---

## Phase 6 — Escaparate y deploy

### Task 6.1: README
- [ ] Problema (2 líneas) · hueco GIF · arquitectura · stack y por qué · cómo correr · cómo usar el MCP · decisiones/lecciones. Tono sobrio. Commit.

### Task 6.2: Deploy + GIF
- [ ] Conectar repo a Vercel; env vars (AI Gateway / OpenRouter) en Vercel, no en el repo.
- [ ] Deploy preview → la demo **cacheada** funciona SIN secretos (camino por defecto). Verificar.
- [ ] Grabar GIF de 10 s (muestra → avisos → ledger) → README.
- [ ] Repo público. Commit final + tag `v1.0`.

---

## Done = v1
`core` (5 reglas + duplicado integrado) testeado · demo cacheada con sandbox sembrado · export CSV · MCP stdio (`reason_invoice`) · README con GIF · CI verde · demo en vivo en Vercel. v2 fuera (spec §17).
