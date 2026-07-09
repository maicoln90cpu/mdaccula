// Helper E-goi: retorna listas, remetentes e (opcionalmente) segmentos de uma lista.
// Requer admin autenticado. Somente leitura na API E-goi — não altera nada.
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BASE = 'https://api.egoiapp.com';

async function egoiFetch(path: string, apiKey: string) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Apikey: apiKey, Accept: 'application/json' },
  });
  const text = await res.text();
  let body: unknown = text;
  try { body = JSON.parse(text); } catch { /* keep raw */ }
  return { status: res.status, ok: res.ok, body };
}

/** Normaliza payloads que podem vir como array direto ou { items: [...] } aninhado. */
function normalizeItems(raw: any): any[] {
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw?.items)) return raw.items;
  if (Array.isArray(raw?.data)) return raw.data;
  if (Array.isArray(raw?.items?.data)) return raw.items.data;
  return [];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Não autenticado' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!);
    const admin = createClient(supabaseUrl, serviceKey);

    const token = authHeader.replace('Bearer ', '');
    const { data: userData, error: userErr } = await anonClient.auth.getUser(token);
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: 'Token inválido' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: isAdmin } = await admin.rpc('has_role', {
      _user_id: userData.user.id,
      _role: 'admin',
    });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Apenas admins' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const apiKey = Deno.env.get('EGOI_API_KEY');
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'EGOI_API_KEY não configurada' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Roteamento: se `list_id` vier na query, retorna segmentos daquela lista.
    // Caso contrário, retorna listas + remetentes.
    const url = new URL(req.url);
    const listIdParam = url.searchParams.get('list_id');

    if (listIdParam) {
      const listId = Number(listIdParam);
      if (!Number.isFinite(listId)) {
        return new Response(JSON.stringify({ error: 'list_id inválido' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      // /lists/{listId}/segments — segmentos daquela lista.
      // /lists/{listId} — detalhes (usado para descobrir total de contatos).
      const [segmentsRes, listDetailRes] = await Promise.all([
        egoiFetch(`/lists/${listId}/segments`, apiKey),
        egoiFetch(`/lists/${listId}`, apiKey),
      ]);
      const segments = normalizeItems(segmentsRes.body).map((s: any) => ({
        segment_id: s.segment_id ?? s.id,
        name: s.name ?? s.internal_name ?? `Segmento ${s.segment_id ?? s.id}`,
        // A API pode devolver o total como total_contacts, contacts_count ou contacts.
        total_contacts:
          s.total_contacts ?? s.contacts_count ?? s.contacts ?? s.total ?? null,
      }));
      const listDetail = listDetailRes.body as any;
      const listTotal =
        listDetail?.total_contacts ??
        listDetail?.contacts_count ??
        listDetail?.contacts ??
        listDetail?.total ??
        null;
      return new Response(
        JSON.stringify({
          segments,
          list_total_contacts: listTotal,
          _debug: { segmentsStatus: segmentsRes.status, listDetailStatus: listDetailRes.status },
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const [listsRes, sendersRes] = await Promise.all([
      egoiFetch('/lists', apiKey),
      egoiFetch('/senders', apiKey),
    ]);

    const lists = normalizeItems(listsRes.body).map((l: any) => ({
      list_id: l.list_id ?? l.id,
      internal_name: l.internal_name ?? l.name,
      public_name: l.public_name ?? l.title,
      total_contacts:
        l.total_contacts ?? l.contacts_count ?? l.contacts ?? l.total ?? null,
    }));
    const senders = normalizeItems(sendersRes.body).map((s: any) => ({
      sender_id: s.sender_id ?? s.id,
      name: s.name ?? s.sender_name,
      email: s.email ?? s.sender_email,
    }));

    return new Response(
      JSON.stringify({
        lists,
        senders,
        _debug: { listsStatus: listsRes.status, sendersStatus: sendersRes.status },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
