/**
 * Hook da biblioteca de blocos globais de e-mail.
 *
 * Historicamente era um hook local (cada componente com seu próprio cache).
 * Isso causou o bug "[Bloco global indisponível]" — dois caches distintos,
 * um salvava e o outro não sabia.
 *
 * Agora é um simples wrapper sobre o contexto único
 * `EmailGlobalBlocksProvider`. A API pública é a mesma para não quebrar
 * consumidores existentes.
 */
export { useEmailGlobalBlocksContext as useEmailGlobalBlocks } from "@/contexts/EmailGlobalBlocksContext";
