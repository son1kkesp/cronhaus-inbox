import type { Metadata } from 'next'
import { DemoShell } from '@/app/components/DemoShell'

export const metadata: Metadata = {
  title: 'Cronhaus Inbox — Agente de lectura y registro de facturas',
  description:
    'Sube una factura. La IA la lee, detecta lo que no cuadra y la registra en tu libro de gastos. Demo pública de Cronhaus, estudio de ingeniería de software.',
  openGraph: {
    title: 'Cronhaus Inbox',
    description: 'Agente de lectura y registro de facturas con IA.',
    type: 'website',
  },
}

export default function HomePage() {

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="font-mono text-lg font-bold tracking-tight text-foreground">
              CRONHAUS
            </span>
            <span className="hidden text-muted-foreground/40 sm:inline">·</span>
            <span className="hidden text-sm text-muted-foreground sm:inline">Inbox</span>
          </div>
          <span className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">
            Demo pública
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-12">
        {/* Hero */}
        <section className="mb-14 max-w-2xl" aria-label="Introducción">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Cronhaus · Ingeniería de software
          </p>
          <h1 className="mb-4 text-4xl font-bold leading-tight tracking-tight text-foreground sm:text-5xl">
            Sube una factura.
            <br />
            La IA la lee, detecta
            <br />
            lo que no cuadra
            <br className="hidden sm:block" />
            {' '}y la registra.
          </h1>
          <p className="mb-6 max-w-lg text-base leading-relaxed text-muted-foreground">
            Cronhaus Inbox analiza automáticamente cada factura: extrae datos, razona sobre
            errores o duplicados y propone la acción correcta. Sin configuración. Sin formularios.
          </p>

          {/* Privacidad */}
          <div className="inline-flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-4 py-2.5">
            <span className="text-sm text-muted-foreground" aria-hidden="true">⊘</span>
            <p className="text-xs text-muted-foreground">
              <strong className="font-medium text-foreground">Privacidad:</strong>{' '}
              nada se almacena. El procesamiento es efímero y local a la sesión.
            </p>
          </div>
        </section>

        {/* Separador de sección */}
        <div className="mb-8 flex items-center gap-4">
          <div className="h-px flex-1 bg-border" />
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Pruébalo ahora
          </p>
          <div className="h-px flex-1 bg-border" />
        </div>

        {/* Shell interactivo */}
        <DemoShell />
      </main>

      {/* Footer */}
      <footer className="mt-24 border-t border-border">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
          <p className="text-xs text-muted-foreground">
            © 2024 Cronhaus · Estudio de ingeniería de software
          </p>
          <p className="text-xs text-muted-foreground">
            Demo efímera · Sin almacenamiento de datos
          </p>
        </div>
      </footer>
    </div>
  )
}
