# REALIZA-374 + REALIZA-370 — Wizard de edição de pessoa: campo civil único, save-anywhere e recorte coord

Issue: `bug`, `ux`. Fonte: backlog 2026-11 (dedup de dados civis no dialog de edição + campos autodeclarados fora da mão da coordenação). Implementação em voo: branch `thiago/wizard-pessoas-fixes` (PR #152), commit `7064f7a`. Status: em implementação.

## O que exige vs. o que existe

### REALIZA-374 — DadosCivisFields montado duas vezes, save sobrescrevia calado

O wizard de edição (`PessoaActions`, staging) renderizava `DadosCivisFields` **duas vezes**: `prefix="civ_"` na etapa "Dados pessoais e documento" (staging `pessoa-actions.tsx:207-213`) e `prefix="civis_"` na etapa "Documentos (termo de adesão)" (:415-421). O `WizardFicha` mantém todos os passos montados (`hidden` nos inativos), então o FormData sempre levava os dois blocos. `updatePessoa` aplicava `camposFicha` (que lê `civis_` via `parseCivis`) **e depois** `camposCivis` (que lia `civ_`) — o spread `...ficha, ...civis` fazia o bloco `civ_` parado sobrescrever a edição feita em `civis_`. Resultado: editar RG/CPF/endereço na etapa de documentos salvava o valor antigo do outro bloco — perda silenciosa.

### REALIZA-370 — coord editava autodeclarado; save só no fim; etapa da foto pulada

- O dialog da coordenação editava campos **autodeclarados** da pessoa (bio, linkedin, áreas de atuação do perfil, voluntariado, interesses, motivação, cargo/empresa, origem, experiência prévia e formação externa do mentor). São dados que a pessoa preenche no onboarding/perfil — a coord sobrescrevia sem querer num save de outro campo.
- O save só existia no último passo ("salve no fim"): voltar pra corrigir um campo da etapa 1 exigia re-percorrer o wizard.
- As barras de etapa eram display-only — sem navegação direta.
- Bug de auto-skip: o botão do rodapé **virava** `type="submit"` no último passo; o default action do clique é avaliado depois do re-render, então o último "Avançar" já disparava o form — a etapa da foto/consentimento era pulada.

## Decisões

- **Uma fonte por campo civil:** o bloco `civ_` saiu da etapa "Dados pessoais" (que perdeu "e documento" do título). O único `DadosCivisFields` do dialog é o `civis_` da etapa "Documentos (termo de adesão)" (`pessoa-actions.tsx:280-285`). Descartada a alternativa de manter os dois e reconciliar no server — dois inputs visíveis pro mesmo dado é o bug em si, não um problema de merge.
- **`camposCivis()` deletada** (`actions.ts`): o único caminho de `dados_civis` é `camposFicha` → `parseCivis({ prefix: "civis_", deFicha: true })`. O modo `deFicha` junta `nome`/`data_nascimento`/`cidade`/`uf` dos próprios campos da ficha — `dados_civis.nome_civil` agora **sincroniza com o nome editado** e `endereco.cidade/uf` seguem os da ficha (antes eram inputs escondidos/duplicados). Bloco todo vazio → `dados_civis = null` (limpeza intencional — os campos vêm pré-preenchidos do jsonb, então vazio = apagou de propósito).
- **Autodeclarados fora da edição da coord** (`pessoa-actions.tsx`): sumiram as etapas "Localização e interesses", "Trabalho e origem", "Motivação (e pareamento)" e "Apresentação pública" inteiras, mais `experiencia_previa`/`formacao_externa` da ficha de mentor (e do tipo `MentorProfile`/select do fetch). `cidade`/`uf` migraram pra "Dados pessoais". A pessoa edita os seus em `/perfil`; a ficha `/pessoas/[id]` segue exibindo tudo pra leitura.
- **`pref_genero_par` ficou editável** — decisão explícita: é dado de **pareamento**, não de apresentação. Saiu da etapa removida "Motivação e pareamento" e vive na "Ficha de mentor" (`pessoa-actions.tsx:257-260`), junto de capacidade/disponibilidade. Continua `profiles`, não `mentor_profiles`.
- **`parcial: true` nas três montadoras** de `updatePessoa`: `camposApresentacao`, `camposFicha` (já era) e `camposMentor` — `tem(k) = !parcial || formData.has(k)` faz chave ausente no FormData nem entrar no patch/upsert. É o que garante que remover campos do dialog não os zere no banco (o teste trava isso).
- **`MentoradoActions` não perdeu os autodeclarados**: interesses/objetivos/motivação/origem do jovem são **anamnese da coordenação** (o jovem não edita ficha própria em `/perfil`) — `updateMentorado` segue não-parcial. Ganhou `saveAnywhere` + nav de etapas por tabela (`mentorado-actions.tsx:401-405`).
- **`saveAnywhere`** (`WizardFicha`, `campos-pessoais.tsx`): o Salvar fica montado em todas as etapas (variant `outline` antes da última, `default` na última). Edição é patch — cada save leva o form inteiro porque nada desmonta.
- **Validação de save cobre TODAS as etapas** (`todasEtapasValidas`), não só a visível: o botão leva `formNoValidate` e a checagem é manual — achar inválido escondido navega até a etapa dele e só então `reportValidity()` (`invalidoPendente` + o fluxo de foco). Sem isso um `required` escondido bloqueava o submit calado.
- **Barras de etapa clicáveis** (`pularPara`): pra trás livre; pra frente exige a etapa atual válida — o que faltar no meio o save cobra na validação inteira. Alvo fino visual (`h-1.5`) com área de toque dobrada (`py-1 -my-1`), `aria-label`/`title`/`aria-current` por etapa.
- **Fix do auto-skip da etapa da foto**: Avançar e Salvar são dois elementos **sempre montados**, `hidden` alterna — o botão não muda mais de `type` no mesmo clique. Enter/submit implícito antes do último passo avança; o clique no Salvar (marcado com `data-salvar`) grava de qualquer etapa.
- Copy do dialog: "Os dados do cadastro em etapas. Salve de qualquer uma." (era "salve no fim") — nos dois dialogs.

## Schema

Nenhuma. Só código (componentes + action + teste).

## Domínio (`src/lib/`)

- `actions.ts` — `updatePessoa`:
  - `camposApresentacao(formData, { areasKey: "areas_perfil", parcial: true })` — bio/linkedin/areas_perfil/voluntariado ausentes não viram `null` no patch (`actions.ts:1266`).
  - `camposFicha(formData, { de: "pessoa", parcial: true })` — inclui `dados_civis` via `civis_` (:1274).
  - `camposMentor(formData, { parcial: true })` — `experiencia_previa`/`formacao_externa` ausentes não entram no upsert de `mentor_profiles` (:1277).
  - `camposCivis` removida por inteiro (~46 linhas) — o merge `...civis` saiu do patch.
  - Upsert de `mentor_profiles` continua gated por `formData.has("capacidade" | "capacidade_esp")` — fetch do `mp` falho não zera nada (:1358).
- `camposApresentacao` (`actions.ts:183-242`) e `camposMentor` (:507-534) ganham `opts.parcial` — já era o contrato de `camposFicha` (:370-375).

## UI

- `pessoa-actions.tsx`: 8–9 passos → **4–5** (Identificação e contato · Dados pessoais · Ficha de mentor condicional · Documentos (termo de adesão) · Arquivos e consentimento). `CampoInteresses`, `TagInput`, `Textarea` dos removidos e os contadores bioLen/volLen saíram; `CampoPrefGenero` realocado pra "Ficha de mentor".
- `mentorado-actions.tsx`: mesma quantidade de passos (sem remoção de campos), só `saveAnywhere` + copy.
- `campos-pessoais.tsx` `WizardFicha`: prop `saveAnywhere`, `primeiroInvalido`/`todasEtapasValidas`, `pularPara`, rodapé com Avançar+Salvar montados (`hidden`), Salvar com `formNoValidate` + `data-salvar`, barras de etapa como `<button>`.

## Seed + demo

Nada — demo nem toca a action (`updatePessoa` retorna `DEMO_MSG`).

## Testes

- `tests/update-pessoa.test.ts` (**novo**, vitest, 279 linhas) — cobre:
  - `dados_civis` gravado só do bloco `civis_` (com `deFicha` juntando nome/nascimento/cidade/UF da ficha);
  - prefixo morto `civ_` presente no FormData **não** sobrescreve nem produz `dados_civis` (réplica exata do bug: FormData com os dois blocos);
  - só `civ_` (client velho) → patch sem a chave `dados_civis`;
  - patch parcial: bio/linkedin/areas/voluntariado/interesses/motivacao/cargo/empresa/origem/pref_genero_par/dados_civis ausentes não entram no patch;
  - upsert de mentor sem `experiencia_previa`/`formacao_externa` quando ausentes; `pref_genero_par` e `voluntario` seguem graváveis.
- Sem spec e2e nova — navegação por barras/save-anywhere coberta por inspeção + suite existente.

## Critérios de aceite

- [ ] Cada campo civil tem **uma única fonte** no dialog: só `civis_` na etapa "Documentos (termo de adesão)" — nenhum input `civ_*` é renderizado (grep em `pessoa-actions.tsx`).
- [ ] Editar RG/CPF/endereço na etapa de documentos **persiste** o valor novo em `profiles.dados_civis` (e não é sobrescrito por bloco irmão).
- [ ] `updatePessoa` não monta mais merge `camposCivis` — `dados_civis` só sai de `camposFicha`/`parseCivis`.
- [ ] `dados_civis.nome_civil` acompanha o `nome` editado e `endereco.cidade/uf` os campos da ficha (modo `deFicha`).
- [ ] FormData só com `civ_*` (client antigo) **não** escreve `dados_civis` — chave ausente preserva o jsonb.
- [ ] Salvar é permitido **antes do último passo** (`saveAnywhere`) e valida o **form inteiro**: required inválido em etapa escondida navega até ela e reporta lá.
- [ ] Nenhum campo é anulado por chave ausente: bio, linkedin, areas, voluntariado, interesses, motivacao, cargo, empresa, origem, pref_genero_par, dados_civis, experiencia_previa, formacao_externa não entram no patch/upsert quando o form não os manda (vitest trava).
- [ ] `pref_genero_par` continua editável pela coordenação — agora na etapa "Ficha de mentor".
- [ ] Barras de etapa navegam: voltar livre, avançar exige etapa atual válida.
- [ ] O último "Avançar" não submete mais — a etapa de arquivos/consentimento (foto) não é pulada (botões sempre montados, `hidden` alterna).
- [ ] `MentoradoActions` ganhou save-anywhere **sem** perder os campos de anamnese.
- [ ] `npx vitest run tests/update-pessoa.test.ts` verde; `npx tsc --noEmit` e `npx eslint src/` limpos.

## Fora de escopo

- Edição dos autodeclarados pela própria pessoa (`/perfil`) — já existia e não mudou.
- `updateMentorado` parcial — o form do jovem manda tudo; não precisa.
- Validar/mascarar novos formatos de RG/CPF — validação existente mantida verbatim.
- Recorte de campos do dialog de **criação** (`createPessoa`) — não tocado.

## Notas de review (gaps conhecidos)

- ⚠ gap: `dados_civis = null` quando o bloco `civis_` vem todo vazio — é a semântica escolhida (limpeza intencional, campos pré-preenchidos), mas um fetch de `pessoa` velho + save cego apagaria o jsonb. Baixo risco (o dialog sempre monta com defaults do servidor).
- ⚠ gap: sem e2e cobrindo save-anywhere/nav de etapas/auto-skip da foto — hoje só vitest cobre a action; a parte de UI é inspeção manual.
