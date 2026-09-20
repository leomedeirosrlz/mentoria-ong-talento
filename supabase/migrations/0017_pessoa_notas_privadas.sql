-- ===== mural vira caderneta privada do autor =====
-- decisão de produto: a nota individual é privada de quem escreve — a
-- coordenação NÃO lê as observações do mentor sobre o mentorado (e vice-versa).
-- insert segue igual (mentor anota no mural do próprio mentorado; staff em
-- qualquer um), mas a leitura passa a ser só do autor — e o delete idem:
-- coord não pode apagar o que não pode ler.

drop policy pessoa_notas_select on public.pessoa_notas;
create policy pessoa_notas_select on public.pessoa_notas for select
  using (created_by = public.my_profile_id());

drop policy pessoa_notas_delete on public.pessoa_notas;
create policy pessoa_notas_delete on public.pessoa_notas for delete
  using (created_by = public.my_profile_id());
