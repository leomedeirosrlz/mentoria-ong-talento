# Plano 03 — Consistência entre telas e ruído

> Causa central da queixa "cada tela parece um produto diferente". As
> rodadas anteriores trabalharam tela por tela (mockups v5c, v8b, v6a…):
> cada tela ficou coerente consigo mesma, mas não com as outras.

## Problema A. A mesma dupla, quatro gramáticas visuais

| Onde | Como a dupla aparece | Arquivo |
|---|---|---|
| Home da coordenação | card inteiro tingido (vermelho/âmbar), rodapé com WhatsApp; 8 de 10 cards âmbar | `dashboard-coordenacao.tsx:702-704` |
| `/duplas` | linha de tabela: pill de status, régua de 16 quadrados, split-button Chamar/Lembrar | `duplas-lista.tsx` |
| `/agenda` (painel) | linha com chips de motivo, "Lembrar" e "Ver ficha" | `fila-acompanhar.tsx`, `agenda-coordenacao.tsx` |
| Home do mentor | cartão escuro com jornada em círculos | `mentor-home.tsx` |

Mais variações do mesmo tipo:

- **Faixa lateral colorida em cards arredondados:** 17 ocorrências pelo
  detector (`side-tab`). Exemplos: `duplas/[id]/page.tsx:853`,
  `duplas-lista.tsx:2038`, `:2251`, `materiais/page.tsx:198`. Isso contradiz
  a diretriz da casa "card nunca ganha borda lateral + fundo tintado".
  As 6 citações (`blockquote` de devolutiva) são exceção legítima.
- **Card dentro de card** na home do mentor: os blocos "O que fazer agora"
  e "Combinados" (detector `nested-cards`, 6).

**Proposta.** Um componente canônico em duas densidades, com anatomia fixa:

```
[status ●] Nome Mentor e Nome Mentorado        n/16 ▮▮▮▮▯▯▯…
           Motivo em uma linha, linguagem do guia
           Turma 1 · sup. Paulo                [ Ação contextual ] ⋯
```

- `DuplaLinha`: densa, para `/duplas`, fila da agenda e home da coordenação.
- `DuplaCartao`: para a home do mentor e do supervisor.
- **Superfície sempre neutra.** A cor fica só no ponto/pill de status
  (tokens do plano 01).
- **Uma ação contextual**, derivada do estado: Lembrar, Registrar, Chamar ou
  Agendar. O resto vai para o ⋯.
- **Nome não trunca.** É o dado-âncora (`AGENTS.md` → "Truncate"). Hoje
  `/duplas` a 1280px mostra "Carl… e Caio …". A linha quebra em duas antes
  de truncar o nome.

## Problema B. Saúde do programa com três números e três modelos

| Tela | Ativas | Em risco | Apoio |
|---|---|---|---|
| Home da coordenação | "Duplas ativas 10" | 1 | banner vermelho "1 pedido de apoio" (`dashboard-coordenacao.tsx:328,343`) |
| `/duplas` | "14 duplas" | 1 | pill azul "eixo separado" (`duplas-lista.tsx:800`, `:1487`) |
| `/agenda` | "8 duplas" | "0 · 0%" | fatia do donut; o apoio tira a dupla do risco (`numeros-semana.tsx:142-145`, `lib/agenda-coordenacao.ts`) |

A coordenação existe para detectar quem precisa de apoio. Números que mudam
de tela para tela minam a confiança no painel inteiro.

**Proposta.**

- **Um componente de resumo de saúde** (a barra segmentada de `/duplas`
  como base), reusado na home, na agenda e em `/duplas`.
- **Denominador explícito e igual em todas as telas**, por exemplo:
  "10 em andamento · 3 concluídas · 1 pausada". O "em risco" é contado sobre
  as em andamento.
