/**
 * Consentimiento versionado de Términos + disclaimer UPL (doc 10 §2, doc 02).
 * Al cambiar el texto legal se sube `CONSENT_VERSION`; los perfiles con una
 * versión anterior deben volver a aceptar en el onboarding.
 */

/** Versión vigente del consentimiento (fecha de publicación del texto legal). */
export const CONSENT_VERSION = "2026-06-02";

/** ¿El perfil aceptó la versión vigente del consentimiento? */
export function hasCurrentConsent(profile: { consent_version: string | null }): boolean {
  return profile.consent_version === CONSENT_VERSION;
}
