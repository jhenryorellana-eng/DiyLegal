import { afterEach, describe, expect, it } from "vitest";
import { supabaseAnonKey, supabaseUrl } from "@/lib/supabase/env";

const env = { ...process.env };
afterEach(() => {
  process.env = { ...env };
});

describe("supabase env", () => {
  it("supabaseUrl lanza si falta la env", () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    expect(() => supabaseUrl()).toThrow(/NEXT_PUBLIC_SUPABASE_URL/);
  });
  it("supabaseUrl devuelve el valor configurado", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://x.supabase.co";
    expect(supabaseUrl()).toBe("https://x.supabase.co");
  });
  it("supabaseAnonKey lanza si falta la env", () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    expect(() => supabaseAnonKey()).toThrow(/ANON_KEY/);
  });
});
