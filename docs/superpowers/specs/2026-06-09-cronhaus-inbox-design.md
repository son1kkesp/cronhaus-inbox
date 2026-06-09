# Cronhaus Inbox — Spec de diseño

> **Estado:** v1.1 (revisado) · **Fecha:** 2026-06-09 · **Autor:** Iván Barrera (Cronhaus) con Claude
> **Tipo:** proyecto-escaparate (showcase) nº 1 de Cronhaus
> **v1.1:** incorpora la revisión adversaria del spec (estado sembrado, muestras cacheadas por defecto, contrato vision↔core, alcance de IVA/PDF, prioridad de construcción).

---

## 1. Propósito

**Cronhaus Inbox** es un agente que **lee una factura, la razona y la registra**: extrae los datos, detecta lo que falta o no cuadra (huecos, duplicados, descuadres), propone la acción y la "ejecuta" sobre un libro de gastos de demostración.

Su función es ser el **primer escaparate público de Cronhaus**: una pieza que demuestra el posicionamiento *"automatización que piensa y hace — IA que decide, no que copia datos"* y que diferencia a Cronhaus de competidores que solo sincronizan datos. No es un producto comercial; es una demostración de capacidad reutilizable como plantilla de venta.

## 2. Objetivos y criterios de éxito

- **Wow en < 60 s:** clic en una factura de muestra → valor entendido al instante, sin registro ni configuración.
- **IA que decide:** no es solo OCR; razona (huecos/duplicados/cuadre) y lo explica en lenguaje humano.
- **Código ejemplar:** arquitectura limpia, tipado estricto, tests; el repo público resiste la lectura de un dev senior.
- **Acotado:** v1 construible por una persona en pocas semanas a 15-25 h/sem.
- **Vanguardia sólida:** AI SDK v6, MCP, Vercel; verificado con context7; estable para producción.

**Señales de éxito:** (a) un visitante prueba una muestra y dice "lo quiero"; (b) un dev lee el repo y respeta la ingeniería; (c) base vendible para clientes reales.

## 3. No-objetivos (v1)

- Sin autenticación ni cuentas.
- Sin base de datos persistente (estado efímero por sesión).
- Sin conexión real a ERP/contabilidad (gancho de producción, no demo).
- **La IA en vivo NO es el camino por defecto de la demo:** las muestras sirven resultado **precalculado** (ver §5/§11). La IA real se prueba con un botón opt-in y en v2 ("sube la tuya").
- Solo **imágenes (PNG/JPG) de una página**; PDF nativo y multipágina → v2.
- Solo **un tipo de IVA por factura**; multi-tipo, exenciones e inversión del sujeto pasivo → v2.
- Sin variante n8n (v2).

## 4. Audiencia

1. **Clientes potenciales (pymes/autónomos):** prueban la demo; valoran el *resultado*.
2. **Devs y reclutadores (carril empleo):** leen el repo; valoran la *ingeniería* (README, arquitectura, tests, MCP).

## 5. Experiencia de usuario (demo)

1. Aterrizas: titular claro + 3-4 **facturas de muestra** ("Pruébalo con esta →").
2. Eliges una → el resultado aparece **al instante** (se sirve **precalculado**: latencia ~0, coste 0, siempre impecable): campos extraídos con su confianza.
3. Ves el **razonamiento**: avisos humanos (*"⚠️ Falta el NIF"*, *"🔁 Posible duplicado de FAC-012"*, *"❌ Base + IVA no cuadra con el total"*).
4. El agente **propone** y **ejecuta en el sandbox**: el libro de gastos —que **arranca sembrado** con 2-3 asientos previos (incluido FAC-012)— se actualiza ante tus ojos. Por eso la muestra "duplicada" dispara su aviso desde el primer clic.
5. **Export** CSV / asiento del estado del sandbox.
6. Botón opcional **"⚡ Ejecutar en vivo con IA"** en una de las muestras: lanza la extracción real (rate-limited) para demostrar que el motor no es atrezzo. El resto del recorrido sigue siendo cacheado.
7. Mensaje de privacidad visible: *nada se almacena; el procesamiento es efímero.*

Las muestras se eligen a propósito para lucir: una correcta, una con un campo que falta, una **duplicada** de un asiento sembrado, una con formato/idioma difícil.

## 6. Arquitectura (hexagonal)

```
cronhaus-inbox/
├── core/                 # Dominio puro — sin IA, red ni framework
│   ├── invoice.ts        # Tipos + esquema Zod (todos los campos nullable)
│   ├── reasoning.ts      # Motor de reglas (puro, determinista)
│   └── findings.ts       # Tipos de hallazgo/aviso/propuesta
├── adapters/
│   ├── vision/           # imagen → Invoice (AI SDK v6 + visión vía AI Gateway)
│   ├── store/            # Libro de gastos efímero, sembrado al iniciar sesión
│   └── mcp/              # Servidor MCP (expone el razonamiento; ver §12)
├── app/                  # Next.js App Router (UI demo + API)
├── samples/              # <id>/ : imagen + expected.json (resultado precalculado)
└── docs/superpowers/
```

