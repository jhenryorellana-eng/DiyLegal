import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createAdminClient } from "@/lib/supabase/admin";

const env = { ...process.env };
beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://x.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key";
});
afterEach(() => {
  process.env = { ...env };
});

describe("createAdminClient (service_role, server-only)", () => {
  it("lanza si falta la service_role key", () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    expect(() => createAdminClient()).toThrow(/SUPABASE_SERVICE_ROLE_KEY/);
  });
  it("lanza si falta la URL", () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    expect(() => createAdminClient()).toThrow(/NEXT_PUBLIC_SUPABASE_URL/);
  });
  it("crea el cliente con ambas variables presentes", () => {
    const client = createAdminClient();
    expect(client).toBeTruthy();
    expect(typeof client.from).toBe("function");
  });
});
