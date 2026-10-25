# Plano 05 — Ficha da dupla (`/duplas/[id]`)

> A ficha é o centro de trabalho do mentor e o detalhe que a coordenação e
> o supervisor abrem a partir de toda lista. Hoje é a página mais longa do
> sistema.

## Problema (medido)

- **Altura:** 12.482px para o mentor (desktop) e 6.656px no celular da
  coordenação. `src/app/(app)/duplas/[id]/page.tsx` tem 1.772 linhas, mais
  `instrumentos-dupla.tsx`, `terceiros-dupla.tsx` e `mais-menu.tsx`.
- **Sequência atual (captura da coordenação no celular):** cabeçalho com
  estado e ações → jornada → sugestão de especialista → combinados →
  mentorado → voz do jovem → instrumentos da jornada (4+ cards) → avaliação
  por terceiros → pedido de especialista → encerramento → **encontros** (16
  itens, com registro inline em cada um) → resumo da jornada.
- **A ação mais frequente fica no fim.** Registrar o encontro, que é a
  tarefa semanal do mentor, vive dentro da lista de encontros, a ~9.700px do
  topo (ver Q1 no plano 02).
- **Seções sem hierarquia.** Todos os títulos de seção da ficha são `h2` com
  estilo de rótulo: `text-[11px] font-semibold uppercase text-muted-foreground`
  (`page.tsx:908`, `:938`, `:980`, `:1165`, `:1201`, `:1253`). No app todo,
  32 dos 108 `h2` seguem esse padrão. A convenção do `AGENTS.md` diz que título
  de seção é `text-base font-semibold` e que o estilo pequeno é só para rótulo
  de grupo. Resultado: 12 seções do mesmo tamanho e cor, sem ponto de entrada.
- **Ações no cabeçalho do mentor:** "Registrar encontro", "Pedir apoio" e
  "Mais". Na coordenação: "Chamar mentor", "Chamar mentorado", "Editar",
  "Remanejar" e "Mais". São cinco botões de peso parecido (ver REALIZA-157,
  menu "Mais" desalinhado).

## Perguntas que a ficha deve responder (por papel)

| Papel | Nos primeiros 5 segundos |
|---|---|
| Mentor | Qual é o próximo encontro e o que preparo? Falta registrar algo? |
| Coordenação / supervisor | Esta dupla está bem? Se não, por quê, e qual é a próxima ação minha? |
| Especialista | Em que sessão da trilha estamos e o que falta? |

## Proposta

### 1. Cabeçalho = estado + uma ação contextual

```
┌───────────────────────────────────────────────┐
│ Ricardo Tavares  e  Ana Beatriz Silva         │
│ Turma 1 · encontro 5 de 16 · sup. Paulo Serra │
│                                               │
│ ● Atenção: 5º encontro passou, falta registro │  ← motivo em linguagem do guia
│ [ Registrar 5º encontro ]   Pedir apoio   ⋯   │  ← 1 preenchido, o resto neutro
└───────────────────────────────────────────────┘
```

- A ação primária muda com o estado: "Registrar Nº encontro", "Agendar Nº
  encontro", "Entrar na chamada" (no dia) ou "Concluir encerramento". Os
  dados já existem: o próprio `saudadeDaDupla` em `src/lib/ciclo.ts` calcula
  o motivo.
- Para coordenação e supervisor, a ação primária é "Lembrar" ou "Chamar",
  conforme a regra existente (cap de 48h). "Editar" e "Remanejar" vão para o ⋯.

### 2. Registrar e agendar em sheet, não inline no fim

- "Registrar" abre o `RegistroForm` existente numa *sheet*: de baixo no
  celular, lateral no desktop. Funciona tanto na ficha quanto na home do
  mentor, sem navegar. Elimina o Q1 na raiz.
- O hash `#registrar-<id>` continua valendo como deep link (e-mail, WhatsApp,
  `login-form.tsx:74-80`) e passa a abrir a sheet.

### 3. Ficha em abas

| Aba | Conteúdo (seções existentes) |
|---|---|
| **Agora** (padrão) | jornada compacta (linha 1-16 com o atual em destaque), próximo encontro e "como conduzir" dele (REALIZA-202), combinados abertos, pedidos pendentes (apoio, especialista) |
| **Encontros** | lista dos 16 encontros com os registros; só o atual e os pendentes expandidos |
| **Instrumentos** | instrumentos da jornada, avaliação por terceiros, PDM |
| **Pessoas** | mentor, mentorado, supervisor, especialistas, contatos (respeitando `expor_contato`) |

O encerramento aparece em "Agora" só quando a dupla está na reta final ou
já foi encerrada. Fora disso, fica escondido.

- Aba ativa no URL (`?aba=`), para deep link e para o botão voltar funcionar.
- Celular: abas fixas logo abaixo do cabeçalho, com rolagem horizontal
  (regra da casa: "faixas de pills: scroll lateral sempre").
- **Alternativa para o Thiago decidir (D2):** em vez de abas, uma página
  única com índice fixo e seções colapsáveis. É mais simples de implementar,
  mas continua longa. Recomendo abas: o mentor tem um trabalho por visita, e
  as abas o separam.

### 4. Títulos de seção corrigidos

Dentro de cada aba, cada seção usa `h2` com `text-base font-semibold`, como
diz o `AGENTS.md`. O estilo de rótulo de 11px volta a valer só para
agrupar itens dentro de um card. A mesma correção vale para os 32 `h2` do
app listados no plano 03.

## Escopo de arquivos

- `src/app/(app)/duplas/[id]/page.tsx` (dividir por aba em componentes
  colocados na pasta da rota)
- `src/app/(app)/duplas/[id]/mais-menu.tsx` (REALIZA-157)
- `src/components/registro-inline.tsx` → sheet
- `src/components/trilha-jornada.tsx:263` (link de registrar)
- `src/components/mentor-home.tsx` (abrir a sheet direto da home)
- `src/app/(app)/duplas/[id]/loading.tsx` (skeleton espelhando a aba "Agora")

## Critérios de aceite

- [ ] Altura da aba "Agora" ≤ 2 telas (≤1.700px) a 390px, nos estados ativa, atenção e risco.
- [ ] A ação primária está acima da dobra a 390×844 para todos os papéis.
- [ ] Registrar a partir da home do mentor não troca de página.
- [ ] Um único botão preenchido no cabeçalho.
- [ ] Deep links `#registrar-<id>` e `?aba=` cobertos por spec e2e.
- [ ] Nenhuma informação removida: tudo o que existe hoje está em alguma aba (checklist por seção no PR).

## Dependências

Plano 01 (cores de status) e plano 03 (títulos e copy). Coordenar com
REALIZA-202 ("Como conduzir").
