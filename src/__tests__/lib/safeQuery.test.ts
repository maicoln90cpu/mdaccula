import { describe, it, expect } from "vitest";
import { safeQuery } from "@/lib/safeQuery";

describe("safeQuery", () => {
  it("retorna data quando query bem-sucedida", async () => {
    const result = await safeQuery(async () => ({ data: { id: 1 }, error: null }));
    expect(result.data).toEqual({ id: 1 });
    expect(result.error).toBeNull();
  });

  it("retorna error quando supabase responde com erro", async () => {
    const result = await safeQuery(async () => ({
      data: null,
      error: { message: "RLS denied", code: "42501" },
    }));
    expect(result.data).toBeNull();
    expect(result.error?.message).toBe("RLS denied");
  });

  it("captura exceções inesperadas", async () => {
    const result = await safeQuery(async () => {
      throw new Error("network down");
    });
    expect(result.error?.message).toBe("network down");
  });

  it("relança quando throwOnError=true", async () => {
    await expect(
      safeQuery(async () => ({ data: null, error: { message: "boom" } }), {
        throwOnError: true,
      })
    ).rejects.toThrow("boom");
  });
});
