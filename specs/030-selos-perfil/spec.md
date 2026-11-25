# Spec — Selos isométricos animados e vitrine do perfil

**Feature:** `specs/030-selos-perfil` · **Fila:** `REALIZA-529` · **Origem:** `docs/planos/feedback-thiago-2026-11-25.md` §1
**Substitui a arte de:** `016-badges` (SVG estático) · **Mantém:** o modelo de conquistas e níveis de `024` (nada muda em `conquistas.ts`).

## Problema

A família de badges ficou poluída, estática e feia; o selo de nível vivia numa caixa no header; a estante tomava scroll.

## Direção

- **Arte do zero** com a skill `fun-isometric`: 38 cenas em canvas (`src/lib/selos`), chapas com contorno grafite `#323232`, corpo amarelo `#FFD531`, acento verde `#A0C644`, âmbar/turquesa/petróleo como apoio. O movimento vem de presets de After Effects do kit (hop, wiggle, impact, erase…), não de keyframes inventados.
- **Níveis = a escada que cresce**: Início (broto), Constância (bandeira), Veterania (estrela), Jornada completa (troféu). A altura da peça já conta o nível a 40px.
- **Famílias com degraus**: uma função construtora por família; o degrau muda contagem de checks/estrelas/anéis e acento.
- **Quando se mexe**: loop só nos até 3 selos do perfil e no detalhe aberto; na estante a peça faz a ação uma vez ao aparecer e de novo no hover/foco; peça não ganha fica parada e apagada; `prefers-reduced-motion` cai no quadro de repouso.

## Requisitos

- **FR-001** Header sem caixa: só as peças (até 3), 64px, `aria-label` com o nome; cada uma abre o detalhe da estante.
- **FR-002** O jovem escolhe até 3 entre faixas ganhas e a estante; a ordem de toque é a ordem de exibição; com 3 marcadas as demais travam; "Usar sugestão" volta ao padrão (faixa atual + 2 mais recentes).
- **FR-003** Estante, "Ainda por vir" e a régua de faixas ficam em expansões fechadas; a escolha rola dentro do dialog, nunca na página.
- **FR-004** 390px e desktop sem rolagem lateral.
- **FR-005** Server action `salvarSelosDoPerfil` devolve `{ ok }` ou `{ error }` em pt-BR e valida ≤ 3 chaves bem formadas.

## Persistência (decisão em aberto, alçada do lead)

Hoje a escolha mora em cookie httpOnly `selos_perfil` (`<id da ficha>|chave|chave`), o mesmo padrão do tema: vale **por aparelho** e não vaza para outra pessoa no mesmo navegador. Ninguém além do jovem vê a vitrine hoje (a estante só existe no perfil e na `/materiais` dele). Se a coordenação ou o mentor passarem a ver os selos, ou se o jovem trocar de aparelho, precisa de coluna. **Proposta de SQL (não aplicada, não está em `supabase/migrations/`):**

```sql
-- mentorados.selos_perfil: chaves estáveis dos selos que o jovem mostra (máx. 3)
alter table public.mentorados
  add column selos_perfil text[] not null default '{}'
  constraint mentorados_selos_perfil_max3 check (cardinality(selos_perfil) <= 3);

-- escrita só pelo próprio jovem, e só nesta coluna (RPC security definer com guard):
create or replace function public.jovem_definir_selos(p_chaves text[])
returns void language plpgsql security definer set search_path = public as $$
begin
  if cardinality(p_chaves) > 3 then raise exception 'max_3'; end if;
  update public.mentorados set selos_perfil = p_chaves
   where profile_id = my_profile_id();
end $$;
```

A `jovem_perfil` (view) teria de projetar a coluna. A troca no código é local: `actions-selos.ts` e a leitura em `perfil/page.tsx`.

## Fora de escopo

Ranking, pontos, streak; mudar critérios de nível/conquista; mostrar selos a terceiros.
