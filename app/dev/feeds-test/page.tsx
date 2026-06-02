import { notFound } from "next/navigation";
import { FeedsTestPanel } from "./panel";

/**
 * Panel de prueba E2E de las fuentes de la Capa B (doc 09 §17). SOLO desarrollo:
 * en producción responde 404. Es la vía oficial de verificación E2E real con
 * Playwright (las pruebas de CI usan fixtures, nunca sitios reales).
 */
export const dynamic = "force-dynamic";

export const metadata = { title: "Feeds Test (dev) — DIY Legal" };

export default function FeedsTestPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <FeedsTestPanel />;
}
