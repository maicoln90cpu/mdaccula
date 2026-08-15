/**
 * R-062 — o catch externo das duas Edge Functions de disparo de e-mail
 * precisa continuar respeitando a doutrina do R-058 (nunca liberar o claim
 * quando a campanha já existe de verdade na E-goi, senão o admin pode
 * recriar/reenviar em cima de uma campanha real e duplicar o disparo) mesmo
 * agora que o catch também precisa lidar com a linha "in_progress" da Fase 1
 * — finalizando-a (nunca deixando presa) em qualquer saída pelo catch.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf-8');

describe('Regressão R-062 — catch externo condiciona a liberação do claim à confirmação de criação na E-goi', () => {
  it('create-event-email-campaign: só libera o claim quando !campaignConfirmedCreated', () => {
    const src = read('supabase/functions/create-event-email-campaign/index.ts');
    const catchBlock = src.slice(src.lastIndexOf('} catch (e) {'));
    expect(catchBlock).toMatch(/if\s*\([^)]*!campaignConfirmedCreated\)[\s\S]*?email_campaign_dispatched_at:\s*null/);
  });

  it('create-event-email-campaign: finaliza a linha "in_progress" no catch (nunca deixa presa)', () => {
    const src = read('supabase/functions/create-event-email-campaign/index.ts');
    const catchBlock = src.slice(src.lastIndexOf('} catch (e) {'));
    expect(catchBlock).toMatch(/finalizeHistoryRow\(claimAdmin, historyRowId,/);
    expect(
      catchBlock,
      'A finalização no catch precisa distinguir os dois casos: se a campanha foi confirmada como criada ' +
        '(vira draft, preservando o hash), senão vira failed.'
    ).toMatch(/campaignConfirmedCreated\s*\?\s*['"]draft['"]\s*:\s*['"]failed['"]/);
  });

  it('create-event-email-campaign: seta campaignConfirmedCreated logo que created.ok é true, antes de qualquer outra chamada de rede', () => {
    const src = read('supabase/functions/create-event-email-campaign/index.ts');
    const okIdx = src.indexOf('if (created.ok) {');
    const sendCallIdx = src.indexOf('sendEgoiCampaign(', okIdx);
    const flagIdx = src.indexOf('campaignConfirmedCreated = true', okIdx);

    expect(okIdx).toBeGreaterThan(-1);
    expect(sendCallIdx).toBeGreaterThan(-1);
    expect(flagIdx).toBeGreaterThan(okIdx);
    expect(
      flagIdx,
      'campaignConfirmedCreated precisa ser setado ANTES de sendEgoiCampaign — se sendEgoiCampaign travar/lançar, ' +
        'o catch já precisa saber que a campanha (o rascunho) existe de verdade na E-goi.'
    ).toBeLessThan(sendCallIdx);
  });

  it('create-multi-event-email-campaign: só libera o claim quando !campaignConfirmedCreated', () => {
    const src = read('supabase/functions/create-multi-event-email-campaign/index.ts');
    const catchBlock = src.slice(src.lastIndexOf('} catch (e) {'));
    expect(catchBlock).toMatch(/if\s*\([^)]*!campaignConfirmedCreated\)[\s\S]*?email_campaign_dispatched_at:\s*null/);
  });

  it('create-multi-event-email-campaign: finaliza as linhas "in_progress" no catch (nunca deixa presas)', () => {
    const src = read('supabase/functions/create-multi-event-email-campaign/index.ts');
    const catchBlock = src.slice(src.lastIndexOf('} catch (e) {'));
    expect(catchBlock).toMatch(/finalizeHistoryRows\(claimAdmin, historyRowIds,/);
    expect(catchBlock).toMatch(/campaignConfirmedCreated\s*\?\s*['"]draft['"]\s*:\s*['"]failed['"]/);
  });
});
