// Servidor MCP público da MDAccula — escrito à mão (sem @lovable.dev/mcp-js).
//
// Motivo: o bundle gerado pela biblioteca passava de 26MB (esbuild como dep
// direta) e a API da Supabase recusava o deploy com 413. Esta versão implementa
// o mínimo do protocolo MCP (JSON-RPC 2.0 sobre HTTP) e pesa alguns KB.
//
// Endpoint: https://<ref>.supabase.co/functions/v1/mcp
// Acesso: público (somente leitura de dados já públicos do site).

import { createClient } from "npm:@supabase/supabase-js@^2.111.0";

const PROTOCOL_VERSION = "2025-06-18";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, mcp-protocol-version, mcp-session-id",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

function supa() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

type ToolResult = {
  content: Array<{ type: "text"; text: string }>;
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
};

const ok = (payload: unknown, structured?: Record<string, unknown>): ToolResult => ({
  content: [{ type: "text", text: JSON.stringify(payload ?? [], null, 2) }],
  ...(structured ? { structuredContent: structured } : {}),
});

const fail = (message: string): ToolResult => ({
  content: [{ type: "text", text: message }],
  isError: true,
});

const EVENT_LIST_FIELDS =
  "id, title, subtitle, slug, venue, address, location_city, location_state, date, end_date, time, genres, ticket_link, image_url";
const EVENT_DETAIL_FIELDS =
  "id, title, subtitle, slug, venue, address, location_city, location_state, date, end_date, time, end_time, genres, lineup, description, schedule, ticket_link, vip_link, image_url, latitude, longitude";
const POST_LIST_FIELDS =
  "id, title, slug, excerpt, category, image_url, views, likes, published_at";
const POST_DETAIL_FIELDS =
  "id, title, slug, excerpt, content, category, image_url, views, likes, published_at, meta_description";

function clampLimit(value: unknown, fallback = 10): number {
  const n = typeof value === "number" ? Math.trunc(value) : Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(50, Math.max(1, n));
}

function requiredSlug(value: unknown): string | null {
  const slug = typeof value === "string" ? value.trim() : "";
  return slug.length > 0 ? slug : null;
}

const TOOLS = [
  {
    name: "list_upcoming_events",
    title: "Listar próximos eventos",
    description:
      "Retorna os próximos eventos publicados da MDAccula (São Paulo), ordenados por data crescente. Inclui título, local, data, gêneros e link do evento.",
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
    inputSchema: {
      type: "object",
      properties: {
        limit: {
          type: "integer",
          minimum: 1,
          maximum: 50,
          default: 10,
          description: "Quantidade máxima de eventos a retornar (1-50).",
        },
      },
      additionalProperties: false,
    },
    handler: async (args: Record<string, unknown>): Promise<ToolResult> => {
      const today = new Date().toISOString().slice(0, 10);
      const { data, error } = await supa()
        .from("events")
        .select(EVENT_LIST_FIELDS)
        .eq("status", "published")
        .gte("date", today)
        .order("date", { ascending: true })
        .limit(clampLimit(args.limit));
      if (error) return fail(`Erro: ${error.message}`);
      return ok(data ?? [], { events: data ?? [] });
    },
  },
  {
    name: "get_event",
    title: "Detalhes de um evento",
    description:
      "Retorna os detalhes completos de um evento MDAccula pelo slug (ex.: 'parador-reveillon'). Inclui line-up, descrição, horários e link de ingresso.",
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
    inputSchema: {
      type: "object",
      properties: { slug: { type: "string", minLength: 1, description: "Slug do evento (URL)." } },
      required: ["slug"],
      additionalProperties: false,
    },
    handler: async (args: Record<string, unknown>): Promise<ToolResult> => {
      const slug = requiredSlug(args.slug);
      if (!slug) return fail("Parâmetro 'slug' é obrigatório.");
      const { data, error } = await supa()
        .from("events")
        .select(EVENT_DETAIL_FIELDS)
        .eq("slug", slug)
        .eq("status", "published")
        .maybeSingle();
      if (error) return fail(`Erro: ${error.message}`);
      if (!data) return fail(`Evento '${slug}' não encontrado.`);
      return ok(data, { event: data });
    },
  },
  {
    name: "list_blog_posts",
    title: "Listar posts do blog",
    description:
      "Lista os posts publicados no blog da MDAccula, do mais recente ao mais antigo. Suporta filtro por categoria e busca por palavra-chave.",
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "integer", minimum: 1, maximum: 50, default: 10 },
        category: { type: "string", description: "Filtrar por categoria (opcional)." },
        search: { type: "string", description: "Buscar por termo no título ou resumo (opcional)." },
      },
      additionalProperties: false,
    },
    handler: async (args: Record<string, unknown>): Promise<ToolResult> => {
      let query = supa()
        .from("blog_posts")
        .select(POST_LIST_FIELDS)
        .eq("published", true)
        .order("published_at", { ascending: false })
        .limit(clampLimit(args.limit));
      const category = typeof args.category === "string" ? args.category.trim() : "";
      const search = typeof args.search === "string" ? args.search.trim() : "";
      if (category) query = query.eq("category", category);
      // Escapa vírgula/parênteses para não quebrar a sintaxe do filtro `or`.
      if (search) {
        const safe = search.replace(/[,()]/g, " ");
        query = query.or(`title.ilike.%${safe}%,excerpt.ilike.%${safe}%`);
      }
      const { data, error } = await query;
      if (error) return fail(`Erro: ${error.message}`);
      return ok(data ?? [], { posts: data ?? [] });
    },
  },
  {
    name: "get_blog_post",
    title: "Detalhes de um post do blog",
    description:
      "Retorna o conteúdo completo de um post publicado no blog MDAccula, buscado pelo slug.",
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
    inputSchema: {
      type: "object",
      properties: { slug: { type: "string", minLength: 1, description: "Slug do post (URL)." } },
      required: ["slug"],
      additionalProperties: false,
    },
    handler: async (args: Record<string, unknown>): Promise<ToolResult> => {
      const slug = requiredSlug(args.slug);
      if (!slug) return fail("Parâmetro 'slug' é obrigatório.");
      const { data, error } = await supa()
        .from("blog_posts")
        .select(POST_DETAIL_FIELDS)
        .eq("slug", slug)
        .eq("published", true)
        .maybeSingle();
      if (error) return fail(`Erro: ${error.message}`);
      if (!data) return fail(`Post '${slug}' não encontrado.`);
      return ok(data, { post: data });
    },
  },
  {
    name: "list_links",
    title: "Listar links públicos (Linktree)",
    description:
      "Lista os links públicos ativos da página de links da MDAccula (estilo Linktree), agrupados por seção.",
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
    inputSchema: { type: "object", properties: {} },
    handler: async (): Promise<ToolResult> => {
      const { data, error } = await supa()
        .from("link_groups")
        .select(
          "id, name, slug, display_order, enabled, custom_links(id, title, subtitle, url, is_featured, display_order, enabled)",
        )
        .eq("enabled", true)
        .order("display_order", { ascending: true });
      if (error) return fail(`Erro: ${error.message}`);
      return ok(data ?? [], { groups: data ?? [] });
    },
  },
] as const;

