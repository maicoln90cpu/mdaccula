// Cria 1 campanha na E-goi cobrindo N eventos (template "Virada de lote —
// múltiplos eventos"). Diferente de create-event-event-email-campaign (1
// evento = 1 linha), esta function faz o claim de TODOS os eventos
// selecionados de forma tudo-ou-nada, e insere N linhas em
// event_email_campaigns (uma por evento) compartilhando o MESMO
// egoi_campaign_id — assim cada evento aparece individualmente como
// "enviado" no histórico (EmailEventsTab.tsx), sem precisar de tabela de
// relacionamento nova.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { safeCacheStaticMapImagesInHtml } from '../_shared/renderStaticMapCache.ts';
import { egoiRequest, sendEgoiCampaign } from '../_shared/egoiClient.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Janela de "claim recente" pro force_resend (ver Guard 3 abaixo). Uma
// reenviada deliberada pelo admin acontece bem depois disso; uma corrida de
// 2 cliques/2 abas fica dentro dela.
const DISPATCH_CLAIM_STALE_MS = 15_000;

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
    const eventIds = Array.isArray(body?.event_ids)
      ? [...new Set((body.event_ids as unknown[]).filter((id): id is string => typeof id === 'string' && id.length > 0))]
      : [];
    const html = body?.html as string | undefined;
    const subject = (body?.subject as string | undefined) || undefined;
    const preheader = (body?.preheader as string | undefined) || undefined;
    const sendNow = body?.send_now === true;
    const forceResend = body?.force_resend === true;
    // Segmento por disparo (aba "Envio manual") — mesma semântica do
    // create-event-email-campaign sibling: quando a chave vem no body (mesmo
    // que null, para "toda a lista"), sobrescreve o segmento global de
    // egoi_config.segment_id só para este envio. Ausente = usa o global.
    const segmentOverrideProvided = Object.prototype.hasOwnProperty.call(body, 'segment_id');
    const segmentIdOverride = segmentOverrideProvided
      ? (body?.segment_id != null ? Number(body.segment_id) : null)
      : undefined;

    if (eventIds.length === 0 || !html || !subject) {
      return json({ error: 'event_ids (array não vazio), html e subject são obrigatórios' }, 400);
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
    const { data: cfg } = await admin.from('egoi_config').select('*').maybeSingle();
    if (!cfg || !cfg.is_enabled || !cfg.list_id || !cfg.sender_id) {
      return json({ skipped: true, reason: 'config_disabled_or_incomplete' });
    }
    const resolvedSegmentId = segmentOverrideProvided
      ? segmentIdOverride
      : cfg.segment_id != null
        ? Number(cfg.segment_id)
        : null;

    const apiKey = Deno.env.get('EGOI_API_KEY');
    if (!apiKey) return json({ error: 'EGOI_API_KEY não configurada' }, 500);

    // Guard 3: claim tudo-ou-nada dos N eventos — numa ÚNICA instrução SQL.
    // Antes havia um UPDATE de reset incondicional (quando forceResend)
    // seguido de um UPDATE de claim, em duas idas separadas ao banco — duas
    // requisições de "reenviar" quase simultâneas podiam intercalar essas
    // idas e cada uma "roubar" o claim da outra, disparando a campanha 2x
    // pra lista inteira. Com forceResend, só reivindica eventos sem claim ou
    // com claim já antigo (não uma corrida em andamento agora); mesmo
    // raciocínio do create-event-email-campaign sibling.
    const now = new Date().toISOString();
    const staleClaimBefore = new Date(Date.now() - DISPATCH_CLAIM_STALE_MS)
      .toISOString()
      .replace(/\.\d+Z$/, 'Z');
    let claimQuery = admin
      .from('events')
      .update({ email_campaign_dispatched_at: now })
      .in('id', eventIds);
    claimQuery = forceResend
      ? claimQuery.or(
          `email_campaign_dispatched_at.is.null,email_campaign_dispatched_at.lt.${staleClaimBefore}`
        )
      : claimQuery.is('email_campaign_dispatched_at', null);
    const { data: claimed, error: claimErr } = await claimQuery.select('id,title,status');
    if (claimErr) throw claimErr;

    const claimedRows = claimed ?? [];
    const claimedIds = claimedRows.map((e) => e.id as string);

    if (claimedIds.length !== eventIds.length) {
      if (claimedIds.length > 0) {
        await admin.from('events').update({ email_campaign_dispatched_at: null }).in('id', claimedIds);
      }
      const blockedIds = eventIds.filter((id) => !claimedIds.includes(id));
      return json({
        error: 'Um ou mais eventos já têm campanha disparada (ou não existem). Nenhum e-mail foi enviado.',
        blocked_event_ids: blockedIds,
      }, 409);
    }

    const inactive = claimedRows.filter((e) => e.status !== 'active');
    if (inactive.length > 0) {
      await admin.from('events').update({ email_campaign_dispatched_at: null }).in('id', eventIds);
      return json({
        error: 'Um ou mais eventos selecionados não estão ativos. Nenhum e-mail foi enviado.',
        inactive_event_ids: inactive.map((e) => e.id),
      }, 409);
    }

    // Pré-renderiza mapas estáticos no Bunny CDN (custo fixo por campanha).
    const processedHtml = await safeCacheStaticMapImagesInHtml(html, 'create-multi-event-email-campaign');

    const internalName = `MDAccula • Virada de lote (${eventIds.length} eventos) • ${now.slice(0, 10)}`;
    const createPayload: Record<string, unknown> = {
      list_id: Number(cfg.list_id),
      internal_name: internalName,
      subject,
      sender_id: Number(cfg.sender_id),
      content: {
        type: 'html',
        body: processedHtml,
        ...(preheader ? { preheader } : {}),
      },
      tags: ['mdaccula', 'virada-de-lote-multi'],
    };
    if (cfg.reply_to) createPayload.reply_to = Number(cfg.reply_to);
    if (resolvedSegmentId) createPayload.segment_id = resolvedSegmentId;

    const created = await egoiRequest('/campaigns/email', apiKey, {
      method: 'POST',
      body: JSON.stringify(createPayload),
    });

    let campaignHash: string | null = null;
    let campaignStatus: 'draft' | 'failed' | 'sent' = 'failed';
    let errorMessage: string | null = null;
    let sentAt: string | null = null;

    if (created.ok) {
      campaignHash =
        created.body?.campaign_hash ||
        created.body?.hash ||
        created.body?.data?.campaign_hash ||
        (created.body?.campaign_id != null ? String(created.body.campaign_id) : null) ||
        (created.body?.id != null ? String(created.body.id) : null);
      campaignStatus = 'draft';

      if (sendNow && !campaignHash) {
        errorMessage =
          'Campanha criada na E-goi, mas não foi possível extrair o hash pra confirmar o envio ' +
          `(campos esperados ausentes na resposta): ${JSON.stringify(created.body).slice(0, 500)}`;
      } else if (sendNow && campaignHash) {
        const sendRes = await sendEgoiCampaign(campaignHash, Number(cfg.list_id), apiKey, resolvedSegmentId);
        if (sendRes.ok) {
          campaignStatus = 'sent';
          sentAt = new Date().toISOString();
        } else {
          errorMessage = `E-goi send ${sendRes.status}: ${
            typeof sendRes.body === 'string' ? sendRes.body : JSON.stringify(sendRes.body)
          }`.slice(0, 1000);
        }
      }
    } else {
      // Falha na criação — libera o claim dos N eventos para nova tentativa.
      await admin.from('events').update({ email_campaign_dispatched_at: null }).in('id', eventIds);
      errorMessage = `E-goi ${created.status}: ${
        typeof created.body === 'string' ? created.body : JSON.stringify(created.body)
      }`.slice(0, 1000);
    }

    // N linhas, uma por evento, mesmo egoi_campaign_id — é isso que faz cada
    // evento aparecer individualmente como "enviado" no histórico.
    const rows = eventIds.map((eventId) => ({
      event_id: eventId,
      egoi_campaign_id: campaignHash,
      status: campaignStatus,
      mode: sendNow ? 'immediate' : 'draft',
      error_message: errorMessage,
      sent_at: sentAt,
      segment_id: resolvedSegmentId,
      campaign_type: 'multi_event',
    }));
    // Grava o histórico mesmo quando a criação na E-goi falhou (campaignStatus
    // 'failed' com errorMessage preenchido) — mesmo padrão do
    // create-event-email-campaign sibling, que sempre persiste uma linha para
    // o admin ver o erro no histórico/dashboard, em vez de não deixar rastro.
    const { error: insertError } = await admin.from('event_email_campaigns').insert(rows);

    let finalErrorMessage = errorMessage;
    if (insertError) {
      finalErrorMessage = finalErrorMessage
        ? `${finalErrorMessage} (aviso: falha ao gravar histórico: ${insertError.message})`
        : `Aviso: falha ao gravar histórico: ${insertError.message}`;
    }

    return json({
      ok: campaignStatus !== 'failed',
      status: campaignStatus,
      egoi_campaign_id: campaignHash,
      error: finalErrorMessage,
      event_ids: eventIds,
    });
  } catch (e) {
    console.error('[create-multi-event-email-campaign] Falha não tratada:', e);
    return json({ error: (e as Error).message }, 500);
  }
});
