import { afterEach, describe, expect, it, vi } from "vitest";
import { clearResponseCache, getCached, setCached, withCache } from "@/lib/gemini/response-cache";

afterEach(() => {
  clearResponseCache();
  vi.useRealTimers();
});

describe("response-cache", () => {
  it("set/get devuelve el valor vigente", () => {
    setCached("k", { a: 1 });
    expect(getCached<{ a: number }>("k")).toEqual({ a: 1 });
  });

  it("withCache memoiza (la función corre una sola vez)", async () => {
    const fn = vi.fn().mockResolvedValue(42);
    expect(await withCache("memo", fn)).toBe(42);
    expect(await withCache("memo", fn)).toBe(42);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("expira tras el TTL", () => {
    vi.useFakeTimers();
    setCached("ttl", "v", 1000);
    vi.advanceTimersByTime(1001);
    expect(getCached("ttl")).toBeNull();
  });

  it("miss devuelve null", () => {
    expect(getCached("nope")).toBeNull();
  });
});
