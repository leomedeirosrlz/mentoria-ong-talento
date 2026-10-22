# REALIZA-144 — sdr.md

## Superfície de ataque

- Wizard é **apresentação** do mesmo submit — a fronteira continua
  `submeter_resposta_formulario` + sanitizer. Nenhum endpoint novo.
- Único vetor novo: `visible_if`+wizard combinados podem tentar skip de
  obrigatória — coberto por "submit final valida todas as etapas" e pelo
  sanitizer server-side (independe do client).
- `beforeunload`: padrão do browser, sem dados novos.

## LGPD / menores

- Nenhuma persistência extra (sem rascunho remoto, sem localStorage —
  decisão explícita: refresh zera o form). Menor superfície de retenção
  que a alternativa.
- Respondentes públicos incluem menores — copy de privacidade já no card
  de título se mantém em todas as etapas (o pill fica, o card de título
  abre a jornada).

## Rate limit / auditoria

- Inalterado: link uso único + honeypot + cap 200KB de payload
  serializado.
