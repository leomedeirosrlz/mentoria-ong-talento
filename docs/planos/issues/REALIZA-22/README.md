# REALIZA-22 — Polish de agendamento: posição estável do Agendar + microcopy

- **Jira:** [REALIZA-22](https://kelyng.atlassian.net/browse/REALIZA-22)
- **Tier:** B
- **Veredito:** **PARCIAL** — o dialog retroativo já existe e está entregue; restam dois recortes.
- **Duplicata:** REALIZA-97 é clone desta issue (aponta pra cá).
- **Esforço estimado:** **PP** (mover um JSX existente + duas linhas de copy)
- **Docs:** [plan.md](plan.md) · [design.md](design.md) · [acceptance.md](acceptance.md)

## O que a issue pede (3 itens, 1 entregue)

| Item | Status |
|---|---|
| Dialog retroativo sinalizando "essa data já passou — entra como realizado" | ✅ **Entregue** — `RegistrarRetroativoDialog` (`src/components/registrar-retroativo-dialog.tsx`) + ramo retroativo do `AgendarEncontroDialog` (data passada → "Ele entra como realizado", `agendar-encontro-dialog.tsx:267-271`, submit "Registrar encontro" `:329`) |
| "Agendar encontro" **nunca** dentro do "⋯ Mais" quando `podeAgendar` | ❌ **Regredido** — quando `pendenteRegistro && podeAgendar`, o Agendar é empurrado pro overflow (`src/app/(app)/duplas/[id]/page.tsx:566-583`) |
| Microcopy "datas oficiais são sugestões, a dupla combina a real" na agenda + vocabulário "repôr" | ❌ **Ausente** — a ficha já diz "datas sugeridas pelo guia" (`page.tsx:1315-1321`), mas `/agenda` não explica o modelo em nenhuma superfície |

## Estado atual (evidência do débito)

- `page.tsx:566-583` — `if (pendenteRegistro && podeAgendar) maisItens.push(<AgendarEncontroDialog …/>)`: na presença da pendência de registro — quando o mentor **mais** precisa do próximo encontro — o botão some no menu.
- `page.tsx:821-839` — a linha de ações tem "Registrar encontro" primário e "Agendar" primário **excludentes**: é a mesma ação trocando de posição e peso conforme estado.
- `/agenda` (mentor, `src/app/(app)/agenda/page.tsx:254-259` e `:400-405`) — o subheader fala em "encontros do ciclo" e "os que você marcou", mas não diz que a data oficial é **sugestão**.
- `agenda-calendario.tsx` — `LegendaAgenda` (`:3823-3902`) explica os marcadores (Encontro/Recesso/Hoje/Disponibilidade) sem uma linha sobre "oficial = sugestão".

## Escopo deste plano

1. **Posição estável do Agendar** — remover o `maisItens.push` do ramo
   `pendenteRegistro`; renderizar `AgendarEncontroDialog` sempre visível no
   header quando `podeAgendar`: primário quando não há pendência, **outline**
   ao lado de "Registrar encontro" quando há.
2. **Microcopy na agenda** — uma linha explicando o modelo "oficial = sugestão,
   a real é a que vocês marcam" nas superfícies do mentor em `/agenda`:
   subheader do branch mentor (`agenda/page.tsx:254-259`) + rodapé da
   `LegendaAgenda` para papel mentor.
3. Manter a ficha como está ("datas sugeridas pelo guia" já cobre o conceito —
   `:1315-1321`).

## Fora de escopo

- Qualquer mudança no `AgendarEncontroDialog`/`RegistrarRetroativoDialog`
  (ambos já entregues).
- Vocabulário "repôr": a regra oficial ("reposição na mesma semana") já aparece
  como `observacao` de `ciclo_eventos` renderizada no detalhe
  (`encontro-detalhe-dialog.tsx:180-183`); a issue pede consistência, e a
  microcopy nova usa "combinam e registram a real" sem propor renomear nada.
  Se o Thiago quiser introduzir "repôr" como verbo, é decisão de copy separada.
- Coordenação não agenda (regra de negócio §5.1) — nada muda pra coord/sup.

## Dependências / bloqueios

- Nenhuma. UI pura, sem schema.

## Riscos

- **Header crowdado no mobile** — "Registrar encontro" + "Agendar encontro"
  + "Pedir apoio" + "Mais" no estreito: o `flex-wrap` do container
  (`page.tsx:818`) já lida com wrap; o Agendar outline é o primeiro a quebrar
  linha. Sem risco funcional — ver design.md.
- **Copy duplicada** — não repetir a explicação em cada linha de encontro; o
  padrão da casa é "o conceito mora uma vez no rótulo" (comentário
  `page.tsx:1500`, `page.tsx:1308-1311`). O plano segue a regra.
