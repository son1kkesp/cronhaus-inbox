/**
 * Catálogo de muestras disponibles.
 *
 * Los expected.json se importan estáticamente (no fs en runtime).
 * Las imágenes se sirven como estáticos desde /public/samples/<id>.png.
 */

import type { Invoice } from '@/core/invoice'
import type { Finding, Proposal } from '@/core/findings'

import correctaExpected from '@/samples/correcta/expected.json'
import sinNifExpected from '@/samples/sin-nif/expected.json'
import duplicadaExpected from '@/samples/duplicada/expected.json'
import dificilExpected from '@/samples/dificil/expected.json'

export type SampleId = 'correcta' | 'sin-nif' | 'duplicada' | 'dificil'

export interface SampleData {
  invoice: Invoice
  findings: Finding[]
  proposal: Proposal
  imagePath: string // ruta pública: /samples/<id>.png
}

type RawExpected = {
  invoice: Invoice
  findings: Finding[]
  proposal: Proposal
}

function makeSample(raw: RawExpected, id: SampleId): SampleData {
  return {
    invoice: raw.invoice,
    findings: raw.findings,
    proposal: raw.proposal,
    imagePath: `/samples/${id}.png`,
  }
}

export const SAMPLES: Record<SampleId, SampleData> = {
  correcta: makeSample(correctaExpected as RawExpected, 'correcta'),
  'sin-nif': makeSample(sinNifExpected as RawExpected, 'sin-nif'),
  duplicada: makeSample(duplicadaExpected as RawExpected, 'duplicada'),
  dificil: makeSample(dificilExpected as RawExpected, 'dificil'),
}

export const SAMPLE_IDS: SampleId[] = ['correcta', 'sin-nif', 'duplicada', 'dificil']

export function isSampleId(id: string): id is SampleId {
  return SAMPLE_IDS.includes(id as SampleId)
}
