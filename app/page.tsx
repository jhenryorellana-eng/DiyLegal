/**
 * Landing mínima (placeholder de la Fase 0). La UI real de producto —AppShell,
 * bottom nav y ~30 pantallas— se construye en la Fase 8 (doc 05).
 * Aquí solo se valida que el scaffold, los tokens y las tipografías cargan.
 */
export default function HomePage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6 text-center">
      <span className="inline-flex items-center rounded-control bg-primary/10 px-3 py-1 font-mono text-xs font-medium tracking-wide text-primary">
        v0.1 · Fase 0
      </span>

      <h1 className="font-display text-5xl font-extrabold tracking-tight text-ink sm:text-6xl">
        DIY <span className="text-primary">Legal</span>
      </h1>

      <p className="max-w-md text-lg text-warm-600">Tu trámite, en tus manos.</p>

      <p className="max-w-md text-balance text-sm text-warm-500">
        Información oficial de tu caso de inmigración, organizada y en tu idioma.
      </p>

      <p className="mt-4 max-w-sm rounded-card border border-warm-200 bg-white px-4 py-3 text-xs text-warm-500">
        DIY Legal te da información y herramientas oficiales. No es un bufete ni brinda asesoría
        legal.
      </p>
    </main>
  );
}