const SERVER_INFO = { name: "mdaccula-mcp", title: "MDAccula MCP", version: "0.2.0" };
const INSTRUCTIONS =
  "Ferramentas públicas da MDAccula (agência de música eletrônica em São Paulo). Use `list_upcoming_events` e `get_event` para eventos, `list_blog_posts` e `get_blog_post` para artigos do blog, e `list_links` para os links oficiais (Linktree). Todos os dados retornados são públicos.";

function publicToolList() {
  return TOOLS.map(({ name, title, description, annotations, inputSchema }) => ({
    name,
    title,
    description,
    annotations,
    inputSchema,
  }));
}

type JsonRpcRequest = {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: Record<string, unknown>;
};

async function handleRpc(req: JsonRpcRequest): Promise<Record<string, unknown> | null> {
  const { id = null, method, params = {} } = req;
  const reply = (result: unknown) => ({ jsonrpc: "2.0", id, result });
  const rpcError = (code: number, message: string) => ({
    jsonrpc: "2.0",
    id,
    error: { code, message },
  });

  switch (method) {
    case "initialize":
      return reply({
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVER_INFO,
        instructions: INSTRUCTIONS,
      });
    case "notifications/initialized":
    case "notifications/cancelled":
      return null; // notificação: sem resposta
    case "ping":
      return reply({});
    case "tools/list":
      return reply({ tools: publicToolList() });
    case "tools/call": {
      const name = String((params as { name?: unknown }).name ?? "");
      const args = ((params as { arguments?: Record<string, unknown> }).arguments ?? {}) as Record<
        string,
        unknown
      >;
      const tool = TOOLS.find((t) => t.name === name);
      if (!tool) return rpcError(-32602, `Ferramenta desconhecida: ${name}`);
      try {
        return reply(await tool.handler(args));
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        console.error(`[mcp] falha em ${name}:`, message);
        return reply(fail(`Erro ao executar '${name}': ${message}`));
      }
    }
    default:
      return rpcError(-32601, `Método não suportado: ${method}`);
  }
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const url = new URL(request.url);

  // Descoberta simples (usada por alguns clientes / pelo painel da Lovable).
  if (request.method === "GET") {
    if (url.pathname.endsWith("/.mcp/list-tools")) {
      return Response.json(
        { server: SERVER_INFO, instructions: INSTRUCTIONS, tools: publicToolList() },
        { headers: corsHeaders },
      );
    }
    return Response.json(
      { server: SERVER_INFO, protocolVersion: PROTOCOL_VERSION, transport: "streamable-http" },
      { headers: corsHeaders },
    );
  }

  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { jsonrpc: "2.0", id: null, error: { code: -32700, message: "JSON inválido" } },
      { status: 400, headers: corsHeaders },
    );
  }

  const headers = { ...corsHeaders, "Content-Type": "application/json" };

  // Lote (array) ou requisição única.
  if (Array.isArray(body)) {
    const results = (await Promise.all(body.map((item) => handleRpc(item as JsonRpcRequest)))).filter(
      (r): r is Record<string, unknown> => r !== null,
    );
    if (results.length === 0) return new Response(null, { status: 202, headers: corsHeaders });
    return new Response(JSON.stringify(results), { headers });
  }

  const result = await handleRpc(body as JsonRpcRequest);
  if (result === null) return new Response(null, { status: 202, headers: corsHeaders });
  return new Response(JSON.stringify(result), { headers });
});
