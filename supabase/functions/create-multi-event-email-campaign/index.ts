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
import { beginInProgressHistoryRows, finalizeHistoryRows } from '../_shared/emailDispatchHistory.ts';

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

  // Referências pro catch externo poder liberar o claim (Guard 3) em QUALQUER
  // falha não prevista (ex.: timeout de rede no cache de imagens de mapa) —
  // mesmo raciocínio do create-event-email-campaign sibling (R-055).
  let claimAdmin: ReturnType<typeof createClient> | null = null;
  let claimEventIds: string[] = [];
  // R-062 — ids das linhas 'in_progress' gravadas na Fase 1 (antes de falar
  // com a E-goi) e se a criação na E-goi chegou a ser confirmada — usados no
  // catch externo pra decidir com segurança se libera o claim e como
  // finalizar o histórico, mesmo numa falha não prevista.
  let historyRowIds: string[] = [];
  let campaignConfirmedCreated = false;
  let confirmedCampaignHash: string | null = null;

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Não autenticado' }, 401);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const anonClient = createClient(supabaseUrl, anonKey);
    const admin = createClient(supabaseUrl, serviceKey);
    claimAdmin = admin;

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
    // R-059 — o PostgREST reaplica o WHERE do UPDATE sobre o RETURNING antes de
    // devolver as linhas; como esse WHERE testa a PRÓPRIA coluna que acabou de
    // ser sobrescrita (email_campaign_dispatched_at.is.null OU .lt.stale), a
    // condição nunca é verdadeira contra o valor novo — `.select()` encadeado
    // aqui sempre devolvia vazio mesmo quando o UPDATE realmente travava as
    // linhas (mesmo bug do create-event-email-campaign sibling). Sem `.select()`
    // encadeado (só `count: 'exact'`, que usa a contagem real de linhas afetadas
    // pelo UPDATE, não uma releitura filtrada), e uma leitura separada logo
    // depois pra descobrir exatamente quais linhas fomos nós que acabamos de
    // reivindicar (comparando com o valor exato de `now` que setamos).
    let claimQuery = admin
      .from('events')
      .update({ email_campaign_dispatched_at: now }, { count: 'exact' })
      .in('id', eventIds);
    claimQuery = forceResend
      ? claimQuery.or(
          `email_campaign_dispatched_at.is.null,email_campaign_dispatched_at.lt.${staleClaimBefore}`
        )
      : claimQuery.is('email_campaign_dispatched_at', null);
    const { error: claimErr } = await claimQuery;
    if (claimErr) throw claimErr;

    const { data: allRows } = await admin
      .from('events')
      .select('id,title,status,email_campaign_dispatched_at')
      .in('id', eventIds);
    const claimedRows = (allRows ?? []).filter((e) => e.email_campaign_dispatched_at === now);
    const claimedIds = claimedRows.map((e) => e.id as string);
    claimEventIds = claimedIds;

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

    // R-062 — Fase 1: grava a INTENÇÃO de disparo (N linhas 'in_progress',
    // uma por evento) em event_email_campaigns ANTES de qualquer chamada de
    // rede (cache de mapas, E-goi). A partir daqui, "claim setado sem nenhuma
    // linha de histórico" deixa de ser um estado alcançável — mesmo se a
    // function morrer sem lançar exceção nenhuma. Ver heal-stuck-email-dispatches.
    const mode = sendNow ? 'immediate' : 'draft';
    const { ids: beganIds, error: beginError } = await beginInProgressHistoryRows(
      admin,
      eventIds.map((eventId) => ({
        event_id: eventId,
        mode,
        segment_id: resolvedSegmentId,
        campaign_type: 'multi_event',
      })),
    );
    if (beginError || beganIds.length !== eventIds.length) {
      console.error('[create-multi-event-email-campaign] Falha ao gravar linhas "in_progress" de histórico:', beginError);
      await admin.from('events').update({ email_campaign_dispatched_at: null }).in('id', eventIds);
      return json({ error: `Falha ao registrar início do disparo: ${beginError ?? 'erro desconhecido'}` }, 500);
    }
    historyRowIds = beganIds;

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
      // R-062 — a partir daqui, a campanha existe de verdade na E-goi; o
      // catch externo não pode mais liberar o claim nem sobrescrever as
      // linhas de histórico como "nunca criadas", mesmo que algo dê errado
      // logo depois (ex.: sendEgoiCampaign travar).
      campaignConfirmedCreated = true;
      campaignHash =
        created.body?.campaign_hash ||
        created.body?.hash ||
        created.body?.data?.campaign_hash ||
        (created.body?.campaign_id != null ? String(created.body.campaign_id) : null) ||
        (created.body?.id != null ? String(created.body.id) : null);
      confirmedCampaignHash = campaignHash;
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

    // R-062 — Fase 2: finaliza as MESMAS N linhas 'in_progress' gravadas na
    // Fase 1 (nunca insere linha nova aqui — cada evento já tem sua linha
    // própria desde antes da chamada à E-goi, é isso que faz cada um
    // aparecer individualmente como "enviado" no histórico). Grava o
    // resultado mesmo quando a criação na E-goi falhou (campaignStatus
    // 'failed' com errorMessage preenchido) — mesmo padrão do
    // create-event-email-campaign sibling, que sempre persiste o histórico
    // para o admin ver o erro no histórico/dashboard, em vez de não deixar rastro.
    const rowPayload: Record<string, unknown> = {
      egoi_campaign_id: campaignHash,
      status: campaignStatus,
      error_message: errorMessage,
      sent_at: sentAt,
    };
    const { error: finalizeError } = await finalizeHistoryRows(admin, historyRowIds, rowPayload);

    let finalErrorMessage = errorMessage;
    if (finalizeError) {
      console.error('[create-multi-event-email-campaign] Falha ao gravar histórico (update):', finalizeError);
      finalErrorMessage = finalErrorMessage
        ? `${finalErrorMessage} (aviso: falha ao gravar histórico: ${finalizeError})`
        : `Aviso: falha ao gravar histórico: ${finalizeError}`;
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
    const errMsg = (e as Error).message;
    // R-062 — só libera o claim quando a campanha NÃO chegou a ser confirmada
    // como criada na E-goi (mesma doutrina do R-058: se `created.ok` já era
    // true, a campanha existe de verdade, e liberar o claim deixaria o admin
    // recriar/reenviar em cima dela).
    if (claimAdmin && claimEventIds.length > 0 && !campaignConfirmedCreated) {
      try {
        await claimAdmin.from('events').update({ email_campaign_dispatched_at: null }).in('id', claimEventIds);
      } catch (releaseErr) {
        console.error('[create-multi-event-email-campaign] Falha ao liberar claim após erro:', releaseErr);
      }
    }
    // R-062 — finaliza as linhas 'in_progress' da Fase 1 pra não ficarem
    // presas pra sempre; best-effort (não deixa um erro aqui mascarar o 500 real).
    if (claimAdmin && historyRowIds.length > 0) {
      try {
        await finalizeHistoryRows(claimAdmin, historyRowIds, {
          status: campaignConfirmedCreated ? 'draft' : 'failed',
          egoi_campaign_id: confirmedCampaignHash,
          error_message: campaignConfirmedCreated
            ? `Campanha criada na E-goi (${confirmedCampaignHash ?? 'hash desconhecido'}), mas a function falhou logo depois: ${errMsg}`
            : errMsg,
        });
      } catch (finalizeErr) {
        console.error('[create-multi-event-email-campaign] Falha ao finalizar histórico após erro:', finalizeErr);
      }
    }
    return json({ error: errMsg }, 500);
  }
});
