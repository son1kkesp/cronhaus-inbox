export type FindingTipo =
  | 'missing'
  | 'mismatch'
  | 'duplicate'
  | 'anomaly'
  | 'new_supplier'

export type FindingSeveridad = 'alta' | 'media' | 'baja'

export interface Finding {
  tipo: FindingTipo
  severidad: FindingSeveridad
  mensajeHumano: string
  camposAfectados: string[]
}

export type ProposalAccion =
  | 'registrar'
  | 'pedir_datos'
  | 'marcar_duplicado'
  | 'revisar'

export interface Proposal {
  accion: ProposalAccion
  motivo: string
}

// --- Factories ---

export function makeFinding(
  tipo: FindingTipo,
  severidad: FindingSeveridad,
  mensajeHumano: string,
  camposAfectados: string[],
): Finding {
  return { tipo, severidad, mensajeHumano, camposAfectados }
}

export function makeProposal(accion: ProposalAccion, motivo: string): Proposal {
  return { accion, motivo }
}
