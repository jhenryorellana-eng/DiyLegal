import { describe, expect, it } from "vitest";
import { CONSENT_VERSION, hasCurrentConsent } from "@/lib/auth/consent";

describe("hasCurrentConsent", () => {
  it("true cuando el perfil aceptó la versión vigente", () => {
    expect(hasCurrentConsent({ consent_version: CONSENT_VERSION })).toBe(true);
  });
  it("false si nunca consintió", () => {
    expect(hasCurrentConsent({ consent_version: null })).toBe(false);
  });
  it("false si consintió una versión anterior", () => {
    expect(hasCurrentConsent({ consent_version: "2025-01-01" })).toBe(false);
  });
});
