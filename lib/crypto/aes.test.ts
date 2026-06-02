import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { decrypt, encrypt } from "@/lib/crypto/aes";

const TEST_KEY = "0".repeat(64); // 32 bytes en hex
const original = process.env.APP_ENCRYPTION_KEY;

beforeAll(() => {
  process.env.APP_ENCRYPTION_KEY = TEST_KEY;
});
afterAll(() => {
  if (original === undefined) delete process.env.APP_ENCRYPTION_KEY;
  else process.env.APP_ENCRYPTION_KEY = original;
});

describe("AES-256-GCM", () => {
  it("round-trip: descifra lo que cifró", () => {
    const blob = encrypt("A123456789");
    expect(decrypt(blob)).toBe("A123456789");
  });

  it("dos cifrados del mismo texto difieren (IV aleatorio)", () => {
    expect(encrypt("same").equals(encrypt("same"))).toBe(false);
  });

  it("falla si el ciphertext fue alterado (auth tag GCM)", () => {
    const blob = encrypt("tamper-me");
    const i = blob.length - 1; // corromper el último byte (tag GCM)
    blob.writeUInt8(blob.readUInt8(i) ^ 0xff, i);
    expect(() => decrypt(blob)).toThrow();
  });

  it("falla con un blob demasiado corto", () => {
    expect(() => decrypt(Buffer.alloc(4))).toThrow();
  });

  it("falla si falta la clave", () => {
    delete process.env.APP_ENCRYPTION_KEY;
    expect(() => encrypt("x")).toThrow(/APP_ENCRYPTION_KEY/);
    process.env.APP_ENCRYPTION_KEY = TEST_KEY;
  });

  it("falla si la clave no mide 32 bytes", () => {
    process.env.APP_ENCRYPTION_KEY = "abcd";
    expect(() => encrypt("x")).toThrow(/32 bytes/);
    process.env.APP_ENCRYPTION_KEY = TEST_KEY;
  });
});