**Regla de oro:** `core/` no importa de `adapters/` ni `app/`. El razonamiento se prueba al 100 % sin IA ni red. El adaptador de visión es sustituible/mockeable.

**Estado de sesión:** el `store` vive en memoria del servidor, indexado por un id de sesión efímero (cookie de sesión, sin datos personales). Se siembra con 2-3 asientos al crear la sesión y se descarta al expirar. Sin persistencia.

## 7. Componentes

| Componente | Responsabilidad | Depende de |
|---|---|---|
| `core/reasoning` | Aplica reglas → hallazgos + propuesta. Pura. | nada |
| `adapters/vision` | imagen → `Invoice` validado, con confianza. | AI SDK v6, AI Gateway |
| `adapters/store` | Libro de gastos efímero sembrado; export CSV. | core |
| `adapters/mcp` | Expone `reason_invoice` (y opcional `extract_invoice`). | core, (vision) |
| `app` (UI) | Demo: muestras, extracción/avisos/sandbox, export, botón "en vivo". | core, store |
| `app` (API) | Orquesta: cacheado por defecto; IA real solo en opt-in. | adapters |

## 8. Modelo de datos

- **`Invoice`** (Zod, **todos los campos `.nullable()`**): `proveedor`, `nif`, `numero`, `fecha`, `base`, `ivaTipo`, `ivaCuota`, `total`, `categoria`, `moneda`. Cada campo con `confidence` (0-1, **orientativo**: los LLM auto-reportan confianza de forma poco fiable, así que **no se usa para lógica crítica**, solo para resaltar en UI). Umbral: por debajo de `confidence` mínimo el valor se muestra como **"no detectado"**, nunca se inventa.
- **`Finding`**: `{ tipo: 'missing'|'mismatch'|'duplicate'|'anomaly'|'new_supplier', severidad, mensajeHumano, camposAfectados }`.
- **`Proposal`**: `{ accion: 'registrar'|'pedir_datos'|'marcar_duplicado'|'revisar', motivo }`.

El contrato de salida del modelo de visión (JSON exacto) se documenta junto al adaptador; el mapeo a Zod tolera campos ausentes (→ `null`) sin romper la validación.

## 9. Flujo de datos

`documento` → **vision.extract** *(o `expected.json` cacheado)* → `Invoice` (Zod, con confianza) → **core.reason** (contra el sandbox sembrado) → `Finding[]` → **core.propose** → `Proposal` → **store.apply** → UI + export.

## 10. Motor de razonamiento (reglas v1)

1. **Campos obligatorios** ausentes: NIF, fecha, total, proveedor.
2. **Cuadre aritmético:** `base + ivaCuota` ≈ `total`, **tolerancia ±0,02 €**.
3. **IVA legal (tipo único):** `ivaTipo ∈ {0, 4, 10, 21}` % y `ivaCuota ≈ base × ivaTipo`; si no, anomalía.
4. **Duplicado:** coincidencia por `(proveedor + numero + total)` contra el **sandbox sembrado**.
5. **Proveedor nuevo vs. recurrente** respecto al sandbox.

Reglas = datos + funciones puras → fáciles de testear y ampliar. Las muestras se diseñan para no contradecir estas reglas (salvo la que debe disparar cada aviso).

## 11. IA / extracción

- **Por defecto, las muestras NO llaman a la IA:** sirven su `expected.json` precalculado → latencia ~0, coste 0, determinismo total (clave para los tests y para que el "wow" salga siempre). Estos `expected.json` se generan una vez (offline) con el propio adaptador de visión y se versionan.
- **IA real (opt-in / v2):** el botón "⚡ Ejecutar en vivo" y el futuro "sube la tuya" usan **AI SDK v6** con salida estructurada (`Output.object` + Zod) y **entrada de imagen** vía **Vercel AI Gateway** (modelo con visión, p. ej. Claude). API exacta confirmada con context7 al construir. Rate-limit por sesión/IP.
- **Entrada v1:** imágenes PNG/JPG de una página (el PDF se rasteriza fuera de alcance v1).
- **Incertidumbre:** campo no fiable → `null` + confianza baja; **nunca se inventa** un valor.
- **Sin almacenamiento:** documento procesado en memoria y descartado.

## 12. MCP

Servidor MCP que expone principalmente **`reason_invoice(invoice: Invoice) → { findings, proposal }`**: el **cerebro** (razonamiento puro), gratis y determinista — es lo más diferencial y el catnip técnico, y no abre ningún vector de coste. Opcionalmente **`extract_invoice(image)`**, que ejecuta visión y **requiere API key del invocador** (documentado), para no exponer coste abierto. Transporte **stdio** en v1 (suficiente para demostrar y documentar); HTTP queda como "si sobra tiempo".

## 13. Privacidad y seguridad

- Procesamiento **efímero**: sin DB, sin logs de contenido sensible, sin almacenar documentos.
- Mensaje de privacidad explícito en la UI.
- Rate-limit en los caminos que tocan IA real (opt-in, MCP `extract_invoice`, v2).

## 14. Manejo de errores

