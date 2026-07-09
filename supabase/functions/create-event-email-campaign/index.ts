// B.6 — Cria rascunho de campanha na E-goi para um evento.
// Guards (defesa em profundidade):
//  1. Auth admin (getUser + has_role).
//  2. Master switch site_settings.egoi_email_enabled = true.
//  3. Agência: egoi_config.is_enabled + list_id + sender_id preenchidos.
//  4. UPDATE atômico em events.email_campaign_dispatched_at (WHERE IS NULL) — previne race.
// Idempotência: se existe campanha 'sent' → cria nova; 'draft/failed/scheduled' → atualiza a existente.

import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BASE = 'https://api.egoiapp.com';

type Mode = 'draft' | 'immediate' | 'scheduled';

async function egoiRequest(path: string, apiKey: string, init: RequestInit = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      Apikey: apiKey,
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  let body: any = text;
  try { body = JSON.parse(text); } catch { /* keep raw */ }
  return { status: res.status, ok: res.ok, body };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Não autenticado' }, 401);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const anonClient = createClient(supabaseUrl, anonKey);
    const admin = createClient(supabaseUrl, serviceKey);

    const token = authHeader.replace('Bearer ', '');
    const { data: userData, error: userErr } = await anonClient.auth.getUser(token);
    if (userErr || !userData.user) return json({ error: 'Token inválido' }, 401);

    const { data: isAdmin } = await admin.rpc('has_role', {
      _user_id: userData.user.id,
      _role: 'admin',
    });
    if (!isAdmin) return json({ error: 'Apenas admins' }, 403);

    const body = await req.json().catch(() => ({}));
    const eventId = body?.event_id as string | undefined;
    const html = body?.html as string | undefined;
    const subject = (body?.subject as string | undefined) || undefined;
    const preheader = (body?.preheader as string | undefined) || undefined;
    const forceResend = body?.force_resend === true;

    if (!eventId || !html) {
      return json({ error: 'event_id e html são obrigatórios' }, 400);
    }

    // Guard 1: Master switch
    const { data: masterRow } = await admin
      .from('site_settings')
      .select('value')
      .eq('key', 'egoi_email_enabled')
      .maybeSingle();
    if (masterRow?.value !== 'true') {
      return json({ skipped: true, reason: 'master_off' });
    }

    // Guard 2: Agência config
    const { data: cfg } = await admin
      .from('egoi_config')
      .select('*')
      .maybeSingle();
    if (!cfg || !cfg.is_enabled || !cfg.list_id || !cfg.sender_id) {
      return json({ skipped: true, reason: 'config_disabled_or_incomplete' });
    }

    // Guard 3: UPDATE atômico do dispatched_at.
    // Só marca se ainda estiver NULL — anti-race e anti-double-click.
    // force_resend permite botão "Reenviar" limpar antes de chamar novamente.
    if (forceResend) {
      await admin
        .from('events')
        .update({ email_campaign_dispatched_at: null })
        .eq('id', eventId);
    }

    const now = new Date().toISOString();
    const { data: claimed, error: claimErr } = await admin
      .from('events')
      .update({ email_campaign_dispatched_at: now })
      .eq('id', eventId)
      .is('email_campaign_dispatched_at', null)
      .select('id,title,status')
      .maybeSingle();

    if (claimErr) throw claimErr;
    if (!claimed) {
      return json({ skipped: true, reason: 'already_dispatched' });
    }
    if (claimed.status !== 'active') {
      // Evento não está ativo — reverte a marca.
      await admin.from('events').update({ email_campaign_dispatched_at: null }).eq('id', eventId);
      return json({ skipped: true, reason: 'event_not_active' });
    }

    const apiKey = Deno.env.get('EGOI_API_KEY');
    if (!apiKey) {
      await admin.from('events').update({ email_campaign_dispatched_at: null }).eq('id', eventId);
      return json({ error: 'EGOI_API_KEY não configurada' }, 500);
    }

    // Idempotência: se última campanha para o evento não é 'sent', reutiliza a linha.
    const { data: lastCampaign } = await admin
      .from('event_email_campaigns')
      .select('*')
      .eq('event_id', eventId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const reuseRow = lastCampaign && lastCampaign.status !== 'sent';

    const mode: Mode = (cfg.mode as Mode) || 'draft';
    const internalName = `MDAccula • ${claimed.title || 'Evento'} • ${now.slice(0, 10)}`;
    const finalSubject = subject || `Novo evento: ${claimed.title}`;

    // E-goi v3: cria campanha e-mail.
    // Endpoint principal: POST /campaigns  (type=email).
    // Guardamos a resposta bruta em error_message quando falha para facilitar debug.
    const createPayload = {
      type: 'email',
      list_id: Number(cfg.list_id),
      internal_name: internalName,
      subject: finalSubject,
      sender_id: Number(cfg.sender_id),
      preheader: preheader || null,
      segment_id: cfg.segment_id ? Number(cfg.segment_id) : undefined,
      content: {
        type: 'html',
        html,
      },
    };

    const created = await egoiRequest('/campaigns', apiKey, {
      method: 'POST',
      body: JSON.stringify(createPayload),
    });

    let campaignHash: string | null = null;
    let campaignStatus: 'draft' | 'failed' = 'failed';
    let errorMessage: string | null = null;

    if (created.ok) {
      campaignHash =
        created.body?.campaign_hash ||
        created.body?.hash ||
        created.body?.data?.campaign_hash ||
        String(created.body?.campaign_id ?? created.body?.id ?? '') ||
        null;
      campaignStatus = 'draft';
    } else {
      errorMessage = `E-goi ${created.status}: ${
        typeof created.body === 'string' ? created.body : JSON.stringify(created.body)
      }`.slice(0, 1000);
    }

    // Persistência do histórico
    const rowPayload = {
      event_id: eventId,
      egoi_campaign_id: campaignHash,
      status: campaignStatus,
      mode,
      error_message: errorMessage,
      sent_at: null,
    };

    if (reuseRow && lastCampaign) {
      await admin
        .from('event_email_campaigns')
        .update(rowPayload)
        .eq('id', lastCampaign.id);
    } else {
      await admin.from('event_email_campaigns').insert(rowPayload);
    }

    // Se falhou, mantemos dispatched_at marcado propositalmente (evita loop de retry automático).
    // O admin pode usar o botão "Reenviar" no painel B.4 para limpar e tentar de novo.
    return json({
      ok: campaignStatus === 'draft',
      status: campaignStatus,
      egoi_campaign_id: campaignHash,
      error: errorMessage,
      _debug: { egoi_status: created.status },
    });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
