# REALIZA-69 — Template nativo "Matching de Mentorados" (intake)

[Jira REALIZA-69](https://realizavc.atlassian.net/browse/REALIZA-69)

**Status: ABERTO** — depende de REALIZA-36. Versão leve do intake (17
campos): dados pessoais, trajetória, contato, mentoria + CV. **Sem** grid
de disponibilidade, foto ou documentos (menor fricção pro público jovem —
a disponibilidade do mentorado entra por outro canal).

## Fonte dos campos

`docs/planos/forms-google-mapeamento.md` §Form 3 (linhas 86–103) —
verbatim:

- **Dados pessoais**: idênticos ao de mentores (nome civil*, nome social,
  nascimento*, gênero* radio, cor/raça* radio c/ Outro, estado/município*).
- **Trajetória**: hobbies*, "coisas que mais gosta"*, esportes*,
  auto-descrição*, "como amigos/família descreveriam"* — todos parágrafo
  obrigatório. Sem inspirações/valores/realizações/cargo/empresa/LinkedIn.
- **Contato**: E-mail*, Telefone*.
- **A mentoria**: Objetivos* (parágrafo), Preferência de gênero do
  mentor* (Mentor homem/Mentor mulher/Sem preferência), **Currículo***
  (`arquivo` 10MB).
- ~17 campos; usa `arquivo` + `permite_outro` do 36; sem `visible_if`,
  sem grid.

## Dependências

- **REALIZA-36** (bloqueia: `arquivo`, `permite_outro`).
- **REALIZA-70** (par — o mecanismo de link multi-uso `multi_uso` +
  `origem='intake'` + `submeter_resposta_formulario` multi é entregue
  na `0107` do 70; este issue = seed `0108` + promoção pra `mentorados`
  em vez de `profiles` mentor).
- **REALIZA-49**: grade de leitura (respostas de menores — ver sdr do 70).

## Esforço estimado: **P–M**

Seed verbatim + valor `intake_mentorado` no check + promoção pra
`mentorados` (não `profiles` — ver plan). Toda a mecânica vem do 70.

## Riscos

- **Mentorado frequentemente é menor** — intake pede menos dados
  (decisão acertada do form oficial); CV de menor pode ser doc escolar —
  LGPD segue o sdr do 70.
- Mentorado virando `mentorados` row: tabela distinta de `profiles` —
  promoção mapeia pras colunas dela (`a verificar` nomes — `whatsapp`
  pode nem existir em `mentorados`, contato pode ser do responsável).
- Menor sem e-mail próprio? Campo `email*` obrigatório no verbatim —
  manter (fidelidade) e deixar a fricção com o programa.

## Documentos

`plan.md` · `acceptance.md` · (sdd/design/sdr: **compartilhados com
REALIZA-70** — mecanismo idêntico).
