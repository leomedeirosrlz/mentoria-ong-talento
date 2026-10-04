# Mapeamento dos Google Forms reais → schema da plataforma

Extraído em 02/out/2026 via Google Workspace MCP (conta `thiago@realiza.vc`, read-only)
+ Forms API v1 direta (o MCP omite as tools de forms em `--read-only` por bug de
decorator de scope — todas as tools de forms pedem `forms.body` cheio).

## Inventário do Drive visível pra `thiago@realiza.vc`

| Arquivo | Tipo | ID | Nota |
|---|---|---|---|
| Modelo Mentores: dados para o matching (respostas) | Sheet | `1mK8A5iNarkbHoDN0qW7CG6WYh-hyZ6QYZLOTWjdcHDo` | 127×45 — ~126 mentores |
| Modelo Mentorados: dados para o matching (respostas) | Sheet | `1Ohby646gWbsaGKDy_dXVc4X_u73sYz6BwRa1nqnrS-k` | 134×17 úteis + pivot |
| Cadastro de Voluntários(as) - Brasil Participativo (respostas) | Sheet | `1ujNPXYmUUfgZAw2ygF_-koVPn2hbdngp6BaA7fUg_Gw` | 23 colunas — **contém dados bancários** |
| Avaliação semanal das Mentorias | **Form** | `1Rj0BZCAjYX2hJhfumtrN9tDxLGsxRFbizghuRacS_4w` | lido via Forms API (abaixo) |
| Novos sistemas Realiza.vc | Doc | `1WrYv-dQFnIw8RkiNTQr2JLVq87sgHuHbTSLCHiNnDyM` | ata já analisada |
| Base Comparativa - Programas de Mentoria | xlsx | `1-jFQUlZi8FRsPi3I7JHiutP3ESqq3Zdt` | referência |

**Dono real dos forms:** `thixaraujo@gmail.com` (Last-Edited-By em tudo). A conta da
org só enxerga as planilhas de resposta — os 2 forms linkados pelo Thiago não
aparecem na busca dessa conta. Os links `/d/e/1FAIpQL…` são responder-URLs
(opacas); pra ler via API preciso do **ID interno** (o da URL `/forms/d/<id>/edit`)
**e** do form compartilhado com `thiago@realiza.vc`.

## Form 1 — "Avaliação de Encontro Semanal - Mentores" (estrutura completa)

responderUri: `…/1FAIpQLSfuLVWUEi7EyhzYIRkcLgEqN7XVdastGOUGhvqc9E_hM7slkA/…`
Descrição pede preenchimento **ao final de cada encontro**. 10 itens:

| # | Pergunta | Tipo | Req | → plataforma |
|---|----------|------|-----|--------------|
| 0 | Nome | texto | sim | `profiles.nome` (resolve dupla) |
| 1 | Nome do Mentorando | texto | sim | `dupla` lookup |
| 2 | Qual encontro/semana | dropdown 1º–16º | sim | `encontros.numero` |
| 3 | Data do encontro | date c/ ano | sim | `encontros.data` |
| 4 | O que foi realizado | texto | sim | `registros.atividades` |
| 5 | Avaliação desempenho/participação | radio Excelente/Boa/Regular/Baixa | sim | `registros.avaliacao` |
| 6 | Dificuldade que precisa atenção | radio Não/aprendizagem/participação/comportamental/organização/Outro | sim | `registros.dificuldade` |
| 7 | Próximo passo | radio continuar/reforçar/feedback/acompanhar+perto/conversar/Outro | sim | `registros.proximo_passo` |
| 8 | Observações do mentor | parágrafo | não | `registros.observacoes`? |
| 9 | Documento/foto de importância | **fileUpload** max 1 × 10MB → pasta Drive `1b5r1lak…` | não | `registro_anexos` |

**Confirma que `registros` replica fielmente este form** — a engine atual já é a
versão nativa dele. O upload hoje vai pro Drive (folderId dedicado); na plataforma
vai pro bucket `registro-anexos`.

## Form 2 — "Matching de Mentores" (estrutura completa, verbatim do Thiago)

Intro menciona fluxo atual: **"preencheremos o termo de voluntariado e enviaremos
um pedido de assinatura para o seu email, via plataforma Signdoc"** → a plataforma
já substitui o Signdoc (termos + assinatura nativos). 5 seções:

**Dados pessoais**
- Nome completo civil* (texto), Nome social (texto), Data de nascimento* (date)
- Gênero* (radio): Cisgênero feminino / Cisgênero masculino / Transgênero /
  Não binário / Prefiro não informar
- Cor/raça* (radio): Negra / Branca / Amarela / Parda / Indígena / Outro:
- Estado/município de residência* (texto — não estruturado UF+cidade)

**Trajetória pessoal e profissional** — todos parágrafos obrigatórios:
- Hobbies* (hint "Até 3 hobbies"), Esportes* (assistir/praticar), Inspirações*
  (hint "Até 3 valores"), Valores* (hint "Até 3 valores"), Principais realizações*
  (hint "Pessoais ou profissionais"), Auto-descrição em parágrafo*,
  "Como esposa/marido/companheiro(a) lhe descreveria?"*

**Trabalho e emprego**
- Cargo*, Empresa/instituição*, Currículo* (upload 1 arquivo, 10MB), LinkedIn (opcional)

