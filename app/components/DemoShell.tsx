'use client'

import { useState, useCallback, useEffect } from 'react'
import { SampleSelector } from './SampleSelector'
import { InvoiceCard } from './InvoiceCard'
import { FindingsList } from './FindingsList'
import { LedgerTable, type LedgerEntry } from './LedgerTable'
import type { SampleId } from '@/app/lib/samples'
import type { Invoice } from '@/core/invoice'
import type { Finding, Proposal } from '@/core/findings'

interface AnalyzeResult {
  invoice: Invoice
  findings: Finding[]
  proposal: Proposal
  fallback?: boolean
}

interface DemoState {
  status: 'idle' | 'loading' | 'success' | 'error'
  result: AnalyzeResult | null
  imagePath: string | null
  selectedId: SampleId | null
  ledger: LedgerEntry[]
  latestRowId: string | null
  error: string | null
  isLive: boolean
}

const PROPOSAL_LABEL: Record<string, string> = {
  registrar: 'Registrar',
  pedir_datos: 'Solicitar datos',
  marcar_duplicado: 'Marcar duplicado',
  revisar: 'Revisar',
}

const PROPOSAL_STYLE: Record<string, string> = {
  registrar: 'bg-green-50 text-green-700 border-green-200',
  pedir_datos: 'bg-amber-50 text-amber-700 border-amber-200',
  marcar_duplicado: 'bg-red-50 text-red-700 border-red-200',
  revisar: 'bg-blue-50 text-blue-700 border-blue-200',
}

async function fetchLedger(): Promise<LedgerEntry[]> {
  const res = await fetch('/api/ledger', { cache: 'no-store' })
  if (!res.ok) return []
  const data = (await res.json()) as { entries: LedgerEntry[] }
  return data.entries
}

export function DemoShell() {
  const [state, setState] = useState<DemoState>({
    status: 'idle',
    result: null,
    imagePath: null,
    selectedId: null,
    ledger: [],
    latestRowId: null,
    error: null,
    isLive: false,
  })

  // Cargar el ledger inicial al montar (esto también inicializa la cookie de sesión via /api/ledger)
  useEffect(() => {
    fetchLedger().then((entries) => {
      setState((prev) => ({ ...prev, ledger: entries }))
    }).catch(() => {
      // silencioso: el ledger comenzará vacío
    })
  }, [])

  const runAnalysis = useCallback(
    async (sampleId: SampleId, live: boolean) => {
      setState((prev) => ({
        ...prev,
        status: 'loading',
        error: null,
        isLive: live,
      }))

      try {
        const body = live ? { sampleId, live: true } : { sampleId }
        const res = await fetch('/api/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })

        if (res.status === 429) {
          setState((prev) => ({
            ...prev,
            status: 'error',
            error: 'Has alcanzado el límite de peticiones en vivo. Prueba de nuevo en unos minutos.',
          }))
          return
        }

        if (!res.ok) {
          throw new Error(`Error ${res.status}`)
        }

        const data = (await res.json()) as AnalyzeResult
        const newLedger = await fetchLedger()

        // Determinar la fila más reciente
        const latestEntry = newLedger[newLedger.length - 1]
        const latestRowId = latestEntry
          ? `${latestEntry.proveedor}-${latestEntry.numero}-${newLedger.length - 1}`
          : null

        setState((prev) => ({
          ...prev,
          status: 'success',
          result: data,
          imagePath: `/samples/${sampleId}.png`,
          selectedId: sampleId,
          ledger: newLedger,
          latestRowId,
          error: null,
        }))
      } catch {
        setState((prev) => ({
          ...prev,
          status: 'error',
          error: 'Error al analizar la factura. Inténtalo de nuevo.',
        }))
      }
    },
    [],
  )

  const handleSelect = useCallback(
    (id: SampleId) => {
      setState((prev) => ({ ...prev, selectedId: id }))
      void runAnalysis(id, false)
    },
    [runAnalysis],
  )

  const handleLive = useCallback(() => {
    if (!state.selectedId) return
    void runAnalysis(state.selectedId, true)
  }, [state.selectedId, runAnalysis])

  const isLoading = state.status === 'loading'

  return (
    <div className="flex flex-col gap-10">
      {/* Selector de muestras */}
      <SampleSelector
        selected={state.selectedId}
        loading={isLoading}
        onSelect={handleSelect}
      />

      {/* Estado de carga */}
      {isLoading && (
        <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-5 py-6" role="status" aria-live="polite">
          <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-foreground/20 border-t-foreground" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">
            {state.isLive ? 'Llamando a la IA…' : 'Analizando…'}
          </p>
        </div>
      )}

      {/* Error */}
      {state.status === 'error' && state.error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4" role="alert">
          <p className="text-sm font-medium text-red-700">{state.error}</p>
        </div>
      )}

      {/* Resultado */}
      {state.status === 'success' && state.result && state.imagePath && (
        <div className="flex flex-col gap-8" data-testid="analysis-result">
          {/* Propuesta + fallback notice */}
          <div className="flex flex-wrap items-center gap-3">
            <div
              className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium ${
                PROPOSAL_STYLE[state.result.proposal.accion] ?? 'bg-muted text-foreground border-border'
              }`}
            >
              <span className="text-xs font-semibold uppercase tracking-wider">
                Acción propuesta:
              </span>
              {PROPOSAL_LABEL[state.result.proposal.accion] ?? state.result.proposal.accion}
            </div>
            <p className="text-sm text-muted-foreground">{state.result.proposal.motivo}</p>
            {state.result.fallback && (
              <span className="rounded-md bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700">
                Resultado de respaldo — la IA no respondió a tiempo
              </span>
            )}
          </div>

          {/* InvoiceCard */}
          <InvoiceCard invoice={state.result.invoice} imagePath={state.imagePath} />

          {/* FindingsList */}
          <FindingsList findings={state.result.findings} />

          {/* Botón live (solo si hay muestra seleccionada y no estamos loading) */}
          <div className="flex items-center gap-4">
            <button
              onClick={handleLive}
              disabled={isLoading}
              data-testid="live-button"
              className="inline-flex items-center gap-2 rounded-lg bg-foreground px-5 py-2.5 text-sm font-semibold text-background transition-colors hover:bg-foreground/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
            >
              <span aria-hidden="true">⚡</span>
              Ejecutar en vivo con IA
            </button>
            <p className="text-xs text-muted-foreground">
              Llama a la IA real. Límite: 3 veces por sesión.
            </p>
          </div>
        </div>
      )}

      {/* Ledger (siempre visible) */}
      <LedgerTable entries={state.ledger} latestId={state.latestRowId ?? undefined} />
    </div>
  )
}
