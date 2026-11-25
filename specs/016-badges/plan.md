# Plano — Badges isométricas e níveis de jornada

**Spec:** `specs/016-badges/spec.md` · **Status:** Draft

## Resumo técnico

- Criar um conjunto pequeno de SVGs isométricos animados (CSS/WAAPI), reutilizando a paleta e a gramática de `ConquistaEmblema`.
- Derivar níveis por tempo de programa em `src/lib/conquistas.ts`; a UI do perfil/estante consome, sem tabela nova.
- Mostrar futuras em uma faixa separada, apagada, com critério em texto; a estante principal continua earned-only.

## Contexto técnico do repo

- Next.js 16 App Router · React 19 · TypeScript strict · Tailwind v4 · Base UI · Phosphor.
- `ConquistaEmblema` e `ConquistasCard` existentes; `conquistasDoJovem` é puro.
- Testes Vitest + demo e2e; assets locais em `public/`.

## Constitution Check

| Artigo | Como este plano cumpre | Evidência |
|---|---|---|
| A1 SLC | Badge + nível + futuras completos | prints |
| A2 RLS | Nenhuma escrita nova | — |
| A3 escritas/domínio | Derivação pura | tests |
| A4 rota pública | Sem rota nova | — |
| A5 LGPD | Nenhum dado novo | — |
| A6 UI | isométrico + tokens + reduced motion | prints |
| A7 demo | Faixas de nível no dataset | demo |
| A8 gates | DoD | — |
| A9 migrations | Nenhuma | — |
| A10 spec | Esta spec | — |

## Arquitetura da mudança (paths reais)

```text
src/lib/conquistas.ts              # nível por tempo/participação
src/components/conquista-emblema.tsx # ilustração/animação
src/app/(jovem)/jovem/perfil/conquistas-card.tsx # estante/futuras
public/badges/*.svg                # assets locais
tests/conquistas.test.ts           # níveis/futuras
tests/e2e/demo/...                 # prints
```

## Dados e migrations

Nenhuma migration prevista. Se o nível exigir um campo novo, provar que não dá para derivar de `iniciada_em`/status antes de propor tabela.

## Autorização (matriz)

Leitura do próprio perfil; a coordenação vê o que já vê. Nenhuma operação nova.

## Superfícies e rotas

- Perfil do jovem (`/jovem/perfil`), estante e faixa de futuras.
- Demo (`/demo`) com níveis.

## Paridade demo

- Dataset com perfis em 1 semana/1 mês/3 meses/completo e badges futuras.

## Testes

- **Unit:** derivação de nível e futura; nenhuma data inventada.
- **Demo e2e:** estante, detalhe, futuras e reduced motion.
- **Visual:** prints 1440/390.

## Observabilidade e erro

- Asset ausente cai no emblema atual; não quebra a estante.
- Animação não bloqueia interação.

## Rollout

1. derivação; 2. assets; 3. estante; 4. gates; 5. review visual; 6. aprovação manual.

## Complexidade e desvios

| Violação | Por que | Alternativa simples rejeitada |
|---|---|---|
| Nova tabela de badges | evitar overengineering | derivação pura primeiro |
