import { syncProcessingTimes } from "@/lib/feeds/processing-times/sync";

/**
 * Sync manual del mirror USCIS Processing Times (doc 09 §7).
 * Uso: `node --import tsx scripts/sync-processing-times.ts`
 * Requiere Node ≥ 22.5 (node:sqlite). Persiste `data/processing-times-cache.json`.
 */
async function main(): Promise<void> {
  const data = await syncProcessingTimes();
  console.info(
    `[processing-times] release ${data.release}: ${data.forms.length} forms, ` +
      `${data.offices.length} offices, ${data.times.length} times → cache OK`,
  );
}

main().catch((error: unknown) => {
  console.error("[processing-times] sync falló:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
