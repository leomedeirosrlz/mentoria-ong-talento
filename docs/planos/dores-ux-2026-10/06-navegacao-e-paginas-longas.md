# Plano 06 — Navegação, páginas longas e texto pequeno

## A. Navegação (REALIZA-193)

### Problema

- **Desktop:** a sidebar da coordenação tem 10 itens com o mesmo peso
  (`app-shell.tsx:34-47`). Pela regra de memória de trabalho, mais de 5
  opções de topo sem grupo viram uma parede.
- **Mobile:** a ordem quebrada da barra inferior é a Q6 do plano 02.
- **Ícones:** "Jornada" do jovem usa ícone de pasta (`jovem-shell.tsx:38`).
  Progresso e acervo dividem o mesmo ícone.
- **Pílula "Demo · <papel>":** sobrepõe o painel de avisos no desktop e os
  cards no celular. Afeta só a demo, mas a demo é a vitrine para
  parceiros e voluntários.

### Proposta

**Sidebar agrupada por trabalho**, para a coordenação:

| Grupo | Itens |
|---|---|
| (sem título) | Visão geral |
| Acompanhar | Duplas · Agenda · Chamados (badge) |
| Programa | Materiais · Formulários · Turmas |
| Dados | Registros · Relatórios · Pessoas |

- Os títulos de grupo usam o estilo de rótulo de 11px (uso legítimo do
  estilo).
- Supervisor e mentor ficam sem grupos: têm até 7 itens.

**Barra inferior mobile:** para a coordenação, Início, Duplas, Agenda,
Chamados e Mais. O "Mais" abre uma folha com os mesmos grupos da sidebar.

**Pílula da demo:** encaixada no topo, dentro da barra superior, sem
flutuar sobre o conteúdo (`src/components/demo-bar.tsx`).

**Alternativa do REALIZA-193 (drop-up rico):** fica para depois. Agrupar
resolve a carga cognitiva sem um padrão novo.

## B. `/registros` no desktop (REALIZA-175)

### Problema

11.842px a 1280px. A timeline é uma coluna única de cards estreitos e usa
pouco da largura (captura `coordenacao_desktop_registros.png`).

### Proposta

**Mestre e detalhe:**

- **Esquerda:** lista compacta agrupada por dupla, uma linha por registro
  (encontro, data, avaliação, sinais).
- **Direita:** o registro aberto.

O panorama do ciclo (v2) continua no topo. No celular, a timeline atual
continua igual (já foi auditada como boa).

**Paginação ou "Mostrar mais"** por dupla. Hoje todos os registros são
renderizados de uma vez.

## C. `/materiais` da coordenação

### Problema

4.100px no desktop e 193 textos abaixo de 12px no celular. A página empilha:

- a caixa "Você vê / não faz";
- a matriz de progresso;
- "fora da janela";
- 8 cards de instrumento;
- a cobertura 1-16;
- 16 acordeões de encontro, a maioria vazia ("sem material ainda").

### Proposta

- **Abas:** "Jornada" (progresso + fora da janela), "Instrumentos" e
  "Biblioteca" (por encontro).
- **Encontros vazios agrupados:** uma linha para cada faixa de encontros
  consecutivos sem material ("Encontros 3–11: sem material ainda ·
  Adicionar"), em vez de 9 acordeões.
- **Caixa de escopo:** sai da tela (plano 03-C).
- **Cards de instrumento com faixa colorida no topo** (detector
  `border-accent-on-rounded`, 6): a cor vai para o ícone/emblema, que já
  existe (`InstrumentoIcone`).

## D. Piso de texto no celular

### Problema

- Texto abaixo de 12px por página, a 390px:
  - coordenação: `/materiais` 193, `/duplas` 155, `/registros` 125;
  - supervisor: `/materiais` 132, `/registros` 100;
  - especialista: `/agenda` 83.
- O `AGENTS.md` permite 10–11px em badges, chips e micro-meta de linha
  densa. Essas exceções foram pensadas para o desktop, mas valem igualmente
  no celular, que é o uso dominante do jovem e de consulta da coordenação.
- **Mitr:** o zero cortado faz "0 de 4" e "20/10" lerem como "Ø".
  Agrava-se em textos pequenos e cheios de números.

### Proposta

- **Regra nova no `AGENTS.md`:** abaixo de `sm`, piso de 12px para qualquer
  texto que carrega informação (micro-meta, chips de prazo, "nota do
  mentor"). Badges puramente decorativos ou contadores podem ficar em 11px.
- **Implementação:** trocar `text-[10px]` e `text-[11px]` em conteúdo por
  `text-xs sm:text-[11px]`. É uma varredura guiada pelo script de métricas,
  não por grep cego.
- **Números:** testar `font-variant-numeric: tabular-nums` e, se a Mitr
  permitir, desligar o zero cortado nos números (`font-feature-settings`).
  Se não for possível, usar a JetBrains Mono, que o projeto já carrega,
  apenas em dados numéricos densos. **Decisão visual (D8)**, com comparação
  antes e depois.

## Escopo de arquivos

- `src/components/app-shell.tsx`, `jovem-shell.tsx`, `demo-bar.tsx`
- `src/app/(app)/registros/page.tsx`, `registros-painel.tsx`, `registro-card.tsx`
- `src/app/(app)/materiais/page.tsx`, `materiais-hub.tsx`, `painel-jornada.tsx`
- Varredura de tipografia: arquivos listados pelo script de métricas
- `AGENTS.md` ("Hierarquia de texto": piso mobile)

## Critérios de aceite

- [ ] Sidebar da coordenação: no máximo 4 itens por grupo; nenhum grupo sem título exceto "Visão geral".
- [ ] `/registros` desktop ≤ 3 telas de altura (≤2.400px) com o dataset demo.
- [ ] `/materiais` coordenação, aba padrão ≤ 2 telas no desktop.
- [ ] Texto <12px a 390px reduzido a ≤20 por página, só em badges e contadores.
- [ ] A pílula da demo não cobre conteúdo em 390px nem em 1280px.
