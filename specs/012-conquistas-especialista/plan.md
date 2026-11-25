# Plano — Conquistas, nova rodada e preview de especialista

**Spec:** `specs/012-conquistas-especialista/spec.md` · **Status:** Draft

## Resumo técnico

- A faixa da jornada passa a derivar do primeiro `MarcoAcao` não ganho; a estante do perfil não muda.
- O card/dialog de sugestão reutiliza um preview de perfil de especialista já existente na página de especialistas/`pessoas`; não criar uma segunda ficha.
- `jornada.ts` passa a devolver a origem de reemissão; a copy do card, próxima parada e faixa lê essa marca.

## Contexto técnico do repo

- Next.js 16 App Router · React 19 · TypeScript strict · Tailwind v4 · Base UI · Phosphor.
- `src/lib/conquistas.ts` já devolve `marcos`, `proximoMarco`, `ganho`/`proximo`.
- `src/lib/jornada.ts` deriva estações; `src/lib/forms/schema.ts` tem os sistemas.
- Testes Vitest + Playwright; demo e app.

## Constitution Check

| Artigo | Como este plano cumpre | Evidência |
|---|---|---|
| A1 SLC | Faixa, card e copy completos | prints/e2e |
| A2 RLS | Preview usa dados já visíveis | sem policy nova |
| A3 escritas/domínio | Reemissão continua na RPC existente | sem action nova |
| A4 rota pública | Sem rota nova | — |
| A5 LGPD | Preview sem documentos/contato | revisão |
| A6 UI | kit/tokens, foco, mobile | prints |
| A7 demo | fixture de sugestão e Roda inicial | demo e2e |
| A8 gates | DoD | — |
| A9 migrations | Nenhuma prevista | — |
| A10 spec | Esta spec | — |

## Arquitetura da mudança (paths reais)

```text
src/lib/conquistas.ts                         # próximo marco / marcos
src/app/(jovem)/jovem/materiais/marcos-a-caminho.tsx # faixa
src/app/(jovem)/jovem/materiais/page.tsx      # próxima parada/card
src/lib/jornada.ts                            # origem nova rodada
src/components/jovem-sugestao-card.tsx        # preview
src/components/jovem-especialistas.tsx        # exposição
src/app/(jovem)/jovem/especialistas/...       # perfil/preview
src/lib/demo/data.ts                          # fixtures
tests/...                                     # unit + demo
```

## Dados e migrations

Nenhuma migration prevista. Se o tipo `JovemEspecialista` não tiver profissão/experiência, ampliar a seleção da query existente; não criar tabela.

## Autorização (matriz)

| Operação | coordenação | supervisor | mentor_dpp | mentor_especialista | mentorado | anon |
|---|---|---|---|---|---|---|
| ver preview do especialista | ✅ | ✅ | ✅ | ✅ | ✅ (catálogo) | ❌ |
| responder sugestão | ❌ | ❌ | ❌ | ❌ | ✅ (própria) | ❌ |

Manter RLS atual.

## Superfícies e rotas

- Nenhuma rota nova; preview no card e no dialog existentes.
- O perfil de especialista já tem rota; se o preview precisar de link, usar a rota pública/interna existente sem expor documentos.

## Paridade demo

- Sugestão de especialista com perfil completo; Roda inicial a_fazer sem reemissão.
- Nenhuma mutação demo nova.

## Testes

- **Unit:** `conquistasDoJovem` com 0/1/todos marcos; `jornada` com reemissão e primeira emissão.
- **E2E demo:** faixa “Próximo marco”, card de sugestão com preview, Roda inicial sem nova rodada.
- **E2E app:** aceitar sugestão com especialista definido e sem definido.
- **Visual:** prints 1440/390.

## Observabilidade e erro

- Estado sem especialista definido é copy, não erro.
- Falha ao carregar o perfil não derruba o card: mostra nome/demanda e o CTA.

## Rollout

1. domínio e testes; 2. faixa/copy; 3. preview; 4. gates; 5. review; 6. aprovação manual.

## Complexidade e desvios

| Violação | Por que | Alternativa simples rejeitada |
|---|---|---|
| | | |
