"use client";

import { useState } from "react";

/**
 * Sonda por fuente: dispara el endpoint real y muestra status + tiempo + resumen.
 * Las fuentes detrás de un flag apagado responden 503 (comportamiento esperado).
 */
interface Probe {
  key: string;
  label: string;
  path: string;
  /** Método HTTP; por defecto GET. */
  method?: "GET" | "POST";
  /** Cuerpo JSON para sondas POST. */
  body?: unknown;
}

const PROBES: Probe[] = [
  {
    key: "itin",
    label: "ITIN check",
    path: "/api/tools/itin-check?itin=900112233&lastUsedYear=2020",
  },
  {
    key: "sss",
    label: "Selective Service",
    path: "/api/tools/selective-service?birthYear=2002&status=undocumented&male=true&registered=false&presentUS=true",
  },
  { key: "reg", label: "Federal Register", path: "/api/feeds/regulations" },
  { key: "ta", label: "Travel Advisories", path: "/api/feeds/travel-advisories?country=Mexico" },
  { key: "fee", label: "Fee Schedule G-1055", path: "/api/feeds/fees?form=N-400" },
  {
    key: "pt",
    label: "Processing Times",
    path: "/api/feeds/processing-times?form=I-130&office=NBC",
  },
  { key: "civ", label: "Civics", path: "/api/static/civics?version=2025" },
  { key: "vac", label: "Vacunas I-693", path: "/api/static/vaccines" },
  { key: "dmv", label: "DMV manual", path: "/api/static/dmv-manual?state=CA" },
  { key: "rid", label: "REAL ID", path: "/api/static/real-id?state=CA" },
  { key: "aid", label: "Legal Aid", path: "/api/legal/legal-aid?state=CA" },
  { key: "courts", label: "EOIR courts", path: "/api/eoir/courts" },
  { key: "court", label: "EOIR court detail", path: "/api/eoir/courts/adelanto-immigration-court" },
  { key: "judges", label: "TRAC judges", path: "/api/eoir/judges?baseCityCode=ADL" },
  { key: "intel", label: "Case intelligence", path: "/api/eoir/intelligence/case?judgeName=Riley" },
  {
    key: "aaf-calc",
    label: "AAF calculate",
    method: "POST",
    path: "/api/aaf/calculate",
    body: { filingDate: "2025-03-10", venue: "USCIS_affirmative", asOf: "2026-04-01" },
  },
  { key: "aaf-reg", label: "AAF regulatory", path: "/api/aaf/regulatory/current" },
  {
    key: "aaf-receipt",
    label: "AAF receipt (PDF)",
    method: "POST",
    path: "/api/aaf/generate-receipt",
    body: { filingDate: "2025-03-10", venue: "USCIS_affirmative", applicantName: "Demo" },
  },
  {
    key: "aaf-motion",
    label: "AAF motion (PDF)",
    method: "POST",
    path: "/api/aaf/generate-motion",
    body: {
      filingDate: "2025-03-10",
      venue: "USCIS_affirmative",
      applicantName: "Demo",
      proSe: true,
    },
  },
];

type ProbeState = "idle" | "loading" | ProbeResult;
interface ProbeResult {
  status: number;
  ok: boolean;
  ms: number;
  summary: string;
}

function summarize(data: unknown): string {
  if (Array.isArray(data)) return `array[${data.length}]`;
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    if (typeof obj.count === "number") return `count=${obj.count}`;
    return `{ ${Object.keys(obj).slice(0, 4).join(", ")} }`;
  }
  return String(data);
}

export function FeedsTestPanel() {
  const [results, setResults] = useState<Record<string, ProbeState>>({});
  const [busy, setBusy] = useState(false);

  async function run(probe: Probe): Promise<void> {
    setResults((r) => ({ ...r, [probe.key]: "loading" }));
    const started = performance.now();
    try {
      const init: RequestInit =
        probe.method === "POST"
          ? {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify(probe.body ?? {}),
            }
          : {};
      const res = await fetch(probe.path, init);
      const ms = Math.round(performance.now() - started);
      let summary: string;
      if ((res.headers.get("content-type") ?? "").includes("application/pdf")) {
        const branch = res.headers.get("x-aaf-branch") ?? res.headers.get("x-aaf-from-fallback");
        summary = `PDF${branch ? ` (${branch})` : ""}`;
      } else {
        try {
          const body = await res.json();
          summary = body.ok ? summarize(body.data) : `error: ${body.error?.kind ?? "?"}`;
        } catch {
          summary = "(respuesta no-JSON)";
        }
      }
      setResults((r) => ({ ...r, [probe.key]: { status: res.status, ok: res.ok, ms, summary } }));
    } catch (error) {
      setResults((r) => ({
        ...r,
        [probe.key]: {
          status: 0,
          ok: false,
          ms: Math.round(performance.now() - started),
          summary: error instanceof Error ? error.message : "fetch falló",
        },
      }));
    }
  }

  async function runAll(): Promise<void> {
    setBusy(true);
    for (const probe of PROBES) await run(probe);
    setBusy(false);
  }

  return (
    <main className="mx-auto max-w-4xl p-6 font-mono text-sm">
      <h1 className="text-xl font-bold">Feeds Test (dev)</h1>
      <p className="mt-1 text-gray-500">
        Sonda E2E de las fuentes de la Capa B. Una fuente con flag apagado responde 503 (esperado).
      </p>

      <button
        type="button"
        onClick={runAll}
        disabled={busy}
        data-testid="run-all"
        className="mt-4 rounded bg-indigo-600 px-4 py-2 font-semibold text-white disabled:opacity-50"
      >
        {busy ? "Ejecutando…" : "Probar todo"}
      </button>

      <table className="mt-4 w-full border-collapse">
        <thead>
          <tr className="border-b text-left text-gray-500">
            <th className="py-2">Fuente</th>
            <th>Endpoint</th>
            <th>Status</th>
            <th>ms</th>
            <th>Resultado</th>
          </tr>
        </thead>
        <tbody>
          {PROBES.map((probe) => {
            const state = results[probe.key] ?? "idle";
            const done = typeof state === "object";
            return (
              <tr key={probe.key} className="border-b align-top" data-testid={`row-${probe.key}`}>
                <td className="py-2 font-semibold">
                  <button type="button" onClick={() => run(probe)} className="hover:underline">
                    {probe.label}
                  </button>
                </td>
                <td className="max-w-[14rem] truncate text-gray-500" title={probe.path}>
                  {probe.path}
                </td>
                <td
                  data-testid={`status-${probe.key}`}
                  className={
                    done ? (state.ok ? "text-green-600" : "text-red-600") : "text-gray-400"
                  }
                >
                  {state === "idle" ? "—" : state === "loading" ? "…" : state.status}
                </td>
                <td className="text-gray-500">{done ? state.ms : ""}</td>
                <td data-testid={`result-${probe.key}`} className="text-gray-700">
                  {done ? state.summary : ""}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </main>
  );
}