**Dados de contato:** E-mail*, Telefone*

**A mentoria**
- Formação Erlich Mentoring* (Sim/Não), Experiência prévia como mentor* (Sim/Não)
- "Caso possua experiência prévia, descreva-a" (texto opcional — **condicional à
  resposta anterior**)
- Objetivos/expectativa* (parágrafo)
- Preferência de gênero do mentorado*: Mentorado homem / Mentorada mulher /
  Sem preferência
- Foto de perfil* (upload 1 arquivo, 10MB)
- **Disponibilidade**: checkbox-grid, colunas Seg–Sex (**sem sábado/domingo**),
  linhas 09h→20h (11 faixas). O conteúdo renderizado repete as 11 linhas duas
  vezes — provável que o form tenha 2 grids idênticos (verificar no form real;
  pode ser artefato de cópia ou grid "semana 1/semana 2")

**Comprovantes**
- Anexo do RG ou CNH* (upload, 10MB), Comprovante de residência* (upload, 10MB)

## Form 3 — "Matching de Mentorados" (estrutura completa, verbatim)

Mesmas 3 primeiras seções do form de mentores (dados pessoais idênticos),
depois simplifica:

**Trajetória** — hobbies*, "coisas que mais gosta"*, esportes*, auto-descrição*,
"como amigos/família descreveriam"* — todos parágrafo obrigatório.
**Sem** inspirações/valores/realizações/cargo/empresa/LinkedIn (perfil mais
leve que o do mentor).

**Dados de contato:** E-mail*, Telefone*

**A mentoria**
- Objetivos* (parágrafo)
- Preferência de gênero do mentor*: Mentor homem / Mentor mulher / Sem preferência
- Currículo* (upload 1 arquivo, 10MB)
- **Sem grid de disponibilidade, sem foto, sem RG/comprovante** — menor fricção
  pro público jovem (e disponibilidade do mentorado entra por outro canal)

## Form 4 — "Cadastro de Voluntários - Brasil Participativo" (23 campos)

Programa **diferente** (Brasil Participativo ≠ mentoria). Campos: CPF, nome civil,
nome social, RG/órgão/UF, **nome da mãe**, **renda familiar**, nascimento, sexo,
escolaridade, estado civil, autodeclaração, e-mail, celular/WhatsApp, fixo,
**banco/agência/conta**, CEP, logradouro, número, complemento, bairro.

→ Modelo de `dados_civis` jsonb coord-only já cobre RG/CPF/endereço; **bancário é
sensível demais** (remuneração de voluntário, não mentoria) — não importar pro
app sem decisão expressa.

## Implicações pro schema/forms engine

**Tipos hoje (8):** `texto`, `texto_longo`, `select`, `multi_select`,
`escala_1_5`, `data`, `checkbox`, `sim_nao`.

**Cobertura dos forms reais:**

| Preciso nos forms oficiais | Status na engine |
|---|---|
| texto curto, parágrafo, data, radio→select, Sim/Não | ✅ já tem |
| radio com opção **"Outro:" de texto livre** | ⚠️ select não tem outro-livre — gap pequeno |
| **file upload** (CV, foto, RG, comprovante — 1 arq, 10MB) | ❌ falta tipo `arquivo` + storage |
| **checkbox-grid hora×dia** (11 faixas 09–20h × Seg–Sex) | ❌ falta tipo `grid_disponibilidade` |
| **seção/page-break** ("Dados pessoais", "A mentoria"…) | ❌ falta tipo `secao` ou agrupamento |
| **campo condicional** (descreva experiência ← se "Sim") | ❌ falta `visible_if` |

4. **Unicidade de pessoa por e-mail:** os forms não têm lookup — o par se resolve
   por nome digitado (frágil). Na plataforma o link já é por dupla/pessoa →
   melhor que o form original.
5. **Validações que o form não tem:** nascimento DD/MM/AAAA livre, telefone
   livre, CEP livre ("05541100" vs "05541-100") → normalizar na entrada
   (ViaCEP já planejado ajuda no endereço).
6. **Estado/município é texto livre** — respostas como "Espanha, Andalucía,
   Huelva" e "CEARÁ/FORTALEZA" → estruturar UF+cidade normaliza matching/geo.
7. **Disponibilidade Seg–Sex 09h–20h** — o grid oficial só cobre dias úteis;
   replicar esse range (não inventar sábado/dom).
8. **Signdoc é o fluxo atual de assinatura** — a plataforma já substitui
   (termos versionados + assinatura eletrônica nativa); no import, o intake
   novo já dispara `termo-voluntario` interno, não Signdoc.
9. **Respostas:** planilhas são o espelho completo do intake; o form semanal
   tem 20 respostas lidas via API (`list_form_responses` funciona com a
   credencial — só o wrapper MCP que esconde a tool).

## Pendente do usuário

- [x] Estrutura dos 2 forms de matching — recebida verbatim acima
- [ ] Confirmar se o grid de disponibilidade aparece 2× no form real (as 11
      linhas se repetem no texto renderizado) ou se é artefato da cópia
- [ ] Confirmar se existem outros forms (360º, anamnese, avaliação do encontro
      pelo mentorado) no Drive de outra conta — se sim, compartilhar com
      `thiago@realiza.vc` ou mandar conteúdo verbatim como fez aqui
