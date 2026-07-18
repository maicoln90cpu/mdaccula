import { createContext } from "react";
import type { Block, GlobalBlock } from "@/lib/emailTemplates/blocks";

export type EmailGlobalBlocksCtx = {
  globals: GlobalBlock[];
  globalsMap: Map<string, GlobalBlock>;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  saveAsGlobal: (
    block: Block,
    meta: { name: string; description?: string; category?: string },
  ) => Promise<GlobalBlock | null>;
  updateGlobal: (id: string, patch: Partial<Omit<GlobalBlock, "id">>) => Promise<void>;
  deleteGlobal: (id: string) => Promise<void>;
};

export const EmailGlobalBlocksContext = createContext<EmailGlobalBlocksCtx | null>(null);
