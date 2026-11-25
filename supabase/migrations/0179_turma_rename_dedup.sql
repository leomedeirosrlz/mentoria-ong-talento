-- 0179 · rename de turma pra label que já existe não aborta mais o UPDATE
-- inteiro quando alguém repete papel nos dois labels.
--
-- CONTEXTO
-- O trigger `cronograma_turma_propaga` (0127) migra os snapshots por label
-- quando o label velho fica órfão. O update de `profile_papeis.escopo_turma`
-- era o único SEM dedup: quem tem o mesmo papel nos dois labels (ex.: a
-- auxiliar com escopo de turma em "T1 · 2026/2027" E em "Turma Aberta")
-- batia no `profile_papeis_uniq` (profile_id, papel, escopo_turma) e o
-- 23505 derrubava o rename inteiro — a UI devolvia o genérico "Já existe
-- um cadastro com esses dados.", que aponta pra duplicata de cadastro e
-- não pra colisão de escopo.
--
-- MODELO — mesma decisão da fila de espera (0127 §2): a linha que viraria
-- duplicata NÃO é deletada nem migrada — fica com o label velho pra
-- revisão manual (deletar dispararia `profile_papeis_projeta_role` e
-- apagar em silêncio um grant de supervisão é pior que sobrar um). O app
-- também pré-valida em `atualizarCronograma` e nomeia o conflito — este
-- guard é a rede de segurança pra escritas fora da action.
--
-- Corpo idêntico ao da 0127 exceto o `not exists` no update de papéis.

begin;

create or replace function public.propagar_turma_do_cronograma()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- selo das duplas: a âncora é o cronograma_id, propaga sempre.
  update public.duplas
     set turma = new.turma
   where cronograma_id = new.id
     and turma is distinct from new.turma;

  -- snapshots por label: só migram quando o label velho ficou órfão —
  -- enquanto outro cronograma o usa, o snapshot pode ser dele.
  if not exists (
    select 1 from public.cronogramas c where c.turma = old.turma
  ) then
    update public.turma_inscricoes i
       set turma = new.turma
     where i.turma = old.turma
       and not exists (
             select 1 from public.turma_inscricoes i2
              where i2.turma = new.turma
                and i2.profile_id is not distinct from i.profile_id
                and i2.mentorado_id is not distinct from i.mentorado_id);

    update public.relatorio_links
       set turma = new.turma
     where turma = old.turma;

    update public.relatorio_links
       set config = jsonb_set(config, '{turma}', to_jsonb(new.turma))
     where config->>'turma' = old.turma;

    update public.solicitacoes_especialista
       set turma = new.turma
     where turma = old.turma;

    -- 0179: quem já tem o mesmo papel no label novo fica com o velho pra
    -- revisão manual — sem o guard o profile_papeis_uniq abortava o
    -- rename inteiro (23505).
    update public.profile_papeis pp
       set escopo_turma = new.turma
     where pp.escopo_turma = old.turma
       and not exists (
             select 1 from public.profile_papeis pp2
              where pp2.profile_id = pp.profile_id
                and pp2.papel = pp.papel
                and pp2.escopo_turma = new.turma);
  end if;

  return new;
end;
$$;

comment on function public.propagar_turma_do_cronograma() is
  'REALIZA-223: rename de cronogramas.turma regrava duplas.turma das vinculadas (âncora = cronograma_id) e, quando o label velho fica órfão, migra os snapshots por label (turma_inscricoes, relatorio_links+config, solicitacoes_especialista, profile_papeis.escopo_turma — 0179: com dedup, duplicata fica pra revisão manual).';

commit;

-- rollback: restore do corpo da 0127 (o update de profile_papeis sem o
-- not exists). O trigger em si não muda — segue o da 0127.
