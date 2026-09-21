-- 0031: onboarding por papel — `onboarded_em` marca quem já passou pelo
-- wizard de primeiro acesso (o gate mora no layout do app).
--
-- Coluna pública-interna como bio/areas (0030): entra no grant de coluna da
-- 0026 e fica FORA do guard_profiles_self_columns (0023) — a action de
-- conclusão grava nela pelo update de self-service da própria pessoa.
-- Sem backfill de propósito: quem já usa a plataforma vê o wizard uma vez —
-- funciona como anúncio da feature nova.

alter table public.profiles add column onboarded_em timestamptz;

-- mesmo padrão da 0026/0030: SELECT da tabela é por coluna
grant select (onboarded_em) on public.profiles to authenticated;
