-- voluntario: se a pessoa atua como voluntária no programa. Quando false,
-- o termo de adesão ao trabalho voluntário não se aplica (só LGPD +
-- termo do mentorado, quando for o caso). Default true preserva o
-- comportamento anterior (todos os cadastros existentes são voluntários).
alter table public.profiles
  add column if not exists voluntario boolean not null default true;
