# REALIZA-70 — Template nativo "Matching de Mentores" (intake)

[Jira REALIZA-70](https://realizavc.atlassian.net/browse/REALIZA-70)

**Status: ABERTO** — depende de REALIZA-36 (tipos novos). Formulário
oficial de inscrição de mentores como `sistema=true`, com link público de
intake (multi-resposta) e promoção da resposta pra cadastro.

## Fonte da verdade dos campos

`docs/planos/forms-google-mapeamento.md` §Form 2 (linhas 46–84) —
estrutura **verbatim** recebida do Thiago: ~26 campos em 5 seções:

- **Dados pessoais**: Nome civil*, Nome social, Nascimento* (data),
  Gênero* (radio 5 opções), Cor/raça* (radio 6 c/ **Outro:** livre),
  Estado/município* (texto livre — ver decisão).
- **Trajetória pessoal e profissional**: 7 parágrafos obrigatórios
  (hobbies, esportes, inspirações, valores, realizações, auto-descrição,
  "como esposa/marido/companheiro(a) descreveria").
- **Trabalho**: Cargo*, Empresa*, Currículo* (`arquivo` 10MB), LinkedIn
  (opcional).
- **Dados de contato**: E-mail*, Telefone*.
- **A mentoria**: Formação Erlich* (sim_nao), Experiência prévia*
  (sim_nao), "descreva experiência" (**visible_if** = Sim), Objetivos*
  (parágrafo), Preferência de gênero do mentorado* (3 opções), Foto*
  (`arquivo`), **Disponibilidade** (`grid_disponibilidade` Seg–Sex
  09h–20h).
- **Comprovantes**: RG/CNH* (`arquivo`), Comprovante de residência*
  (`arquivo`).

## O que precisa existir além do seed

- **Link de intake multi-resposta** [NOVO]: o `formulario_links` atual é
  uso único (`usado_em` + `formulario_respostas.link_id UNIQUE` em
  `0036:65`). Intake público = UMA URL, N respostas anônimas. Decisão no
  `sdd.md` (compartilhado com REALIZA-69).
- **Promoção resposta → profile**: resposta de intake não vira pessoa
  sozinha — coord lê a grade (REALIZA-49) e promove com prefill.
- **Consumo do matching**: a grade de disponibilidade da resposta vira
  `profiles.disponibilidade` ao promover → `AfinidadePar` funciona.
- Termo de voluntariado: o form original diz "enviaremos via Signdoc" —
  plataforma já tem termos nativos; disparo de `termo-voluntario` ao
  promover é **decisão registrada** (ver plan — não bloqueante).

## Dependências

- **REALIZA-36** (bloqueia): `arquivo`, `grid_disponibilidade`,
  `visible_if`, `permite_outro`.
- **REALIZA-49** (forte): grade de respostas é a leitura natural do
  intake.
- Par com **REALIZA-69** (mentorados — mesmo mecanismo de intake).
- `formularios_sistema_check` precisa aceitar o novo valor `sistema`.

## Esforço estimado: **G**

Seed verbatim (26 campos, cuidado LGPD em dados sensíveis), link
multi-uso + RPC, promoção, UI de gestão do link público, demo, e2e.

## Riscos

- **BLOCKER**: grid de disponibilidade aparece 2× no form real? —
  pendência aberta em `forms-google-mapeamento.md` §Pendente do usuário
  (provável artefato de cópia; se forem "semana 1/semana 2" precisa de 2
  campos grid ou convenção — confirmar com Thiago).
- Multi-uso = anônimos ilimitados → rate limit na RPC + honeypot já
  existente.
- Dados civis (RG) em `arquivo` solto vs. `dados_civis` jsonb — LGPD:
  minimizar; a promoção mapeia pro campo certo.
- `sistema=true` imutável: qualquer typo no seed exige migration
  corretiva — revisar verbatim com lupa.

## Documentos

`plan.md` · `sdd.md` (intake links — referência também pro 69) ·
`design.md` · `sdr.md` · `acceptance.md`.