- **Camino por defecto (cacheado):** no puede fallar por IA; sirve `expected.json`.
- **Camino IA real (opt-in):** `try` extracción → on **error 5xx / timeout (8 s) / fallo de validación Zod** → mensaje claro + opción de ver el resultado cacheado de esa muestra. El usuario percibe que fue un reintento, sin crash.
- **Campo no detectado:** se muestra como "no detectado" + aviso; el flujo continúa.
- **Documento ilegible (v2 subida):** mensaje "no he podido leer esta factura", sin crash.

## 15. Testing

- **Core (unit, Vitest):** baterías con **facturas-fixture** (las "trampa": hueco, duplicada, IVA raro, descuadre). Alta cobertura del razonamiento. Deterministas (no tocan IA).
- **Adapters:** `vision` con respuestas fijas (contrato); nunca IA real en CI.
- **E2E (Playwright + axe):** recorrido de la demo **contra muestras cacheadas** (determinista, sin coste); checks de accesibilidad WCAG. El botón "en vivo" se excluye del E2E o se mockea.
- **CI:** typecheck + lint + unit + e2e en GitHub Actions; build antes de deploy.

## 16. Stack y decisiones

Next.js 16 App Router · TypeScript estricto · Tailwind v4 · shadcn/ui · AI SDK v6 (estructurada + visión) · Vercel AI Gateway · Zod · Vitest · Playwright + axe-core · GitHub Actions · Vercel (Fluid Compute) · pnpm · Node 24. Versiones/APIs confirmadas con **context7** al construir. Entrada de imágenes PNG/JPG (una página).

**Generación de muestras:** las facturas de muestra se generan **sintéticas** con Gemini ("nano banana") vía **OpenRouter** (offline, una sola vez; realistas pero ficticias → refuerza la privacidad por diseño y permite diseñar a propósito la del hueco, la duplicada, etc.). **Secretos** (`OPENROUTER_API_KEY`, claves de AI Gateway) en `.env.local` (gitignored) y en Vercel env vars — **nunca en el repo ni en el chat**.

## 17. Fases y orden de construcción

**Orden de prioridad v1** (de núcleo a adorno, para proteger el plazo):
1. `core` (Invoice + reglas + findings) **+ tests** — el corazón, sin IA.
2. UI de la demo **con muestras cacheadas** + sandbox sembrado + avisos + export — el "wow".
3. **README + GIF** (entregable de primera clase, no de relleno).
4. Servidor **MCP (stdio)** sobre `reason_invoice`.
5. *(Si sobra tiempo)* botón "⚡ Ejecutar en vivo" con IA real + rate-limit.

**v2:** "sube la tuya" (IA real + borrado), variante **n8n**, MCP-HTTP, más reglas (IRPF, multi-tipo IVA, exenciones), PDF/multipágina, conexión real (Sheets/Holded vía MCP).

## 18. Escaparate (README)

Problema en 2 líneas · **GIF de 10 s** de la demo · enlace a demo en vivo · arquitectura (diagrama) · stack y por qué · cómo correr en local · cómo usar el servidor MCP · decisiones y lecciones. Tono sobrio, técnico, sin humo. **Repo público desde el día 1, con commits limpios y atómicos** (el historial cuenta para reclutadores); el GIF se añade cuando esté listo, no condiciona la visibilidad.

## 19. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Demo del duplicado no dispara sin estado previo | Sandbox **sembrado** con asientos (incl. FAC-012) |
| Coste/latencia/abuso de IA en demo pública | Muestras **cacheadas por defecto**; IA real solo opt-in con rate-limit |
| "Wow" no se entiende en 60 s | UI guiada, una acción, avisos visuales claros, resultado instantáneo |
| Sobre-ingeniería retrasa la v1 | YAGNI; MCP-HTTP, n8n, "sube la tuya", IVA multi-tipo → v2 |
| Extracción por visión poco fiable | Muestras controladas + `expected.json` precalculado |

## 20. Decisiones cerradas / abiertas

- **Cerrado:** muestras cacheadas por defecto · sandbox sembrado · solo imágenes una página · IVA de tipo único en v1 · repo público desde el día 1 · MCP stdio sobre `reason_invoice`.
- **Abierto:** nombre definitivo ("Cronhaus Inbox" provisional) · modelo de visión concreto para el camino "en vivo" (Claude vía AI Gateway por defecto; confirmar coste/calidad).

---

## Nota de implementación (post-v1)

La capa de visión (`adapters/vision.ts`) **no usa el AI SDK v6** tal como planificaba este spec. Usa `node:https` directamente contra la API REST de OpenRouter con `response_format: json_schema` y el modelo `google/gemini-2.5-pro`.

**Motivo:** Next.js 16 + Turbopack en Vercel intercepta `fetch()` vía undici. OpenRouter devuelve al menos un header con BOM (U+FEFF, charCode 65279) que undici rechaza con `TypeError: Cannot convert argument to a ByteString`. Usar `node:https` directamente evita ese path. Las dependencias `ai` y `@openrouter/ai-sdk-provider` se eliminaron del `package.json` al no usarse.

La arquitectura hexagonal y el contrato del adaptador (`VisionExtractor`) no cambian — solo la implementación interna del adaptador.
