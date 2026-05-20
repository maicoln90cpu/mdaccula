import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useAdminRealtime } from "@/hooks/useAdminRealtime";
import { supabase } from "@/integrations/supabase/client";

// Substitui apenas channel/removeChannel do supabase mockado globalmente
const channelOn = vi.fn().mockReturnThis();
const channelSubscribe = vi.fn().mockImplementation(function (this: any, cb?: any) {
  cb?.("SUBSCRIBED");
  return this;
});
const channelObj = { on: channelOn, subscribe: channelSubscribe } as any;
const channelFactory = vi.fn().mockReturnValue(channelObj);
const removeChannel = vi.fn();

(supabase as any).channel = channelFactory;
(supabase as any).removeChannel = removeChannel;

describe("useAdminRealtime", () => {
  beforeEach(() => {
    channelOn.mockClear();
    channelSubscribe.mockClear();
    channelFactory.mockClear();
    removeChannel.mockClear();
  });

  it("assina UMA tabela quando recebe string", () => {
    const cb = vi.fn();
    const { unmount } = renderHook(() => useAdminRealtime("custom_links", cb));
    expect(channelFactory).toHaveBeenCalledTimes(1);
    expect(channelOn).toHaveBeenCalledTimes(1);
    expect(channelOn.mock.calls[0][1]).toMatchObject({
      event: "*",
      schema: "public",
      table: "custom_links",
    });
    unmount();
    expect(removeChannel).toHaveBeenCalledTimes(1);
  });

  it("assina MÚLTIPLAS tabelas no MESMO canal quando recebe array", () => {
    const cb = vi.fn();
    const { unmount } = renderHook(() =>
      useAdminRealtime(["custom_links", "link_groups"], cb),
    );
    // 1 canal, 2 listeners
    expect(channelFactory).toHaveBeenCalledTimes(1);
    expect(channelOn).toHaveBeenCalledTimes(2);
    const tables = channelOn.mock.calls.map((c: any[]) => c[1].table).sort();
    expect(tables).toEqual(["custom_links", "link_groups"]);
    unmount();
    expect(removeChannel).toHaveBeenCalledTimes(1);
  });

  it("NÃO assina quando enabled=false", () => {
    const cb = vi.fn();
    renderHook(() => useAdminRealtime(["custom_links"], cb, false));
    expect(channelFactory).not.toHaveBeenCalled();
  });

  it("NÃO assina quando array está vazio", () => {
    const cb = vi.fn();
    renderHook(() => useAdminRealtime([], vi.fn()));
    expect(channelFactory).not.toHaveBeenCalled();
    void cb;
  });
});
