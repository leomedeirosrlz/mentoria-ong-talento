# REALIZA-379 — Retrospectiva "Wrapped" do jovem e do mentor

Issue: `jornada`, `dpp`, `jovem`, `mentor`, `ux`. Fonte: backlog 2026-11
(Thiago: "precisa ser arquitetada, engineered — é o que vai fazer o jovem
lembrar do programa/instituto. Visual, chamativo, compartilhável,
orgulhável. Tipo retrospectiva do Spotify"). Status: a fazer.

## Por que é peça de identidade

O encerramento é o ponto emocional máximo do programa — e hoje o que o
jovem leva dele é uma lista de texto num card. A retrospectiva é o
**artefato que fica**: o objeto que o jovem mostra pra família, posta,
guarda. É o que transforma "participei de um programa" em "olha o que eu
vivi". Por isso ela não é mais uma seção de ficha: é um produto com
entrada própria, visual próprio e saída própria. Referência do pedido:
a retrospectiva do Spotify — sequência de momentos cheios de cor,
tipografia grande, ritmo de revelação, e um card final feito pra ser
compartilhado.

## O que exige vs. o que existe

Existe (recon verificado — REALIZA-359 já entregue):

- **Derivação completa** — `dadosRetrospectiva`
  (`src/lib/retrospectiva.ts:137-271`) monta tudo da dupla: timeline de
  todos os encontros realizados (número, data, tema, avaliação do mentor,
  trechos de registro), combinados com status/datas, par de Rodas
  inicial×formal, checklist de competências do mentor início×fim, e o
  `ResumoJornada` por dentro (nomes, trilha, início/fim, realizados vs.
  esperados, média 1–4, PDM via `PdmResumo`). O recorte da jovem
  (`dadosRetrospectivaJovem`, :353-416) alimenta a mesma derivação só com
  o que é dela — sem notas internas e sem o checklist (a RPC nem projeta
  o instrumento, `0190_competencias_mentor.sql:560-568`).
- **Régua de desbloqueio** — `dadosRetrospectiva` marca `desbloqueada`
  com 16º encontro `realizado`, dupla `concluida`/`encerrada` (ou
  `encerrada_em` da trilha especialista) ou marco de 3 meses da trilha
  (`retrospectiva.ts:159-170`, `encerramento.ts:279-297`). A RPC
  `jovem_jornada` já devolve `retrospectiva.desbloqueada` + a timeline
  dela (numero/data/tema — `0190:597-613`): **o gatilho do banner na
  home do jovem é grátis**, `getJovemJornada` já é chamada na home
  (`(jovem)/jovem/page.tsx:115`).
- **Duas superfícies de staff/relatório** — `RetrospectivaJornada`
  (`src/components/retrospectiva-jornada.tsx`) renderiza na ficha da
  dupla (`duplas/[id]/page.tsx:1151` e `:1272`, com notas internas e
  checklist) e em `/jovem/materiais` (`materiais/page.tsx:562`, recorte
  dela). É uma seção em card — a narrativa existe, a *experiência* não.
- **Avaliações do jovem** — `getJovemAvaliacoes`
  (`queries-avaliacao.ts:126-151`) devolve estrelas 1–5, `sentimento`
  (5 chips), `avancei` (3 valores), `temas` (9 chips) e `comentario` por
  encontro. `resumoAvaliacaoJovem` (`avaliacao-agregado.ts:100-115`) já
  deriva média, trajetória primeiro→último e top-3 temas — com a régua
  de privacidade da 0071 (mentor DPP só recebe média quantizada das
  avaliações que o jovem liberou, `avaliacao_visivel_mentor`).
- **PDM rico** — `PdmResumo` traz metas atingidas com datas; `PdmDoc`
  tem `visao` (o texto de projeto de vida do jovem, até 2000 chars —
  `pdm.ts:25-29`), `porque` e `areaVida` por meta.
- **Identidade generativa pronta** — `hashSeed`/`rand`
  (`src/lib/banner.ts`) seeda arcos concêntricos + nome fantasma por id;
  `PessoaBanner` usa como "impressão digital" da ficha. O mesmo vocabulário
  dá a cada dupla uma capa de Wrapped única — arte própria, custo zero de
  produção, nunca duas iguais.
- **Infra de link público** — `relatorio_links` + `resumo_acessos` +
  RPCs `relatorio_link_info`/`abrir_relatorio` (0110/0111): slug 12–128
  chars, senha bcrypt opcional, expiração, revogação, auditoria e
  rate-limit de dois eixos — tudo allowlist em SQL. O matcher do proxy
  já isenta `opengraph-image`/`twitter-image` (`src/proxy.ts:18-24`) e
  `SITE_URL`/`metadataBase` resolvem og absoluto (`site.ts`, layout).
- **Snapshot imutável** — `encerramentos.resumo_jornada` (0037) guarda o
  texto do fechamento; a tela derivada segue viva a partir dos dados.

Gap: tudo isso existe em **forma de relatório** — seções dentro de
páginas com outro propósito. Não há entrada dedicada na home do jovem,
não há tela imersiva, não há arte celebrativa, e não há nada
compartilhável. É exatamente a diferença entre "exportar CSV" e o
Wrapped.

## Decisões

1. **Três artefatos, uma derivação.** `ResumoJornadaSection` segue o
   relatório compacto print-friendly de staff; `RetrospectivaJornada`
   segue a seção documental da ficha/materiais (o documento da jornada —
   onde se lê tudo com calma, imprime, audita). A 379 adiciona a
   **terceira superfície: a experiência** — mesmo `DadosRetrospectiva`
   como fonte, novo modelo de "momentos" por cima. Nada é substituído:
   a experiência é a capa; o documento é o recibo.
2. **Rota dedicada, não modal.** Duas rotas novas sobre os dois payloads
   já existentes:
   - **`/jovem/retrospectiva`** — dentro do route group `(jovem)`, com
     chrome próprio (sem `PageHeader` de app; a tela é o espetáculo). A
     bottom-nav do `jovem-shell` permanece (é a saída) e o conteúdo toma
     o viewport acima dela; deep-linkável, e a home ganha o banner que
     aponta pra cá.
   - **`/duplas/[id]/retrospectiva`** — mentor/staff, mesma régua de
     papel da ficha (a query da ficha já escopa: mentor da dupla, sup,
     coord). Deep-linkável do `MentorHome` e da ficha.
   Modal full-screen foi descartado: sem URL, sem refresh seguro, preso
   no chrome da página pai — o contrário de "experiência única".
3. **Formato: sequência de momentos, não seções.** O Wrapped é um
   carrossel de telas inteiras — um momento por viewport, navegação por
   tap/avançar (zona direita) e voltar (esquerda), dots de progresso,
   setas/swipe no desktop. Long-scroll contínuo foi descartado: vira o
   relatório de novo — a mágica do Spotify é o *ritmo* (uma revelação
   por vez). A mesma árvore de momentos renderiza **modo página**
   (empilhado, estático) como fallback de acessibilidade — e é o que o
   print e o `prefers-reduced-motion` recebem (o guard global de
   `globals.css` já zera animação; o stepper vira lista).
4. **Identidade: arte generativa por dupla.** A capa do Wrapped usa o
   vocabulário de `banner.ts` com seed `dupla.id`: arcos concêntricos +
   primeiro nome do jovem e do mentor como tipos fantasma, sobre campo
   escuro celebrativo com `--destaque`/`--brand-lime` (amarelo =
   celebração, jornada — papel por cor do AGENTS). Cada dupla tem capa
   própria sem nenhum trabalho de design por par — é "meu" porque só
   existe pra aquela jornada. O mesmo componente SVG alimenta o card de
   compartilhamento (item 7) — a arte é determinística, o PNG sai igual.
5. **Os momentos (ordem e dados — tudo derivado, nada authored).**
   Régua: número de momentos varia com o que existe (seção sem dado
   simplesmente não vira momento — mesma disciplina de degradação da
   359). Ordem proposta:
   1. **Capa** — arte da dupla; "A jornada de {jovem} com {mentor}";
      trilha + `iniciada_em`→`fim`; turma quando houver.
   2. **Os números** — `realizados` de `total` encontros em tipografia
      gigante; duração da jornada (meses derivados de início→fim —
      helper `duracaoJornada`, a métrica que "quanto tempo durou" pede);
      esperados vs. realizados só na DPP (na especialista `esperados`
      é null por construção).
   3. **A trilha** — os encontros como arco visual numerado (nós com
      número, data e tema), não como `<ol>` de relatório; jovem vê
      número/data/tema (payload dela), mentor/staff veem também a
      avaliação dele.
   4. **Como foi pra você** *(jovem; mentor vê recorte 0071)* —
      trajetória de estrelas `trajetoria.primeiro`★→`trajetoria.ultimo`★
      e média; top-3 `temasTop` com `TEMA_AVALIACAO_LABEL` ("Carreira e
      futuro", "Escola e estudos"...); sentimento dominante
      (`SENTIMENTO_AVALIACAO_LABEL`); % `avancei='sim'`. É o momento
      mais "Wrapped" — a jornada contada pelo que ela sentiu. Pro
      mentor degrada pra só a média quantizada das avaliações que ela
      liberou (item 8); abaixo disso, o momento não existe.
   5. **A roda, antes e depois** — morph animado inicial→formal (o
      `RodaComparada` já sabe sobrepor; aqui vira transição) + top-3
      `deltasRoda`: as áreas que mais cresceram ("Família: 4 → 7").
      Roda única → aplicação solitária (degradação da 359).
   6. **O plano** — PDM: metas atingidas como conquistas com data de
      `atingidaEm` (já vem do `PdmResumo`); a `visao` como citação de
      fechamento **só no recorte da jovem** (é o texto de projeto de
      vida dela — no recorte staff aparece só se a régua da ficha já a
      expõe ao papel; verificar no kickoff).
   7. **Os combinados** — `combinadosFeitos` de `combinadosTotal`
      cumpridos; a lista dos feitos quando couber.
   8. **Dos registros** *(mentor/staff)* — trechos já rotulados
      (`TrechoRegistro`: "O que rolou", "Próximo passo", reflexões,
      dificuldades, observações, pedidos de apoio — `comNotasInternas`
      já separa o que é interno). Jovem: este momento não existe — a
      RPC não projeta trechos pra ela, por construção.
   9. **Competências do mentor** *(mentor/staff)* — início×fim do
      checklist, já pareado.
   10. **Final** — celebração + CTAs de compartilhamento (item 7) +
       `resumo_jornada` do `encerramentos` quando o rito já decidiu +
       link "Ver a retrospectiva completa" (o documento da 359).
6. **O banner na home — gatilho e forma.**
   - **Gatilho: o mesmo `desbloqueada`, sem lógica nova.** Jovem:
     `jornada.retrospectiva.desbloqueada` já chega na home
     (`page.tsx:115`). Mentor/staff: a mesma derivação
     (`dadosRetrospectiva().desbloqueada`) sobre a `Dupla` que o
     `MentorHome` já recebe (a `DUPLA_SELECT` embute `encontros` —
     `types.ts:563`); extrair a régua inline de `retrospectiva.ts:159-170`
     pra helper `retrospectivaDesbloqueada(dupla)` reutilizável.
   - **Visual: hero generativo, não card comum.** Na home do jovem o
     banner ocupa o slot do `ProximoEncontro` quando não há próximo
     encontro (pós-16 não há) — ou seja, ele **é** o herói da home no
     fim de ciclo, não um card a mais na pilha. Arte da dupla em
     full-bleed, kicker "Sua retrospectiva", título com o primeiro nome
     ("{Nome}, sua jornada virou filme" — copy a fechar, ver riscos), um
     CTA grande "Ver minha retrospectiva". Não é dismissível: é um
     artefato permanente enquanto `desbloqueada`, não um aviso a
     descartar.
   - **Mentor:** no `MentorHome`, a dupla desbloqueada ganha uma faixa
     destacada no card dela ("A retrospectiva de {jovem} está pronta →")
     linkando `/duplas/[id]/retrospectiva`. Coord/sup acessam pela
     ficha (a 359 já mostra a seção; o link para a experiência entra
     junto ao bloco).
7. **Compartilhável — opções honestas.**

   | | **A — Card exportável** | **B — Link público** | **C — Share nativo s/ link** | **D — Print (já existe)** |
   |---|---|---|---|---|
   | O que é | Cada momento renderiza também em ratio fixo (1:1 feed, 9:16 story); "Baixar imagem" gera PNG | `/retro/[slug]` — a jornada pública allowlistada, sobre a infra `relatorio_links` | Web Share API/WhatsApp compartilha texto+imagem de A; sem URL pública | `ImprimirButton` do resumo (staff) |
   | Esforço | **M** — `opengraph-image`/`ImageResponse` (next/og embutido) com o mesmo componente SVG da arte; rota autenticada `/jovem/retrospectiva/card` | **G** — braço `tipo='retrospectiva'` em `abrir_relatorio` + RPC de criação/consentimento + página pública + OG + testes | **P** | Zero |
   | Risco | Nenhum novo — a imagem sai do device da pessoa, que escolhe onde postar | LGPD real: o jovem pode ser menor; link vaza nome+trajetória; enumeração; exige disciplina de nunca projetar texto livre | Nenhum | — |
   | Cobre "compartilhável"? | Sim — o formato Wrapped de verdade (imagem nos stories) | Sim, e com preview (og:image) — o mais forte, mas o mais sensível | Parcial — sem link não há preview em WhatsApp/LinkedIn | Não — é documento interno |

   **Recomendação: fatia 1 = experiência + A.** O card exportável
   entrega o "orgulhável/compartilhável" sem abrir superfície pública
   nem precisar de consentimento — a pessoa compartilha a *imagem*,
   decisão dela, dado dela. **Fatia 2 = B**, com consentimento explícito
   do jovem (a existência do link *é* o consentimento — ver Schema).
   Implementação de A: `ImageResponse` numa rota autenticada — o
   componente da arte é SVG+texto puro, território nativo do Satori —
   e a mesma rota vira `opengraph-image` do link público na fatia 2.
   Captura client-side (`html-to-image`) descartada: dep nova,
   fidelidade frágil com SVG/blend modes, e duplica a arte em dois
   motores.
8. **Recortes por papel** (mesma régua da 359, estendida):
   - **jovem**: todos os momentos menos "Dos registros" e "Competências";
     os dados sensíveis dela (sentimentos, temas, visão do PDM) aparecem
     porque são dela.
   - **mentor da dupla**: completo, incl. seu checklist — mas o momento
     "Como foi pra você" respeita a 0071: só o que ela já vê hoje
     (média quantizada das avaliações liberadas), nunca chips de
     sentimento/temas do jovem.
   - **supervisor/coord**: completo (supervisão do mentor incluída).
   - **público (fatia 2)**: só derivados — contagens, datas, temas como
     *labels*, deltas de roda, metas atingidas; **nunca** texto livre
     (`comentario`, `observacoes`, `reflexoes`, `visao`), nunca campos
     internos, nunca chips de sentimento individuais.
9. **O que falta de dado** (vs. o que já existe):
   - **Existe tudo para a fatia 1** — nenhuma query nova obrigatória:
     a página `/jovem/retrospectiva` reusa `getJovemJornada`,
     `getJovemEncontros`, `getJovemEncaminhamentos`, `getJovemAvaliacoes`,
     `getPdmResumo` (o mesmo leque que `/jovem/materiais` já monta,
     `materiais/page.tsx:346-378`); a rota staff reusa exatamente o que a
     ficha já busca.
   - **Mensagem personalizada do programa** — não existe campo: a
     dedicatória da coordenação seria um `encerramentos.mensagem_*`
     novo, escrito no rito. **Decisão aberta** (ver Riscos) — a fatia 1
     vive sem ela (texto derivado segue a regra "gerado, não livre"); se
     entrar, entra como momento extra antes do final.
   - **Fotos da jornada** — `registro_anexos` (foto do PDM, da roda)
     existe mas é anexo de registro; verificar RLS pro jovem ler os da
     própria dupla antes de prometer um momento "galeria". Fora da
     fatia 1.
   - **`visto_em`** — primeira visita como momento de celebração:
     localStorage basta (não é dado de domínio).
   - **Consentimento** — só na fatia 2; a row do link carimba
     `consentido_em`/`consentido_por` (o gesto de criar é o aceite;
     revogar é a retirada).
10. **Escopo em fatias.**
    - **Fatia 1 (a entrega):** rotas `/jovem/retrospectiva` e
      `/duplas/[id]/retrospectiva`; `momentosRetrospectiva` +
      `deltasRoda` + `duracaoJornada` + `retrospectivaDesbloqueada` na
      lib; arte generativa; banner na home do jovem + faixa no
      `MentorHome`; card exportável via `ImageResponse`. Zero migration.
    - **Fatia 2:** link público `/retro/[slug]` com consentimento do
      jovem + OG image + auditoria (Schema abaixo).
    - **Fatia 3 (se decidida):** `mensagem` da coordenação no rito,
      galeria de anexos, nudge WhatsApp "sua retrospectiva está pronta",
      versão impressa pra cerimônia de formatura.

## Schema

**Fatia 1: nenhuma migration.** A experiência deriva de dados vivos e o
consentimento ainda não existe (compartilhar = exportar imagem do
próprio device).

**Fatia 2 — migration `0194_retro_links.sql`** (próximo número livre; o
lote vai até 0193):

- **Reusar `relatorio_links`, não criar tabela nova.** A infra já tem
  slug, senha bcrypt, expiração, revogação, auditoria e rate-limit —
  criar `retro_links` paralela duplicaria tudo isso pra zero ganho.
  - `config` ganha o tipo novo: `{tipo:'retrospectiva', dupla_id:uuid,
    expor_nome_mentorado?:boolean}` — allowlist do tipo na leitura
    (`abrir_relatorio` hoje só aceita `grade|ciclo|assinaturas`,
    `0110:443`): novo braço SQL projetando o payload público do item 8
    (contagens/datas/labels/deltas/metas — projeção nomeada, nunca `*`).
  - `criado_por` hoje referencia `profiles`; o criador jovem é
    `mentorados` — `criado_papel text check in ('coord','mentorado')` +
    `criado_mentorado_id uuid references mentorados` (paridade do
    `num_nonnulls` de `turma_inscricoes`), ou generalizar pra
    `criado_por_kind`. Decidir no plano da fatia — mas o conceito é fixo:
    **a jovem cria e revoga o próprio link**; a row é o consentimento
    (`created_at` = `consentido_em`; `revogado_em` = retirada).
  - RPC nova `emitir_link_retrospectiva` (definer, papel mentorado →
    `my_mentorado_id()` → dupla DPP → `desbloqueada` no banco) — espelho
    das RPCs de gestão existentes; revogação via update em
    `relatorio_links` com policy ou RPC `revogar_relatorio` estendida.
  - Rota `/retro/[slug]` (pública como `/resumo`) + `opengraph-image`
    da rota (o proxy já isenta o pattern). Senha: default **sem** —
    o link é o segredo — mas a coluna já existe se o Thiago quiser.
- **Nada disso é gate da fatia 1** — a experiência e o card exportável
  não tocam o banco.

## Domínio (src/lib/)

- `src/lib/retrospectiva.ts`:
  - `retrospectivaDesbloqueada(dupla)` — extrai a régua hoje inline em
    `dadosRetrospectiva` (:159-170) pra reuso pelo banner (mentor home e
    ficha sem pagar a derivação inteira).
  - `momentosRetrospectiva(dados, {avaliacoes, visao})` →
    `RetroMomento[]` — o modelo da sequência (item 5): puro, ordena,
    omite momentos sem dado, já sai recortado pelo papel (o caller
    decide `comNotasInternas`/`mostrarChecklist` como hoje).
  - `deltasRoda(inicial, formal)` → top-N `{label, de, para}` por
    `notaFormal - notaInicial` (mesma área por `id` — `mesmasAreas` já
    garante paridade).
  - `duracaoJornada(inicio, fim)` → meses/semanas pra copy ("8 meses de
    jornada").
  - `agregaAvaliacoes`/`resumoAvaliacaoJovem` reusa direto o que existe
    — `sentimentos`, `temasTop`, `trajetoria`, `pctAvanceiSim`.
- `src/lib/queries-jovem.ts`: nada novo na fatia 1 (leque já montado);
  a página compõe como `/jovem/materiais` já faz.
- Fatia 2: `retroPayloadPublico(dados)` — o recorte público derivado
  (espelho da allowlist SQL, pra página poder renderizar o que a RPC
  entregou).

## UI

- `src/app/(jovem)/jovem/retrospectiva/page.tsx` — rota dedicada; monta
  o payload (mesmas queries de `/jovem/materiais`) e entrega
  `dadosRetrospectivaJovem` + `avaliacoes` + `visao` pro stepper.
- `src/app/(app)/duplas/[id]/retrospectiva/page.tsx` — staff/mentor;
  mesma seleção da ficha (`dadosRetrospectiva` com `comNotasInternas`),
  guard de papel igual ao da ficha.
- `src/components/wrapped-jornada.tsx` (client) — o stepper de
  momentos: dots, tap zones, setas, swipe; modo página como fallback.
- `src/components/wrapped-momentos.tsx` — um renderer por tipo de
  momento (capa, números, trilha, sentimentos, roda, plano, combinados,
  registros, competências, final). Tipografia grande é a regra — números
  em `text-5xl+`, nomes em display; a gramática visual sai do app comum
  (é proposital: o Wrapped não é uma ficha).
- `src/components/wrapped-arte.tsx` — a capa generativa (server-safe
  SVG; reusa `hashSeed`/`rand` com seed `dupla.id`), usada pela capa e
  pelo card exportável.
- `src/components/wrapped-banner-home.tsx` — o hero da home do jovem
  (item 6): full-bleed, arte da dupla, CTA "Ver minha retrospectiva".
- `MentorHome` — faixa por dupla desbloqueada.
- `opengraph-image`/rota de card — `ImageResponse` com a arte; na fatia
  1 autenticada pra download, na 2 pública pro link.
- Copy pt-BR, sem travessão, sem jargão ("semáforo" não existe aqui).
  Motion: `.animate-enter` nos momentos + transições do stepper ≤300ms;
  `prefers-reduced-motion` resolvido pelo guard global.

## Seed + demo

- `src/lib/demo/data.ts`: já há dupla DPP no fim do ciclo com as duas
  rodas, PDM atingido, registros completos e checklist nos dois momentos
  (fixture da 359) — garantir `avaliacoes_encontro` dela com série de
  estrelas/sentimentos/temas (o momento "Como foi pra você" precisa
  aparecer na demo) e `retrospectiva.desbloqueada` no stub da
  `jovem_jornada` (`demo/queries.ts`).
- e2e: fixture reusa a dupla com 16º realizado + links emitidos da 359.

## Testes

- vitest `retrospectiva.test.ts`: `momentosRetrospectiva` — ordem,
  omissão de momento sem dado, recorte por papel (jovem sem checklist/
  trechos; mentor sem chips de sentimento), `deltasRoda` (pareamento por
  id, top-N), `duracaoJornada`, `retrospectivaDesbloqueada` (16º,
  fechada, marco especialista — mesmas bordas da 359).
- e2e:
  - 16º realizado → banner na home do jovem + faixa no `MentorHome` →
    a experiência abre nas duas rotas com os momentos certos;
  - jovem nunca vê checklist do mentor, trechos internos nem campos de
    registro; mentor nunca vê chips de sentimento/temas dela;
  - stepper navega (tap, dots, setas); modo página empilha tudo;
  - card exportável responde PNG autenticado e 404/fora do papel;
  - demo: a retrospectiva demo mostra todos os momentos.

## Critérios de aceite

- [ ] Com a régua de desbloqueio atingida (16º realizado / dupla fechada
  / marco especialista), o jovem vê o **banner hero** na home e o mentor
  a faixa na dupla — sem ação da coordenação.
- [ ] `/jovem/retrospectiva` e `/duplas/[id]/retrospectiva` renderizam a
  sequência de momentos derivada dos dados reais, cada momento uma tela.
- [ ] Recortes respeitados: jovem sem checklist/trechos internos; mentor
  sem sentimentos/temas individuais dela; staff completo.
- [ ] Dados faltantes omitem o momento (nunca erro, nunca placeholder).
- [ ] Card exportável gera imagem da arte da dupla em ratio fixo.
- [ ] `npx tsc --noEmit`, `npx eslint src/` limpos.

## Riscos e decisões abertas (Thiago)

1. **Link público na fatia 2?** Recomendo sim, com a jovem como dona do
   gesto (cria e revoga). Risco LGPD: jovem pode ser menor; o link
   carrega nome + trajetória. Pergunta: o aceite dela basta, ou o fluxo
   pede um ok do responsável/coordenação? E: nome exibido no artefato
   público = primeiro nome só (default proposto) ou completo opt-in?
2. **O que o mentor compartilha?** O Wrapped do mentor mostra o nome do
   jovem — normal dentro do app. No artefato compartilhável dele, o
   jovem aparece como primeiro nome, "meu mentorado" ou não aparece?
   Proposta: primeiro nome.
3. **Mensagem da coordenação?** Um texto escrito no rito tornaria o
   fechamento ainda mais pessoal — e vira tarefa nova da coordenação por
   dupla. Fatia 3 ou deixa fora? (Alternativa sem migration: texto
   derivado padrão.)
4. **Nome do artefato.** "Retrospectiva" descreve; não batiza. Opções:
   manter "Sua retrospectiva" (honesto), dar nome de produto ("Sua
   Jornada", "Minha Jornada Realiza"), ou seguir o anglicismo ("Wrapped"
   não pega em pt-BR). Proposta: superfície "Sua retrospectiva",
   artefato "Minha Jornada".
5. **Trilha especialista entra na fatia 1?** A régua de desbloqueio já
   a cobre, mas a `jovem_jornada` é DPP-only — a jovem de trilha pura
   não tem o payload dela. Proposta: fatia 1 = DPP; especialista vem
   quando a RPC estender (ou derivação client-side sobre encontros dela).
6. **Artefato físico?** Print pra cerimônia de encerramento (o resumo
   já imprime; o Wrapped teria um modo print dedicado). Fora de escopo
   hoje — registrar se o Thiago quiser na fatia 3.

## Fora de escopo

- Mudar o que a retrospectiva **mostra** (conteúdo herda da 359); a 379
  muda **como se experiencia**.
- Edição/authoring da retrospectiva — derivada sempre; texto livre só
  se a mensagem da coordenação entrar (decisão aberta).
- Retrospectiva de coorte/turma ou comparativa entre duplas.
- Notificações automáticas do desbloqueio (WhatsApp/email) — fatia 3.
- Qualquer migração de dados ou backfill — a experiência lê o vivo.
