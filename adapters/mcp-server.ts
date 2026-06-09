/**
 * Adaptador MCP para Cronhaus Inbox.
 *
 * Expone la lógica de razonamiento (core/reasoning.ts) como servidor MCP
 * con transporte stdio, para que cualquier cliente MCP (Claude, Cursor…)
 * pueda invocar la herramienta `reason_invoice`.
 *
 * ─── Cómo conectar el servidor ───────────────────────────────────────────────
 *
 * 1. Arrancar el servidor:
 *      pnpm mcp
 *    (equivale a: npx tsx adapters/mcp-server.ts)
 *
 * 2. Configuración en Claude Desktop (claude_desktop_config.json):
 *    {
 *      "mcpServers": {
 *        "cronhaus-inbox": {
 *          "command": "pnpm",
 *          "args": ["--dir", "/ruta/absoluta/cronhaus-inbox", "mcp"]
 *        }
 *      }
 *    }
 *
 * 3. Configuración en Cursor (.cursor/mcp.json):
 *    {
 *      "mcpServers": {
 *        "cronhaus-inbox": {
 *          "command": "pnpm",
 *          "args": ["--dir", "/ruta/absoluta/cronhaus-inbox", "mcp"]
 *        }
 *      }
 *    }
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { InvoiceSchema, type Invoice } from '@/core/invoice'
import { reason, propose } from '@/core/reasoning'
import { seedLedger } from '@/core/ledger'
import type { Finding } from '@/core/findings'
import type { Proposal } from '@/core/findings'

// ─── Handler puro (testeable sin transporte) ──────────────────────────────────

export interface ReasonInvoiceResult {
  findings: Finding[]
  proposal: Proposal
}

/**
 * Lógica de la tool `reason_invoice` extraída como función pura.
 * Puede invocarse directamente en tests sin necesitar el servidor MCP.
 */
export function handleReasonInvoice(invoice: Invoice): ReasonInvoiceResult {
  const ledger = seedLedger()
  const findings = reason(invoice, ledger)
  const proposal = propose(findings)
  return { findings, proposal }
}

// ─── Servidor MCP ─────────────────────────────────────────────────────────────

const server = new McpServer({
  name: 'cronhaus-inbox',
  version: '0.1.0',
})

server.registerTool(
  'reason_invoice',
  {
    title: 'Reason Invoice',
    description:
      'Analiza una factura contra el libro contable y devuelve findings y una propuesta de acción. ' +
      'Sin IA: usa reglas deterministas (campos obligatorios, cuadre IVA, duplicados, proveedor nuevo).',
    inputSchema: InvoiceSchema,
  },
  async (rawInput) => {
    // rawInput ya está validado y parseado por el SDK contra InvoiceSchema
    const invoice = rawInput as Invoice
    const result = handleReasonInvoice(invoice)
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(result, null, 2),
        },
      ],
    }
  },
)

// ─── Arranque (solo cuando se ejecuta como script, no cuando se importa) ──────

async function main(): Promise<void> {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  // Usamos stderr para no contaminar el protocolo stdio
  console.error('[cronhaus-inbox MCP] servidor arrancado — esperando mensajes por stdin')
}

// Detectamos si es el módulo principal de Node.js / tsx
if (
  process.argv[1] &&
  (process.argv[1].endsWith('mcp-server.ts') || process.argv[1].endsWith('mcp-server.js'))
) {
  main().catch((err) => {
    console.error('[cronhaus-inbox MCP] Error fatal:', err)
    process.exit(1)
  })
}
