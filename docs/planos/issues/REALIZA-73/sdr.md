# REALIZA-73 — sdr.md

## Escopo e vazamento

- O contexto de turma é **filtro de apresentação sobre dados já autorizados pela RLS** — não alarga nem restringe segurança. A RLS continua sendo a fronteira (coord vê tudo mesmo em contexto T2; o filtro é conveniência).
- **Auxiliar (32)**: seletor mostra só turmas do `escopo_turma` dele — nunca lista turmas que a RLS já esconderia (mesmo vazio, um nome de turma pode ser metadado sensível mínimo — minimização).
- **Cookie `turma_foco`**: valor = label/id de turma — não é credencial nem dado pessoal; `path=/`, `SameSite=Lax`, sem `Secure` extra além do padrão do site. Não gravar dados do usuário no cookie além do identificador de turma.
- **`?turma=` em URL compartilhada**: pode vazar "existe turma T3" pra quem recebe o link — mitigação natural: quem recebe link interno já é staff autenticado; rótulo de turma é metadado interno de baixa sensibilidade.
- Rotas públicas (`/f/`, `/t/`, `/resumo/`): **não** leem `turma_foco` — contexto é conceito de staff logado.

## Auditoria

- Nenhuma escrita associada (cookie é client-side conveniência) — sem trilha necessária.

## Menores

- Sem exposição nova: todas as superfícies já eram acessíveis ao papel; o filtro só esconde linhas.
