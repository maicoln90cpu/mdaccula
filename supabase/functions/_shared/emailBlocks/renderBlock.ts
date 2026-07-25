// Render por bloco (switch principal). Extraído de emailBlocks.ts sem alterar
// nenhuma linha do switch — apenas movido para arquivo próprio.
import { EMAIL_BLOCK_LIMITS, clamp } from "../emailBlocksLimits.ts";
import type { Block, RenderContext, WeekendEventItem } from "./types.ts";
import { escape, sanitizeCustomHtml, resolveCtaUrl, resolveSecondaryUrl, proxyForEmail } from "./utils.ts";

export HEADER
cat /tmp/eb_renderBlock_body.ts >> supabase/functions/_shared/emailBlocks/renderBlock.ts
wc -l supabase/functions/_shared/emailBlocks/renderBlock.ts
