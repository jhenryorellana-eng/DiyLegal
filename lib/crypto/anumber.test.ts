import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  decryptANumber,
  encryptANumber,
  maskANumber,
  normalizeANumber,
} from "@/lib/crypto/anumber";

const original = process.env.APP_ENCRYPTION_KEY;
beforeAll(() => {
  process.env.APP_ENCRYPTION_KEY = "0".repeat(64);
});
afterAll(() => {
  if (original === undefined) delete process.env.APP_ENCRYPTION_KEY;
  else process.env.APP_ENCRYPTION_KEY = original;
});

describe("normalizeANumber", () => {
  it("quita prefijo, espacios y guiones", () => {
    expect(normalizeANumber("A 123-456-789")).toBe("A123456789");
    expect(normalizeANumber("123456789")).toBe("A123456789");
  });
});

describe("maskANumber (doc 10 §228)", () => {
  it("A123456789 → A1**-***-789", () => {
    expect(maskANumber("A123456789")).toBe("A1**-***-789");
  });
  it("tolera separadores", () => {
    expect(maskANumber("A1-234-56789")).toBe("A1**-***-789");
  });
  it("entrada demasiado corta → totalmente enmascarada", () => {
    expect(maskANumber("A12")).toBe("A***-***-***");
  });
});

describe("encryptANumber / decryptANumber", () => {
  it("round-trip con formato bytea \\x", () => {
    const enc = encryptANumber("A123456789");
    expect(enc.startsWith("\\x")).toBe(true);
    expect(decryptANumber(enc)).toBe("A123456789");
  });
  it("normaliza antes de cifrar", () => {
    expect(decryptANumber(encryptANumber("123-456-789"))).toBe("A123456789");
  });
});
