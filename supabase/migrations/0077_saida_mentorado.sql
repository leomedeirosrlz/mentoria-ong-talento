-- 0077: saída do mentorado — a situação do cadastro do jovem no programa.
-- Hoje a saída (desistência, mudança de cidade, conclusão do ciclo) só se
-- deduz indireto: abrir a ficha e ver a dupla encerrada. Vira dado de
-- primeira classe pra /pessoas separar "Fora do programa" sem abrir ficha.
--
--   · situacao  — 'ativo' (default) · 'desistente' (saiu antes do fim)
--                 · 'concluido' (percorreu a jornada; distinto de desistente
--                 pro relatório não misturar evasão com formatura)
--   · saiu_em   — carimbo da saída; obrigatório quando fora, proibido ativo
--   · motivo_saida — frase curta ("Desistiu do programa — mudou de cidade");
--                 livre no banco, vocabulário guiado pelo dialog (0077)
--
-- Privacidade: colunas públicas-internas como ong_origem/origem — entram no
-- grant por coluna da 0034 (o SELECT table-level saiu lá; coluna nova sem
-- grant explícito some pra authenticated). O motivo é operacional, não
-- sensível — o detalhe fino continua em notas/mural (coord-only). Escrita
-- não muda: UPDATE é grant table-level e a RLS (mentorados_coord, 0001) já
-- restringe qualquer escrita à coordenação.
begin;

alter table public.mentorados
  add column situacao text not null default 'ativo',
  add column saiu_em timestamptz,
  add column motivo_saida text;

alter table public.mentorados
  add constraint mentorados_situacao_check
    check (situacao in ('ativo', 'desistente', 'concluido')),
  -- coerência do trio: ativo nunca carrega rastro de saída; quem saiu
  -- sempre carrega o carimbo (o motivo é opcional só pra 'concluido' —
  -- desistente exige motivo, mas isso é regra de produto, fica na action)
  add constraint mentorados_saida_ok check (
    (situacao = 'ativo' and saiu_em is null and motivo_saida is null)
    or (situacao in ('desistente', 'concluido') and saiu_em is not null)
  ),
  add constraint mentorados_saida_cap check (
    char_length(coalesce(motivo_saida, '')) <= 300
  );

-- mesma regra das públicas da 0034/0038/0076 — a /pessoas lê a situação pra
-- separar a seção e o embed de relatório a exporta pro backup CSV
grant select (situacao, saiu_em, motivo_saida)
  on public.mentorados to authenticated;

commit;
