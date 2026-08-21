// B.6 — Cria rascunho de campanha na E-goi para um evento.
// Guards (defesa em profundidade):
//  1. Auth admin (getUser + has_role).
//  2. Master switch site_settings.egoi_email_enabled = true.
//  3. Agência: egoi_config.is_enabled + list_id + sender_id preenchidos.
//  4. UPDATE atômico em events.email_campaign_dispatched_at (WHERE IS NULL) — previne race.
// Idempotência: se existe campanha 'sent' → cria nova; 'draft/failed/scheduled' → atualiza a existente.

import { createClient } from 'npm:@supabase/supabase-js@2';
import { egoiRequest, sendEgoiCampaign } from '../_shared/egoiClient.ts';
import { cacheStaticMapImagesInHtml } from '../_shared/renderStaticMapCache.ts';
import { beginInProgressHistoryRow, finalizeHistoryRow } from '../_shared/emailDispatchHistory.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type Mode = 'draft' | 'immediate' | 'scheduled';

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
  // sem isso, uma falha inesperada deixava o evento travado pra reenvio até
  // o claim ficar "velho" (DISPATCH_CLAIM_STALE_MS), mesmo sem nenhuma
  // campanha ter sido criada (R-055).
  let claimAdmin: ReturnType<typeof createClient> | null = null;
  let claimEventId: string | undefined;
  let claimIsAbTest = false;
  // R-062 — id da linha 'in_progress' gravada na Fase 1 (antes de falar com a
  // E-goi) e se a criação na E-goi chegou a ser confirmada — usados no catch
  // externo pra decidir com segurança se libera o claim e como finalizar a
  // linha de histórico, mesmo numa falha não prevista.
  let historyRowId: string | null = null;
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
    const eventId = body?.event_id as string | undefined;
    const html = body?.html as string | undefined;
    const subject = (body?.subject as string | undefined) || undefined;
    const preheader = (body?.preheader as string | undefined) || undefined;
    const textVersion = (body?.text as string | undefined) || undefined;
    const templateType = (body?.template_type as string | undefined) || 'event_new';
    const forceResend = body?.force_resend === true;
    const sendNow = body?.send_now === true;
    // B.10 — teste A/B de assunto
    const abGroupId = (body?.ab_group_id as string | undefined) || null;
    const abVariant = (body?.ab_variant as string | undefined) || null; // 'A' | 'B'
    const abTestConfig = (body?.ab_test_config as Record<string, unknown> | undefined) || null;
    const isAbTest = !!abGroupId && !!abVariant;
    claimEventId = eventId;
    claimIsAbTest = isAbTest;
    // Agendamento — cria o rascunho na E-goi agora, mas o envio real fica
    // para o poller send-scheduled-email-campaigns quando scheduled_at vencer.
    const scheduleAtRaw = (body?.schedule_at as string | undefined) || undefined;
    // Segmento por disparo (aba "Envio manual") — quando o campo vem no body
    // (mesmo que null, para "toda a lista"), sobrescreve o segmento global
    // de egoi_config.segment_id só para este envio. Ausente = usa o global.
    const segmentOverrideProvided = Object.prototype.hasOwnProperty.call(body, 'segment_id');
    const segmentIdOverride = segmentOverrideProvided
      ? (body?.segment_id != null ? Number(body.segment_id) : null)
      : undefined;

    if (!eventId || !html) {
      return json({ error: 'event_id e html são obrigatórios' }, 400);
    }
    if (isAbTest && !['A', 'B'].includes(abVariant!)) {
      return json({ error: 'ab_variant deve ser A ou B' }, 400);
    }
    if (scheduleAtRaw && sendNow) {
      return json({ error: 'schedule_at e send_now são mutuamente exclusivos' }, 400);
    }
    let scheduleAtIso: string | null = null;
    if (scheduleAtRaw) {
      const scheduleAtMs = Date.parse(scheduleAtRaw);
      if (Number.isNaN(scheduleAtMs)) {
        return json({ error: 'schedule_at inválido' }, 400);
      }
      if (scheduleAtMs < Date.now() + 60_000) {
        return json({ error: 'schedule_at precisa ser pelo menos 1 minuto no futuro' }, 400);
      }
      scheduleAtIso = new Date(scheduleAtMs).toISOString();
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
    const resolvedSegmentId = segmentOverrideProvided
      ? segmentIdOverride
      : cfg.segment_id != null
        ? Number(cfg.segment_id)
        : null;

    // Guard 3: UPDATE atômico do dispatched_at (pulado em A/B).
    // Só marca se ainda estiver NULL — anti-race e anti-double-click.
    // force_resend permite botão "Reenviar" limpar antes de chamar novamente.
    // B.10 — A/B: as duas variantes são intencionais, então bypass do claim; usa fetch para pegar title/status.
    let claimedTitle: string | null = null;
    let claimedStatus: string | null = null;
    const now = new Date().toISOString();

    if (isAbTest) {
      const { data: ev } = await admin
        .from('events')
        .select('id,title,status')
        .eq('id', eventId)
        .maybeSingle();
      if (!ev) return json({ error: 'Evento não encontrado' }, 404);
      if (ev.status !== 'active') return json({ skipped: true, reason: 'event_not_active' });
      claimedTitle = ev.title;
      claimedStatus = ev.status;
    } else {
      // Claim atômico numa ÚNICA instrução SQL. Antes havia um UPDATE de
      // reset incondicional (quando forceResend) seguido de um UPDATE de
      // claim, em duas idas separadas ao banco — duas requisições de
      // "reenviar" quase simultâneas (2 abas, duplo clique) podiam intercalar
      // essas idas e cada uma "roubar" o claim da outra, disparando a
      // campanha 2x pra lista inteira. Com forceResend, só reivindica se não
      // há claim, ou se o claim existente já é antigo (não uma corrida em
      // andamento agora) — o Postgres serializa updates concorrentes na
      // mesma linha, então a segunda requisição só reavalia esse WHERE
      // depois que a primeira já commitou seu claim recente.
      const staleClaimBefore = new Date(Date.now() - DISPATCH_CLAIM_STALE_MS)
        .toISOString()
        .replace(/\.\d+Z$/, 'Z');
      let claimQuery = admin
        .from('events')
        // R-059 — causa raiz definitiva do "dispatch_in_progress" que persistia
        // mesmo com o claim funcionando de verdade: o PostgREST reaplica o
        // WHERE do UPDATE sobre o RETURNING antes de devolver as linhas — e como
        // esse WHERE testa a PRÓPRIA coluna que acabou de ser sobrescrita
        // (email_campaign_dispatched_at.is.null OU .lt.staleClaimBefore), a
        // condição NUNCA é verdadeira contra o valor novo (acabado de gravar).
        // Resultado: o UPDATE sempre travava a linha de verdade (confirmado
        // por SQL direto: 1 linha alterada), mas `.select().maybeSingle()`
        // sempre devolvia vazio — a claim sempre "parecia" ter falhado, pra
        // TODO disparo manual (forceResend é sempre true nesse fluxo), mesmo
        // sem nenhuma corrida real acontecendo. Corrigido usando `count:
        // 'exact'` em vez de `.select()`: o Postgres calcula esse count a
        // partir das linhas realmente afetadas pelo UPDATE (semântica normal
        // de UPDATE...WHERE), sem reaplicar o filtro contra os valores novos.
        .update({ email_campaign_dispatched_at: now }, { count: 'exact' })
        .eq('id', eventId);
      claimQuery = forceResend
        ? claimQuery.or(
            `email_campaign_dispatched_at.is.null,email_campaign_dispatched_at.lt.${staleClaimBefore}`
          )
        : claimQuery.is('email_campaign_dispatched_at', null);

      const { error: claimErr, count: claimCount } = await claimQuery;

      if (claimErr) throw claimErr;
      if (!claimCount) {
        return json({
          skipped: true,
          reason: forceResend ? 'dispatch_in_progress' : 'already_dispatched',
        });
      }

      // Já temos exclusividade sobre o evento (claim vencido acima) — busca
      // title/status agora, numa leitura separada e segura.
      const { data: claimedEv } = await admin
        .from('events')
        .select('id,title,status')
        .eq('id', eventId)
        .maybeSingle();
      if (!claimedEv) return json({ error: 'Evento não encontrado' }, 404);
      if (claimedEv.status !== 'active') {
        await admin.from('events').update({ email_campaign_dispatched_at: null }).eq('id', eventId);
        return json({ skipped: true, reason: 'event_not_active' });
      }
      claimedTitle = claimedEv.title;
      claimedStatus = claimedEv.status;
    }

    const apiKey = Deno.env.get('EGOI_API_KEY');
    if (!apiKey) {
      if (!isAbTest) {
        await admin.from('events').update({ email_campaign_dispatched_at: null }).eq('id', eventId);
      }
      return json({ error: 'EGOI_API_KEY não configurada' }, 500);
    }

    // Idempotência: em A/B, NUNCA reutiliza linha (cada variante é um registro novo).
    let reuseRow: any = null;
    if (!isAbTest) {
      const { data: lastCampaign } = await admin
        .from('event_email_campaigns')
        .select('*')
        .eq('event_id', eventId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      reuseRow = lastCampaign && lastCampaign.status !== 'sent' ? lastCampaign : null;
    }

    const mode: Mode = sendNow ? 'immediate' : scheduleAtIso ? 'scheduled' : ((cfg.mode as Mode) || 'draft');
    const abSuffix = isAbTest ? ` • A/B ${abVariant}` : '';
    const internalName = `MDAccula • ${claimedTitle || 'Evento'} • ${now.slice(0, 10)}${abSuffix}`;
    const finalSubject = subject?.trim();
    if (!finalSubject) {
      if (!isAbTest) {
        await admin.from('events').update({ email_campaign_dispatched_at: null }).eq('id', eventId);
      }
      return json({ error: 'Assunto do template está vazio' }, 400);
    }

    // R-062 — Fase 1: grava a INTENÇÃO de disparo em event_email_campaigns
    // (status 'in_progress') ANTES de qualquer chamada de rede (cache de
    // mapas, E-goi). A partir daqui, "claim setado sem nenhuma linha de
    // histórico" deixa de ser um estado alcançável — mesmo se a function
    // morrer sem lançar exceção nenhuma. Ver heal-stuck-email-dispatches.
    const historyBasePayload: Record<string, unknown> = {
      event_id: eventId,
      mode,
      segment_id: resolvedSegmentId,
      campaign_type: isAbTest ? 'ab_subject' : 'standard',
      ab_group_id: abGroupId,
      ab_variant: abVariant,
      ab_test_config: abTestConfig,
      scheduled_at: scheduleAtIso,
      scheduled_send_claimed_at: null,
      scheduled_send_attempts: 0,
    };
    const { id: beganId, error: beginError } = await beginInProgressHistoryRow(
      admin,
      historyBasePayload,
      reuseRow ? (reuseRow as { id: string }).id : null,
    );
    if (beginError || !beganId) {
      console.error('[create-event-email-campaign] Falha ao gravar linha "in_progress" de histórico:', beginError);
      if (!isAbTest) {
        await admin.from('events').update({ email_campaign_dispatched_at: null }).eq('id', eventId);
      }
      return json({ error: `Falha ao registrar início do disparo: ${beginError ?? 'erro desconhecido'}` }, 500);
    }
    historyRowId = beganId;

    // E-goi v3: POST /campaigns/email
    // Doc: https://developers.e-goi.com/api/v3/#tag/Email/operation/createEmailCampaign
    // content deve ser { type: 'html', body: '<html>...' } (NÃO "html").
    // Tag por tipo de template (courtesy, event_new, etc.) + A/B quando aplicável.
    const typeTagMap: Record<string, string> = {
      event_new: 'evento-novo',
      courtesy: 'cortesia',
      weekly_digest: 'digest-semanal',
      weekly_digest_editorial: 'digest-editorial',
      weekend_agenda: 'agenda-fds',
      promo: 'promocao',
    };
    const typeTag = typeTagMap[templateType] || 'evento-novo';
    const tags: string[] = ['mdaccula', typeTag];
    if (isAbTest) {
      tags.push('ab-test', `variante-${abVariant}`);
    }

    // B.11 — Pré-renderiza imagens de mapa estático no Bunny CDN, trocando
    // URLs do render-static-map por URLs do Bunny. Assim o Google Static Maps
    // é cobrado apenas uma vez por campanha, e não a cada abertura de e-mail.
    let processedHtml = html;
    try {
      processedHtml = await cacheStaticMapImagesInHtml(html);
    } catch (cacheErr) {
      const msg = cacheErr instanceof Error ? cacheErr.message : String(cacheErr);
      console.warn('[create-event-email-campaign] cacheStaticMapImagesInHtml fallback:', msg);
      // Falha no cache não pode bloquear o envio; mantém HTML original.
      processedHtml = html;
    }

    const createPayload: Record<string, unknown> = {
      list_id: Number(cfg.list_id),
      internal_name: withDispatchMarker(internalName, historyRowId),
      subject: finalSubject,
      sender_id: Number(cfg.sender_id),
      content: {
        type: 'html',
        body: processedHtml,
        ...(preheader ? { preheader } : {}),
        ...(textVersion ? { text: textVersion } : {}),
      },
      tags,
    };
    if (cfg.reply_to) createPayload.reply_to = Number(cfg.reply_to);
    if (resolvedSegmentId) createPayload.segment_id = resolvedSegmentId;

    const created = await egoiRequest('/campaigns/email', apiKey, {
      method: 'POST',
      body: JSON.stringify(createPayload),
    });

    let campaignHash: string | null = null;
    let campaignStatus: 'draft' | 'failed' | 'sent' | 'scheduled' = 'failed';
    let errorMessage: string | null = null;
    let sentAt: string | null = null;
    let egoiSendStatus: number | null = null;
    let egoiSendBody: unknown = null;

    if (created.ok) {
      // R-062 — a partir daqui, a campanha existe de verdade na E-goi; o
      // catch externo não pode mais liberar o claim nem sobrescrever esta
      // linha de histórico como "nunca criada", mesmo que algo dê errado
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

      // Agendamento — a campanha já foi criada como rascunho na E-goi acima;
      // o disparo real fica para o poller send-scheduled-email-campaigns
      // quando scheduled_at vencer. Mesma exigência de hash que o envio imediato:
      // sem hash, não há como o poller confirmar o envio depois (R-007).
      if (scheduleAtIso && !campaignHash) {
        errorMessage =
          'Campanha criada na E-goi, mas não foi possível extrair o hash pra agendar o envio ' +
          `(campos esperados ausentes na resposta): ${JSON.stringify(created.body).slice(0, 500)}`;
      } else if (scheduleAtIso && campaignHash) {
        campaignStatus = 'scheduled';
      }

      // B.7 — Envio imediato (opcional).
      if (sendNow && !campaignHash) {
        // Campanha foi criada (created.ok) mas nenhum dos campos esperados de hash
        // veio na resposta — sem hash não há como chamar actions/send. Isso NÃO pode
        // ficar silencioso: sem isso, o envio é pulado e a UI mostrava "enviado" mesmo
        // assim (regressão R-007).
        errorMessage =
          'Campanha criada na E-goi, mas não foi possível extrair o hash pra confirmar o envio ' +
          `(campos esperados ausentes na resposta): ${JSON.stringify(created.body).slice(0, 500)}`;
      } else if (sendNow && campaignHash) {
        const sendRes = await sendEgoiCampaign(
          campaignHash,
          Number(cfg.list_id),
          apiKey,
          resolvedSegmentId,
        );
        egoiSendStatus = sendRes.status;
        egoiSendBody = sendRes.body;
        // sendEgoiCampaign já confirma sucesso real inspecionando o corpo da
        // resposta (2xx sozinho não é suficiente — R-007) e já inclui o
        // `segments` obrigatório no payload (senão a E-goi responde 422
        // segments.isEmpty mesmo com list_id certo).
        if (sendRes.ok) {
          campaignStatus = 'sent';
          sentAt = new Date().toISOString();
        } else {
          // Criou o rascunho mas falhou o envio — mantém como draft e devolve erro.
          errorMessage = `E-goi send ${sendRes.status}: ${
            typeof sendRes.body === 'string' ? sendRes.body : JSON.stringify(sendRes.body)
          }`.slice(0, 1000);
        }
      }
    } else {
      // Falha na criação — libera o dispatched_at para nova tentativa não ficar bloqueada.
      if (!isAbTest) {
        await admin.from('events').update({ email_campaign_dispatched_at: null }).eq('id', eventId);
      }
      errorMessage = `E-goi ${created.status}: ${
        typeof created.body === 'string' ? created.body : JSON.stringify(created.body)
      }`.slice(0, 1000);
    }

    // Persistência do histórico (Fase 2 — R-062: finaliza a MESMA linha
    // 'in_progress' gravada na Fase 1, sempre por UPDATE — nunca insere linha
    // nova aqui, ela já existe desde antes da chamada à E-goi).
    const rowPayload: Record<string, unknown> = {
      egoi_campaign_id: campaignHash,
      status: campaignStatus,
      error_message: errorMessage,
      sent_at: sentAt,
    };

    // R-058 — Supabase-js não lança em erro de RLS/constraint aqui, só devolve
    // { error }; sem checar isso, uma falha de gravação ficava 100% silenciosa
    // (resposta 200 ok:true, zero linha no histórico, claim nunca liberado —
    // reproduzia sozinho todos os sintomas de "dispatch_in_progress" mesmo
    // depois de R-052 a R-057 corrigidos). Não libera o claim aqui: a
    // campanha real já existe na E-goi nesse ponto (created.ok === true),
    // então liberar deixaria o admin recriar/reenviar de verdade em cima de
    // uma campanha que já foi criada — só soma o erro na resposta, mesmo
    // padrão já usado no sibling create-multi-event-email-campaign.
    let historyError: string | null = null;
    if (historyRowId) {
      const { error: finalizeError } = await finalizeHistoryRow(admin, historyRowId, rowPayload);
      if (finalizeError) {
        console.error('[create-event-email-campaign] Falha ao gravar histórico (update):', finalizeError);
        historyError = finalizeError;
      }
    }

    const finalErrorMessage = historyError
      ? errorMessage
        ? `${errorMessage} (aviso: falha ao gravar histórico: ${historyError})`
        : `Aviso: falha ao gravar histórico: ${historyError}`
      : errorMessage;

    return json({
      ok: campaignStatus !== 'failed',
      status: campaignStatus,
      egoi_campaign_id: campaignHash,
      error: finalErrorMessage,
      scheduled_at: campaignStatus === 'scheduled' ? scheduleAtIso : null,
      _debug: { egoi_status: created.status, egoi_send_status: egoiSendStatus, egoi_send_body: egoiSendBody },
    });
  } catch (e) {
    console.error('[create-event-email-campaign] Falha não tratada:', e);
    const errMsg = (e as Error).message;
    // R-062 — só libera o claim quando a campanha NÃO chegou a ser confirmada
    // como criada na E-goi (mesma doutrina do R-058: se `created.ok` já era
    // true, a campanha existe de verdade, e liberar o claim deixaria o admin
    // recriar/reenviar em cima dela).
    if (claimAdmin && claimEventId && !claimIsAbTest && !campaignConfirmedCreated) {
      try {
        await claimAdmin.from('events').update({ email_campaign_dispatched_at: null }).eq('id', claimEventId);
      } catch (releaseErr) {
        console.error('[create-event-email-campaign] Falha ao liberar claim após erro:', releaseErr);
      }
    }
    // R-062 — finaliza a linha 'in_progress' da Fase 1 pra não ficar presa
    // pra sempre; best-effort (não deixa um erro aqui mascarar o 500 real).
    if (claimAdmin && historyRowId) {
      try {
        await finalizeHistoryRow(claimAdmin, historyRowId, {
          status: campaignConfirmedCreated ? 'draft' : 'failed',
          egoi_campaign_id: confirmedCampaignHash,
          error_message: campaignConfirmedCreated
            ? `Campanha criada na E-goi (${confirmedCampaignHash ?? 'hash desconhecido'}), mas a function falhou logo depois: ${errMsg}`
            : errMsg,
        });
      } catch (finalizeErr) {
        console.error('[create-event-email-campaign] Falha ao finalizar histórico após erro:', finalizeErr);
      }
    }
    return json({ error: errMsg }, 500);
  }
});