- **Apoio sempre como sobreposição** (pill com contador), nunca como fatia e
  nunca como substituto do estado. Decisão já tomada pela casa ("apoio é
  eixo separado"); falta aplicá-la na home e na agenda.
- **Contraste da barra segmentada.** Texto branco de 10px sobre âmbar dá
  2,4:1, sobre verde 3,3:1 e sobre cinza 1,8–2,1:1 (detector, `/duplas`).
  Os números saem de dentro do segmento e vão para a legenda, em texto
  `-texto` do plano 01.

**Decisão pendente com o Thiago (D4):** o número principal da coordenação é
"duplas em andamento" ou "duplas que precisam de você hoje"?

## Problema C. A interface explicando a si mesma

| Texto | Onde |
|---|---|
| Definição da regra em cada cartão-filtro ("1 atraso, avaliação baixa, dificuldade ou pendência de registro/encaminhamento") | `duplas-lista.tsx:585-586` |
| "chamado aberto — não é falha da dupla" | `duplas-lista.tsx:1487` |
| "+ 2 apoio aberto (eixo separado)" | `duplas-lista.tsx:800` |
| "Você vê / Você não faz / Você não vê" | `materiais/page.tsx:198-227`, `jovem/materiais/page.tsx:428-433` |
| "Monitoramento — a agenda de cada dupla é da dupla" | `agenda-coordenacao.tsx:161` |
| "O que a semana cobra — cada card abre o dia no calendário." | `agenda-coordenacao.tsx:236` |
| "As turmas não começaram juntas — na mesma semana…" | `agenda-coordenacao.tsx:251`, `agenda-auxiliar.tsx:213` |
| "Apoio aberto é trabalho, não estado da dupla…" | `numeros-semana.tsx` |
| "Vocês marcam o encontro; depois registram aqui como foi." repetido em cada card | `mentor-home.tsx:236` |

**Regra para o `AGENTS.md`:** texto que explica a regra de negócio vai para
uma legenda sob demanda (popover "Como calculamos"), nunca fica fixo na tela.
Se o componente só se explica com um parágrafo, o componente é que precisa
mudar.

**Proposta por item:**

- Cartões-filtro de `/duplas` viram chips com contador; a definição vai para
  o popover.
- Caixas "Você vê / não faz" saem da tela. Se o papel precisa saber o escopo,
  isso vai para o onboarding do papel (o fluxo já existe,
  `onboarding-flow.tsx`).
- Os parágrafos da agenda são cortados. A separação por turma (T1/T2) fica
  evidente por blocos, conforme a decisão "T1/T2 sempre quebrado".
- O texto repetido por card na home do mentor aparece uma vez, no topo, e só
  enquanto a dupla não tem nenhum encontro registrado.

## Problema D. Copy com termo interno e vocabulário que muda

| Hoje | Proposta | Onde |
|---|---|---|
| "Semáforo — 14 duplas", "Semáforo das duplas" | "Situação das duplas" | `duplas-lista.tsx:1426`, `:1795`; `numeros-semana.tsx:136`; `registros-painel.tsx:874` |
| "eixo separado" | remover | `duplas-lista.tsx:800` |
| "Auxiliar executivo" / "supervisão" / "sup." na mesma tela | um termo só ("Supervisão"?) | **D5**: qual termo o programa usa com os voluntários? |
| "Materiais" (staff) × "Jornada" (jovem), ambos com ícone de pasta | ícone de pasta só para acervo; jornada com ícone de trilha | `jovem-shell.tsx:38`, `app-shell.tsx` |
| "2025/2026", "Turma 1 2026/2027", "T1" | "Turma 1" em toda tela; o ciclo só onde precisa distinguir | `src/lib/turma.ts` (`turmaLonga`), REALIZA-200 |
| "Boa/Baixa/Excelente" sem dizer de quem é a nota | "nota do mentor: Boa" | cards da home da coordenação |
| "Abrir dupla ↗" (ícone de link externo para rota interna) | "Abrir dupla ›" | `mentor-home.tsx` |
| Travessões em excesso no corpo (detector: 10 na home do jovem) | frases curtas | copy do jovem |

## Problema E. Títulos de seção com estilo de rótulo

32 dos 108 `h2` do app usam o estilo de rótulo pequeno (`text-[11px]
uppercase text-muted-foreground`). Arquivos incluem
`duplas/[id]/page.tsx`, `pessoas/[id]/page.tsx`, `perfil-form.tsx`,
`pdm-dupla.tsx`, `encerramento-dupla.tsx`, `agenda-calendario.tsx` e
`resumo-jornada.tsx`.

**Proposta.** Seguir o `AGENTS.md`: título de seção em `text-base
font-semibold`; o estilo de 11px fica para rótulo de grupo dentro de card. É
uma varredura mecânica, revisada visualmente tela a tela.

## Escopo de arquivos

- Novo: `src/components/dupla-linha.tsx`, `src/components/saude-programa.tsx`
- Migram para eles: `dashboard-coordenacao.tsx`, `duplas-lista.tsx`,
  `fila-acompanhar.tsx`, `agenda-coordenacao.tsx`, `agenda-auxiliar.tsx`,
  `numeros-semana.tsx`, `mentor-home.tsx`
- Copy: arquivos da tabela C/D
- `AGENTS.md`: regras de "UI não se explica" e "dupla canônica"

## Critérios de aceite

- [ ] Os mesmos números de ativas, risco e apoio na home, na agenda e em `/duplas`, nos mesmos dados de demo (spec e2e compara os três).
- [ ] `grep -rn "Semáforo\|eixo separado" src --include=*.tsx` só em comentários.
- [ ] Detector `side-tab` = 0, exceto as citações `blockquote`.
- [ ] Nenhum nome de dupla truncado a 1280px em `/duplas`.
- [ ] Contraste da barra de saúde ≥4,5:1 (texto) e ≥3:1 (segmento).

## Dependências

Plano 01 (tokens de status). Coordenar com REALIZA-197 (duplas), REALIZA-195
(agenda) e REALIZA-200 (rótulo de turma).
