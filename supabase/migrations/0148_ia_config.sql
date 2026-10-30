-- 0148 ia_config — configuração viva do assistente (REALIZA-328/329).
-- KV jsonb: o assistente muda de modelo/esforço SEM redeploy — provider
-- e modelos do opencode mudam rápido e quota acaba; a coordenação ajusta
-- na aba de ajustes da própria bolha. Três chaves-semente:
--
--   modelos    → {rapido, balanceado, forte, fallbacks[]} — o roteador
--                determinístico escolhe o tier por pergunta; slug vazio
--                cai no IA_MODEL do ambiente
--   esforco    → "baixo|medio|alto" → reasoning_effort do provider
--   roteamento → bool — desligado = tudo no tier balanceado
--
-- RLS: leitura pra todo autenticado (a rota precisa ler pra qualquer
-- papel que usa o assistente); escrita só coordenação via has_papel —
-- mesmo gate efetivo do resto do banco (híbrido/auxiliar com papel de
-- coord também escreve).

begin;

create table public.ia_config (
  chave text primary key,
  valor jsonb not null,
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid references auth.users (id)
);

comment on table public.ia_config is
  'Configuração viva do assistente (modelos por tier, esforço, '
  'roteamento). A coordenacao ajusta na bolha; a rota lê por chamada.';

alter table public.ia_config enable row level security;

create policy ia_config_select on public.ia_config
  for select to authenticated using (true);

create policy ia_config_write on public.ia_config
  for all to authenticated
  using (public.has_papel('coordenacao'))
  with check (public.has_papel('coordenacao'));

-- seeds calibrados no eval de out/2026 (16 modelos × 6 prompts no Zen):
-- glm-5.3-flash = menor ttft (~0,9s) e tool-choice 100%; deepseek-v4.1-
-- flash ~2,2s/100%; deepseek-v4-pro ~2,4s/92% (kimi-k3.1-pro era 100% mas
-- 7,5s — forte demais pra default). mimo-v2.6-flash era o pior ttft
-- (~10s) e falhava tool-choice — saiu do balanceado.
insert into public.ia_config (chave, valor) values
  ('modelos', '{"rapido":"glm-5.3-flash","balanceado":"deepseek-v4.1-flash","forte":"deepseek-v4-pro","fallbacks":[]}'),
  ('esforco', '"medio"'),
  ('roteamento', 'true');

commit;
