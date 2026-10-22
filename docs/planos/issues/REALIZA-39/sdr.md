# REALIZA-39 — sdr.md

## Escopo de dados

- A derivação `turmasDe` **só reorganiza o que a RLS já entregou** — nenhum dado novo é buscado fora do escopo do papel. Risco zero de vazamento por filtro client-side **desde que** a page não passe a carregar `profile_papeis` de outras pessoas pra montar chips: `escopo_turma` é metadado de papel — leitura por `my_role() in (staff)` é permitida pela RLS de `0085` (staff lê papeis), mas **expor o escopo de outra pessoa na UI deve ser coord-only** (auxiliar não precisa ver "o colega supervisiona a T2") — esconder essa fonte do chip alheio: só `souCoord` vê chips derivados de `escopo_turma` de terceiros. Mentorado/`mentor` não-staff: sem chips (lista já é escopada).
- **Menores**: nada muda — mesmas colunas, mesma lista; a turma do jovem já é visível pra quem vê a lista.
- Multi-turma e "Sem turma" são recortes de exibição — nenhuma escrita, nenhuma RPC nova.

## Minimização

- Não adicionar colunas sensíveis aos selects existentes para derivar turma — `duplas.turma` e `profile_papeis.escopo_turma` bastam.

## Auditoria

N/A — recurso de leitura.
