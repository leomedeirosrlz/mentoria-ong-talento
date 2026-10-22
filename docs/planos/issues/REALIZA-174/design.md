# REALIZA-174 — design

## Persona & JTBD

**Persona**: coordenação (visão principal) + supervisor/auxiliar + mentor +
especialista (visões próprias).

**JTBD**: "abrir `/duplas` e, em 5 s, saber quem precisa de mim agora — e
chegar na ficha com 1 clique."

**Pergunta dos primeiros 5 s**: "quantas em risco? quais?" — hoje respondida
pelos `CatChip` + a lista priorizada; o resíduo é acabamento/densidade nas
visões não-coord e no rodapé das linhas/cards.

## Hierarquia — observação × proposta

**Observação**: coord já tem header de coluna + linhas `divide-y` densas;
as outras 3 visões (`VisaoSupervisor`, `VisaoMentor`, `VisaoEspecialista`)
usam cards `sm:grid-cols-2` com mais altura e footers `border-t border-dashed`
com poucas ações — "footer morto".

**Proposta**:

1. **VisaoSupervisor** herda o padrão `LinhaDupla`/`LinhaMini` da coord
   (mesma densidade, escopo já filtrado pela RLS).
2. **VisaoMentor**/`VisaoEspecialista`: cards mais baixos — footer
   `border-dashed` só quando há ≥2 ações; 1 ação → inline no header do card;
   sem footer vazio nunca.
3. **LinhaDupla mobile**: `p-4` → `p-3`; gaps `gap-3` → `gap-2`; avatar 32px
   já compacto, manter.
4. **Altura alvo por linha em lg**: ~52-56px (`py-3` + uma linha de meta).
   Se "sinais" quebrar pra 2 linhas, truncar com `title` completo — a ficha
   tem o detalhe.

## Visualização por tipo de dado (a decisão que faltava)

| Dado | Tipo | Representação (já existe / ajustar) |
|---|---|---|
| Semáforo (ok/atencao/risco) | estado categórico | dot cor-de-papel + pill — já certo |
| Feito × esperado | progresso vs. régua | barra `h-1.5` com ticks por encontro — já certo |
| Distribuição por categoria | contagens | `CatChip` com `n` grande — já certo |
| Sinais (texto) | lista curta | texto `text-[10.5px]` truncado + `title` — ajustar: **no máximo 1 linha** |
| Avaliação do mentor | escala | pill numérica — manter; se ≥3 dígitos, fonte `text-xs` |
| Recência | tempo relativo | texto `há N dias` — manter |

Regra: **número grande só pra contagem**; progresso sempre barra; categoria
sempre dot/pill; texto livre sempre truncado com tooltip.

## Densidade & Gestalt

- Proximidade: colunas alinhadas por `GRID_COLS` — manter `gap-x-4`;
  sinais e dupla em colunas separadas (não misturar no mesmo cell).
- Região comum: o `section` com `shadow-[var(--shadow-border)]` fecha a
  tabela; o `<details>` da massa fecha o "resto" — já correto.
- Figura-fundo: zebra não (divide-y já separa); `hover:bg-muted/50` já
  dá o feedback de linha.

## Estados

- **Vazio**: `EstadoVazio` por visão — já existe (`:1210-1221`).
- **Massa**: `<details>` "Mostrar as outras N" — manter; `LinhaMini` dentro.
- **Loading**: server component — padrão.
- **Permissão**: visões por papel via RLS + `me.role` — sem mudança.
- **Sucesso**: ações (lembrete, WhatsApp) já dão feedback via toast/estado.

## Breakpoints

- `<lg`: cada linha vira card `p-3` — header (status+dupla) + progresso +
  sinais + ações inline (footer só se >1 ação).
- `lg+`: tabela 6 colunas — linha única por dupla, ~52px.

## Microcopy pt-BR

- Massa: `"Mostrar as outras N duplas em andamento"` — manter.
- Linha vazia de sinais: `"—"` (muted) — já existe, manter.
- Legenda de dots (barra acima da lista): manter.

## Cor semântica

- Semáforo segue `var(--role-*)`/estado; progresso `bg-[var(--brand-lime)]`;
  ticks `bg-foreground/50` — sem mudança. Aviso (`var(--warn)`) só em sinais
  de atenção; nunca enfeite.

## Ordem de implementação

1. `LinhaDupla`/`LinhaMini`: apertar altura mobile + truncar sinais em 1
   linha.
2. `VisaoSupervisor`: migrar pro mesmo template de linha (reusar
   `LinhaDupla` com props de escopo) — a verificar o shape dos dados dela.
3. `VisaoMentor`/`VisaoEspecialista`: footer condicional (sem `border-t`
   vazio).
4. Revisão de coluna "sinais"/"avaliação" conforme tabela acima.

## Pergunta de fechamento

"Detectar → entender → agir": detectar continua nos `CatChip`; entender
ganha com a linha de altura única (scan vertical); agir ganha com footer
sem ruído. A densidade **já** está na visão coord — a issue fecha quando as
outras visões alcançam o mesmo piso.
