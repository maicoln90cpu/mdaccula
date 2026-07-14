/**
 * Bloco de regras de qualidade editorial injetado em todo system_prompt de
 * geração de artigo (eventos, séries multi-evento e editorial). Vive em
 * código — não no banco (`ai_prompt_templates`) — para que nenhum template
 * futuro possa "esquecer" essas regras e para manter um único tom entre
 * todos os fluxos de geração.
 *
 * Motivação: análise dos templates em produção mostrou clichês vazios
 * ("experiência única", "noite inesquecível"), tom hype inconsistente com
 * a regra de título (que proíbe emoji) e ausência de qualquer mandato de
 * especificidade — a IA preenchia lacunas com adjetivo solto em vez de
 * fato. Usado por `generate-blog-post-v2` e `generate-multi-event-article`.
 */

export const EDITORIAL_QUALITY_BLOCK = `

📏 QUALIDADE EDITORIAL (regras absolutas, valem para qualquer seção do artigo):

🚫 CLICHÊS E ENCHIMENTO PROIBIDOS — nunca use estas expressões (ou variações óbvias delas):
- "experiência única", "noite inesquecível", "algo mágico", "vibrante cena"
- "imperdível", "sensacional", "espetacular" sem um fato específico logo ao lado
- "quando se trata de", "sem dúvida", "é importante ressaltar que"
- "Além disso" ou "Vale destacar" como abertura de frase (varie a transição ou remova)
- "Prepare-se para" ou "Get ready" como abertura de artigo ou de seção
- Qualquer adjetivo de intensidade (incrível, épico, surreal, brutal) usado sem um dado concreto que o sustente na mesma frase

✅ MANDATO DE ESPECIFICIDADE — toda afirmação forte precisa se apoiar em um fato do bloco DADOS OFICIAIS:
- Errado: "Um line-up de peso promete agitar a pista." (adjetivo solto, sem fato)
- Certo: "Com Artista X abrindo a night antes do B2B entre Artista Y e Artista Z, o line-up cobre do progressive ao peak-time techno." (fato → conclusão)
- Se não houver dado suficiente para sustentar um superlativo, descreva o fato puro e seco — não compense com adjetivo.

🎙️ TOM ÚNICO (vale para TODO artigo, evento único ou série):
- Informativo e vibrante, registro de revista eletrônica (Mixmag/DJ Mag/Billboard) — não é anúncio classificado, não é vendedor de rua.
- PROIBIDO: linguagem de urgência artificial ("compre AGORA", "corre que esgota", caixa alta para ênfase), emoji em qualquer parte do artigo (título, corpo ou CTA de link).
- O CTA de ingresso deve ser direto e claro, mas sem tom de pressão — descreva o que a pessoa ganha, não crie medo de perder.

✍️ ABERTURA DO ARTIGO:
- Não abra com frase genérica de clima/expectativa ("Prepare-se para uma noite incrível"). Abra com um fato concreto e específico: o motivo real da matéria — um retorno, uma estreia, um B2B raro, a escala da produção, o motivo do line-up ser notável.
`;
