# Auditoria pós-merge `feat/ux-refresh-2026-10` — /materiais, /jovem/materiais, /agenda

Base: HEAD (`b5684a8`) × `436065e^` (pré-merge) × mocks aprovados (materiais `v5c`, agenda `v8b`) × planos `docs/planos/feedback-ux-2026-10/{materiais,agenda}-coord.md`. Severidade em ordem decrescente.

## Achados

- [regressão-funcional] /materiais | Perfil com papel `coordenacao` secundário (ex.: supervisor + coordenação) perdeu "Enviar em lote" — `ehCoord`/`papelInstrumentos` derivam do role PRIMÁRIO, enquanto a RPC `emitir_instrumento_lote` autoriza por `has_papel('coordenacao')` (o botão existia e funcionava pra esse papel); de quebra a página fica internamente incoerente pro mesmo perfil (painel em voz coord via `ehSupervisor={!temPapel(...)}`, seção em voz supervisor) | src/app/(app)/materiais/page.tsx:51,149-153,245 + instrumentos-programa.tsx:192,296-305 vs `podeLote={temPapel(me,"coordenacao")}` em 436065e^:src/app/(app)/materiais/page.tsx:155 + supabase/migrations/0114_instrumento_lote_email.sql:57.
- [regressão-copy] /materiais | A caixa de escopo do supervisor perdeu a cláusula "você não faz" — painel antigo e mock v5c diziam "Sem botão de enviar ou preencher — quem entrega é o mentor"; hoje a caixa só cobre o que ele não vê | src/app/(app)/materiais/page.tsx:212-221 vs 436065e^:src/components/painel-jornada.tsx ~L83-93 + docs/mockups/materiais/v5c.html ~L800, L1224.
- [ruído] /agenda | O deep-link `?jw=` (documentado como "janela temporal de coord/sup") é engolido em silêncio pro supervisor puro — o guard do ramo auxiliar só o deixa passar quando há papel de mentor | src/app/(app)/agenda/page.tsx:62-67,338-346.
- [ruído] /jovem/materiais | A bandeira final "Celebração da jornada" é texto hardcoded — usa número+data do cronograma mas nunca lê `eventoFim.titulo`; em turma encurtada o rótulo pode não casar com o evento real | src/app/(jovem)/jovem/materiais/page.tsx:461-470 (`eventoFim` resolvido em L234-235 sem uso do título).
- [desvio-sistema] /materiais | Híbrido staff+mentor lê a nota do guia em voz de mentor ("Como conduzir") na biblioteca, enquanto na agenda a mesma pessoa lê "O que cobre" (voz staff) por decisão explícita `ehMentor && !ehCoordSup` — mesmo dado, mesma pessoa, vozes diferentes entre superfícies do mesmo refresh | src/app/(app)/materiais/page.tsx:309-312 (`ehMentorDpp ? "mentor" : vePainel ? "staff"`) vs src/components/agenda-calendario.tsx:671,1866-1867.
- [desvio-sistema] /materiais | Os cards de instrumento do mentor viraram catálogo + deep-link "Na ficha"; o mock v5c aprovado prometia o workbench por dupla (seletor Ana·Caio, ações "Enviar link"/"Preencher junto"/"Ver resposta" por card) — o plano registra que faltaria uma fonte de dados por dupla | src/app/(app)/materiais/instrumentos-programa.tsx:287-395 vs docs/mockups/materiais/v5c.html ~L930-1040 + docs/planos/feedback-ux-2026-10/materiais-coord.md:268-272.
- [desvio-sistema] /materiais | Cards "Avaliação por terceiros" e "Avaliação do encontro" perderam o agregado do mock ("20 de 26 com devolutiva feita", "Ver consolidados", "Ver respostas da semana") — viraram o link genérico "Ver por dupla" apontando pra /duplas | src/app/(app)/materiais/instrumentos-programa.tsx:313-324 vs docs/mockups/materiais/v5c.html ~L654-668.
- [cosmético] /materiais + /jovem/materiais | O mesmo conceito aparece como "trancada" na estante do jovem e "trancado" nos cards de staff — gênero divergente dentro da mesma feature | src/app/(jovem)/jovem/materiais/page.tsx:553-557 vs src/app/(app)/materiais/instrumentos-programa.tsx:140-148.

## (a) O que genuinamente melhorou

- "Enviar em lote" saiu do painel pros cards de "Instrumentos do programa" com contador e prévia — mesmas 5 estações emissíveis, mesmo cap, melhor descobribilidade (instrumentos-programa.tsx:296-312; mock v5c ~L626-647).
- O painel "Progresso da jornada" virou faixa rolável por instrumento com mini-barras POR TURMA (T1/T2 com denominador próprio), legenda honesta e matriz atrás de gesto — sem agregado que mistura turmas (painel-jornada.tsx:167-315,466-651).
- Lista "fora da janela" passou a mostrar a posição da PRÓPRIA dupla (`encCorrDupla`) em vez do encontro vigente da turma — leitura mais correta (painel-jornada.tsx:352 vs 436065e^ `encVigente`).
- /agenda da coordenação: síntese com link pra /chamados, "Semana do programa" compartilhada, "Números da semana" por turma (cobertura × semáforo × pulso com ★ da jovem), fila "Para acompanhar" com filtros reais e "Lembrar registro" específico — tudo conforme v8b (agenda-coordenacao.tsx, numeros-semana.tsx, fila-acompanhar.tsx).
- Visão "ciclo" substitui a antiga "lista" com timeline por encontro oficial + cobertura + salto pra semana; `?jw=mes` preserva a grade de mês (agenda-calendario.tsx:914-933,1546-1582,2426+).
- Nenhuma affordance de agendamento aparece pra coordenação/supervisor — tudo gated por `ehMentorUi`; "Abrir chamada" só no dia e só pra coord (semana-do-programa.tsx:178-190).
- /jovem/materiais: cards-produto com capa do instrumento, data de liberação honesta nos trancados ("libera no enc. N (dd/mm)"), card de terceiros explicando o consolidado, "Em andamento" via rascunho local, e fallback intacto pra biblioteca plana (jovem/materiais/page.tsx:410-471,815-886; lib/jornada.ts:472-480).

## (b) Perguntas que precisam da sua decisão

1. A simplificação "catálogo + deep-link" pros cards do mentor em /materiais é aceitável, ou vale a RPC nova (estado por instrumento das N duplas dele) pra entregar o workbench por dupla do v5c?
2. `papelInstrumentos`/`ehCoord` por role primário: a remoção do lote pra supervisor+coordenação foi intencional? Se não, voltar a `temPapel`.
3. Cards avaliacao_encontro/terceiros: manter o "Ver por dupla" genérico ou construir os agregados do mock ("respostas da semana", "N de M com devolutiva")?
4. Alinhar `guiaPapel` de /materiais com a regra da agenda (staff surface lê voz staff mesmo pra híbrido)?
5. `?jw=` vale alguma coisa pro supervisor puro, ou a superfície de calendário fica mesmo fora do escopo dele?
6. O nudge ("Lembrar mentor") continua visível pro supervisor no painel de materiais — o mock marca "nudge da auxiliar" como decisão em aberto; manter como está?
