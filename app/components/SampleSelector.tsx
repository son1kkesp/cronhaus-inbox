'use client'

import Image from 'next/image'
import type { SampleId } from '@/app/lib/samples'

interface SampleConfig {
  id: SampleId
  label: string
  tag: string
  tagVariant: 'neutral' | 'warning' | 'danger' | 'info'
  description: string
}

export const SAMPLE_CONFIGS: SampleConfig[] = [
  {
    id: 'correcta',
    label: 'Factura correcta',
    tag: 'Correcta',
    tagVariant: 'neutral',
    description: 'Todos los campos validados. Se registra directamente.',
  },
  {
    id: 'sin-nif',
    label: 'Falta un dato',
    tag: 'Dato ausente',
    tagVariant: 'warning',
    description: 'NIF del proveedor no detectado. La IA pide revisión.',
  },
  {
    id: 'duplicada',
    label: 'Duplicada',
    tag: 'Duplicado',
    tagVariant: 'danger',
    description: 'Factura ya existente en el libro. La IA la marca.',
  },
  {
    id: 'dificil',
    label: 'En inglés',
    tag: 'Internacional',
    tagVariant: 'info',
    description: 'Proveedor extranjero con factura en inglés.',
  },
]

const TAG_STYLES: Record<SampleConfig['tagVariant'], string> = {
  neutral: 'bg-zinc-100 text-zinc-600',
  warning: 'bg-amber-100 text-amber-700',
  danger: 'bg-red-100 text-red-700',
  info: 'bg-blue-100 text-blue-700',
}

interface SampleSelectorProps {
  selected: SampleId | null
  loading: boolean
  onSelect: (id: SampleId) => void
}

export function SampleSelector({ selected, loading, onSelect }: SampleSelectorProps) {
  return (
    <section aria-label="Seleccionar muestra de factura">
      <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        Elige una muestra para analizar
      </p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {SAMPLE_CONFIGS.map((s) => {
          const isActive = selected === s.id
          return (
            <button
              key={s.id}
              onClick={() => onSelect(s.id)}
              disabled={loading}
              aria-pressed={isActive}
              aria-label={`Analizar muestra: ${s.label}`}
              data-testid={`sample-btn-${s.id}`}
              className={[
                'group flex flex-col gap-3 rounded-xl border p-3 text-left transition-all',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                'disabled:pointer-events-none disabled:opacity-50',
                isActive
                  ? 'border-foreground bg-card shadow-sm ring-1 ring-foreground/10'
                  : 'border-border bg-card hover:border-foreground/30 hover:shadow-sm',
              ].join(' ')}
            >
              {/* Miniatura */}
              <div className="relative overflow-hidden rounded-md bg-muted">
                <Image
                  src={`/samples/${s.id}.png`}
                  alt={`Vista previa: ${s.label}`}
                  width={200}
                  height={140}
                  className="h-28 w-full object-cover object-top transition-transform duration-200 group-hover:scale-[1.02]"
                />
              </div>

              {/* Etiqueta y descripción */}
              <div className="flex flex-col gap-1">
                <span
                  className={`self-start rounded px-1.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wide ${TAG_STYLES[s.tagVariant]}`}
                >
                  {s.tag}
                </span>
                <p className="text-xs font-medium leading-snug text-foreground">{s.label}</p>
                <p className="text-[0.7rem] leading-snug text-muted-foreground">{s.description}</p>
              </div>

              {/* CTA */}
              <span className="mt-auto text-[0.7rem] font-semibold text-primary opacity-0 transition-opacity group-hover:opacity-100">
                Pruébalo con esta →
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}
