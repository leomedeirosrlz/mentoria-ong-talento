# Review consolidada — persona UX (38 pastas com design.md)

Agente fb7d9b97. Contra `_recon/telas-mapa.md` + `src/` direto.
(`.devin/skills/ux-review` não existe fisicamente — critérios do brief aplicados.)

**Vereditos: 24 APROVADO · 12 COM-AJUSTES · 2 REPROVADO (16, 56).**

## REPROVADO

- **16** — cita padrão `Command`/busca de pessoa que **não existe**
  (`nova-dupla-dialog` usa `Select` simples com fetch, `:139-150`): o picker de
  "vincular a um jovem" precisa ser especificado de verdade.
- **56** — conflito de arquitetura com a 178 na mesma página `/relatorios`: a 56
  desenha página única em scroll (4 cards+listas+builder embaixo, >2 viewports —
  contraria o feedback de densidade), enquanto a 178 define a espinha chips
  `?secao=` e delega o conteúdo à 56. **Decisão: 178 fica com a espinha; 56
  redesenha seus blocos como conteúdo de seção** (Saúde=semáforo+atenção;
  Pendências=apoio+docs+presenças; Operação=engajamento+remarcações+instrumentos).

## Falhas transversais

1. **Componentes citados que não existem**: `Command`/busca-pessoa (16),
   `Checkbox` em `ui/` (51 — real é `<input type=checkbox>`), `getTurmas()`/
   `getTurmasAtivas()` (32/159 — real: `getCronogramas`), `type="range"` na roda
   (143 — real é `AreaSlider` custom `roda-vida.tsx:318+`), "bottom-sheet do
   dropdown-menu" (181 — dropdown é popover mesmo no mobile; `Sheet` não existe).
   Todo `a verificar` vira nome real ANTES do PR.
2. **`EstadoCard` fora do habitat** — renderiza `<h1>` (estado terminal de página
   pública); 178 e 180 o colocam em página/dialog autenticado → quebra hierarquia.
   Variante sem h1 ou padrão inline.
3. **`title` attr** não existe no touch (49, 174) — ok só como degradação
   declarada com alternativa (ficha/TSV).
4. **Persistência de filtro sem decisão** — padrão recomendado: `?param=` quando
   compartilhável/SSR (registros 175, relatórios 178, turma 73), client-state
   quando efêmero (pessoas 39).
5. **Permissões imprecisas**: 175 — mentor nunca chega a `/registros` (rota é
   coord+sup, `page.tsx:95`); 179 — chips de sugestão sem supervisor/especialista.

## COM-AJUSTES por issue

- **32** — `getTurmas()`→`getCronogramas`; ponto de designação (Select de turma em `pessoa-actions`) por fechar; ">8 duplas" colapso = número mágico.
- **37** — falta Persona/JTBD; `aria-live` precisa existir no DOM antes da 1ª busca (region persistente).
- **49** — ver transversal 3/4.
- **51** — Checkbox (transversal 1); anatomia mobile da seleção por especificar; fallback "dupla sem mentor c/ WhatsApp".
- **73** — destino do clique no card (navega vs aplica contexto) e local do seletor (sugere faixa própria) por decidir.
- **138** — gesto que grava `demo_view` (clique na pill? `?v=`?) não especificado; copy "Ver no produto" vs login.
- **143** — reusar contrato ARIA do `AreaSlider` (não input range); variante A×B e breakpoint por fechar (default sugerido: B).
- **159** — `getCronogramas`; `Select` de papel por consistência.
- **173** — `EstadoVazio` é local de `duplas-lista` (extrair pra components/); `NoEstacao` real em `jovem/materiais/page.tsx:554`; regra de agregação da pill de estado (warn>ok>vazio?).
- **174** — sub-header por turma do `VisaoSupervisor` (`duplas-lista.tsx:1330`) precisa sobreviver à migração pro `LinhaDupla`.
- **175** — links de ordem reais em `registros/page.tsx:334-340` (citação errada); permissão de mentor corrigir; `xl:grid-cols-2` com card expandido confirmar.
- **178** — defer cards à 56; `EstadoCard` transversal 2; `resumo_semana` é nome de tool IA — função real é `resumoSemana` (`ciclo.ts:1108`).
- **180** — `EstadoCard` transversal 2; erro por linha do "Corrigir por texto" ausente; linhas IA precisam fundo distinto além do badge.
- **181** — âncora "PDM nativo" real em `duplas/[id]/page.tsx:1121-1123` (section nova após `InstrumentosDupla` :1161); dropdown-menu NÃO vira sheet — decidir popover ou declarar Sheet novo; cap submetas por meta vs total; slot `/jovem/pdm` na bottom-nav de 5 células.
- **20** — "mesclar" ambíguo → timestamp inteiro decide; `visible_if` na devolução mantém valor; slot do chip "Devolvida" por fechar.
- **18** — overlay quando `antes` é null/malformado (só roda única?); `resumoDelta` em lib pura.
- **21** — `#intencoes` replicar convenção `#registrar-<id>`; contador no maxLength.
- **22** — bug real confirmado (`agenda/page.tsx:829-839` — Agendar só com `!pendenteRegistro`).
- **26** — `MOTIVOS_REAGENDAMENTO` em `ciclo.ts:187`; chip "N remarcações" conta o quê exatamente.
- **34** — origem do import: passo 0 ou entrada paralela em `/turmas`; `tabIndex={-1}` no painel de avisos.
- **35** — `sessionStorage.handoff_quem` quem escreve; mailto aponta contato certo.
- **36** — header de dias na grade mobile sem ellipsis; barra nunca regride quando `visible_if` re-exibe.
- **39** — chip+busca e cabeçalho da fila "só T2" viram requisito.
- **47** — destino do clique no `TurmaCard`; select turma em `/registros` dentro do dialog ou chip na barra.
- **54** — dependência da 181 no acceptance (link muda); omissão por papel testada.
- **70** — chave exata de copy por `formularios.sistema` no estado de sucesso; fallback do "Promovido ✓" se chegar antes da 49.
- **71** — escala junto do número nos tiles (denominadores diferentes); tile do mentor some se BLOCKER = quantizada-off.
- **98** — nada; `getDuplaVinculo`/`getDuplaSucessora` verificados.
- **144** — título+pill competem na etapa 1 (título acima do pill); `visible_if` não deixa validação zumbi.
- **157** — nada; micro-fix honesto.
- **162** — estender `demo/jovem-jornada.spec.ts` (já cobre `/jovem/materiais`).
- **166** — ok.
- **169** — `?` demo fixture.
- **170** — "Redefinir senha" mesmo painel "mostra uma vez"; faixa protegido com ícone `aria-hidden`.
- **172** — gate cobre item 6 app-side.
- **177** — planilha dos 51 = artefato obrigatório; `DialogDescription` obrigatório ou recomendado → decidir regra (`aria-describedby` alternativo).
- **179** — microcopy do erro real é "Esta consulta não está disponível pro seu papel." (`tools.ts:419`); chips sup/esp completar; composer offset da bottom-nav ~64px+safe-area; slot de `/assistente` na bottom-nav ("Mais"?).

## O que o batch faz bem

Persona+JTBD exemplares (20 "ônibus", 56 "5s/30s/2min"); reuso de componentes
reais como norma; densidade do feedback respeitada (silêncio com 1 turma,
`<details>`, conceito-uma-vez-por-superfície); a11y acima da média (treeview 181,
wizard 144, grade 36, canal redundante 18, foco devolvido 157).
