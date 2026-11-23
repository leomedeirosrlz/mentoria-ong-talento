# Spec — Badges isométricas e níveis de jornada

**Feature:** `specs/016-badges` · **Status:** Clarified
**Fila:** `REALIZA-516` · **Dono:** Thiago · **Data:** 23/11/2026

## Problema e resultado

- **Dor hoje:** as conquistas usam emblemas Phosphor genéricos, sem ilustração própria; a estante só mostra o que foi ganho e não há níveis por tempo de programa; a pessoa não vê o que ainda pode conquistar sem parecer castigo.
- **Resultado observável:** badges isométricas animadas, com identidade da casa, níveis por tempo/participação e uma estante que mostra ganhas e futuras (sem cadeado punitivo), com legenda e progresso honesto.
- **Como saberemos que funcionou:** a pessoa reconhece cada badge, entende o que falta e sente orgulho de compartilhar; o perfil continua earned-only na estante principal e a área de futuras não mente.

## Fora de escopo

- Ranking, pontos, streak ou competição entre pessoas.
- Persistir nova tabela de badges (derivação pura primeiro).
- Substituir a retrospectiva “Spotify”.

## Histórias de usuário

### US1 — Badge com ilustração própria (P1)

- **Por que P1:** o emblema atual não diferencia conquistas e parece ícone de menu.
- **Teste independente:** abrir o perfil e comparar 3 badges.
- **Cenários:**
  1. **Dado** uma conquista ganha **quando** o perfil abre **então** a badge tem ilustração isométrica própria, cor da casa e nome legível.
  2. **Dado** a badge em hover/foco **quando** a pessoa interage **então** há uma animação curta e opcional, com `prefers-reduced-motion`.
  3. **Dado** leitor de tela **quando** navega **então** ouve o nome, o estado e a data, não o desenho.

### US2 — Níveis por tempo de programa (P1)

- **Por que P1:** o reconhecimento por permanência é o que o Thiago pediu (veterano etc.).
- **Teste independente:** perfis com 1 semana, 1 mês, 3 meses e programa completo.
- **Cenários:**
  1. **Dado** o tempo de programa **quando** o perfil abre **então** a badge de nível mostra o estágio atual (ex.: Início, Constância, Veterano, Jornada completa).
  2. **Dado** o próximo nível **quando** a pessoa vê **então** entende o critério e quanto falta, sem data inventada.
  3. **Dado** uma trilha de especialista **quando** o perfil abre **então** o nível usa a régua da trilha correta, não a DPP.

### US3 — Ganhas e futuras sem cadeado (P2)

- **Por que P2:** o Duolingo/Discord mostram o que vem; esconder tudo desmotiva.
- **Teste independente:** perfil com 0, 1 e todas as badges.
- **Cenários:**
  1. **Dado** uma badge futura **quando** a estante abre **então** ela aparece apagada, com critério em texto, nunca cadeado.
  2. **Dado** todas as badges **quando** abre **então** a estante celebra sem lista infinita.
  3. **Dado** uma badge conquistada **quando** abre o detalhe **então** vê data, critério e o que ela significa.

## Casos de borda

- Jornada sem dupla, pausada, encerrada ou de especialista.
- Tempo de programa sem data de início.
- Badge futura sem critério calculável: não inventar.
- Mobile 390, tema atual, movimento reduzido, contraste.
- Assets locais; nada de CDN externo bloqueado por CSP.

## Requisitos funcionais

- **FR-001:** badges DEVEM ter ilustração isométrica própria, não o glifo Phosphor genérico.
- **FR-002:** a animação DEVE ser curta, opcional e respeitar `prefers-reduced-motion`.
- **FR-003:** níveis DEVEM derivar do tempo/participação da trilha, com critério textual.
- **FR-004:** futuras DEVEM aparecer sem cadeado, com critério e progresso quando calculável.
- **FR-005:** a estante principal continua earned-only; a área de futuras é separada.
- **FR-006:** tudo DEVE funcionar offline/local, sem dependência de CDN.

## Requisitos não funcionais

- **A11y:** nome/estado em texto, foco, contraste, sem movimento obrigatório.
- **Perf:** SVG/ilustração leve; animação em CSS/WAAPI, sem JS por frame.
- **LGPD:** nenhum dado novo; nível não expõe tempo sensível além do programa.
- **Demo:** dataset com níveis e futuras.

## Entidades e dados

Derivação pura a partir de `conquistasDoJovem`/`jornada`; se um nível precisar de data de início, usar `duplas.iniciada_em`. Nenhuma tabela nova nesta fatia.

## Critérios de sucesso

- **SC-001:** prints das 4 faixas de nível e de 0/1/todas badges.
- **SC-002:** animação visível e versão reduced-motion.
- **SC-003:** testes de derivação de nível e de futura sem data inventada.

## Premissas

- As ilustrações serão feitas com a skill de ilustração isométrica e versionadas em `public/`/SVG.
- O Claude pode ser usado para a direção visual e os assets; a integração e testes são Devin.
