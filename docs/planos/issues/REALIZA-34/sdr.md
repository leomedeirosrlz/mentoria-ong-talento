# REALIZA-34 — sdr.md (segurança / IA / LGPD)

## Modelo de ameaça

- **Gravação cega de parse errado** (o risco central): mitigado por design — nada persiste antes de `criarCronograma` no submit humano; `validaEventos` + CHECKs da 0062 rejeitam datas/tipos inválidos.
- **Upload malicioso**: coord-only (rota protegida, action valida `my_role()='coordenacao'` — mesmo guarda de `/turmas/novo`); validar MIME+extensão+tamanho (~10MB) na action; bucket privado se usado, sem grant `anon`.
- **Arquivo com dado pessoal**: cronogramas oficiais são operacionais, mas um PDF pode conter nomes de coordenadores/ONGs — o que viaja pro Gemini é só o texto do cronograma; instrução do prompt ignora nomes. Documentar pra coordenação: "não suba listas de jovens aqui" (importação de pessoas é outro fluxo).
- **Gemini como subprocessador** (LGPD): conteúdo = datas/títulos de eventos — baixa sensibilidade, sem dados de menores/civis por construção (o schema `EventoRascunho` não tem campo pra isso). Provider autorizado por Thiago (registro no Jira). Se um dia o input incluir texto livre de pessoas → passa a exigir o parecer jurídico que já condiciona REALIZA-178/179/180 (`docs/planos/README.md` — a verificar linha).

## Rate limits / custo

- Upload interno baixo volume; ainda assim: 1 chamada Gemini por arquivo, timeout 30s, retry 1×, sem cache cross-usuário. Sem fila — `a verificar` se volume real pede.

## Auditoria / retenção

- Log de importação (`cronograma_importacoes` `[NOVO]` ou `ia_eventos` da 180): quem subiu, arquivo, parser, confiança, cronograma resultante — rastreia erro de parse até a origem.
- Arquivo original: reter no bucket enquanto o cronograma existir (evidência do que foi lido) — ou descartar após gravação; decisão menor, recomendado reter (storage barato, auditar divergências).
- Sem retenção de dados pessoais nova — o upload não cria `profiles`/`mentorados`.

## Falhas seguras

- Sem `GEMINI_API_KEY` → determinístico puro + aviso "normalização IA indisponível" (não trava a coordenação).
- Gemini retorna JSON inválido → cai no rascunho determinístico + aviso; nunca grava.
