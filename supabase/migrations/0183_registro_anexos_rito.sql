-- 0183 — a evidência do registro sobrevive à conclusão automática.
-- A 0102 conclui a dupla quando o último encontro é registrado e abre o
-- rito de fechamento ('pendente' em encerramentos desde a 0156): até a
-- coordenação atestar o checklist, o registro final e os anexos seguem
-- editáveis pelo mentor — a ficha já libera "Anexar" nessa janela via
-- ritoPendente (o retroativo pode pousar o 16º sem follow-up nem foto).
-- A 0021 travou o insert em d.status = 'ativa' e quebrou essa janela:
-- a UI oferecia e a RLS recusava.
--
-- A condição vira (ativa) OU (concluida com rito pendente); o resto da
-- policy é verbatim da 0021 (autor, prefixo do path, mentor da dupla). A
-- janela fecha sozinha quando a coordenação decide o rito (tipo sai de
-- 'pendente'). O delete não mexe: registro_anexos_write_delete nunca teve
-- gate de status. O insert do storage.objects idem — ele só confere a row
-- de metadados, que é onde este check mora.

drop policy registro_anexos_mentor_insert on public.registro_anexos;

create policy registro_anexos_mentor_insert on public.registro_anexos
  for insert with check (
    created_by = public.my_profile_id()
    and path like (registro_id::text || '/%')
    and exists (
      select 1 from public.registros r
      join public.encontros e on e.id = r.encontro_id
      join public.duplas d on d.id = e.dupla_id
      where r.id = registro_id
        and d.mentor_id = public.my_profile_id()
        and (
          d.status = 'ativa'
          or (
            d.status = 'concluida'
            and exists (
              select 1 from public.encerramentos enc
              where enc.dupla_id = d.id
                and enc.tipo = 'pendente'
            )
          )
        )
    )
  );
