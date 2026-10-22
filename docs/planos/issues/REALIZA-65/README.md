# REALIZA-65 — DECISÃO: offload de arquivos frios pro Google Drive 6TB

- **Jira:** [REALIZA-65](https://kelyng.atlassian.net/browse/REALIZA-65) (Tarefa, prioridade **Medium**; migrada do Linear REALIZA-38)
- **Tier:** C — decisão (`decisao.md`)
- **Veredito de status:** **ABERTO, direção já decidida.** A ata fechou a regra "frios → Drive nonprofit 6 TB, processáveis → Supabase" (`docs/analise-transcricao-mentor.md:111,174`; decisão 13 em `docs/planos/_contexto.md:97`). O que falta decidir: **quando ativar** (o Shared Drive nem existe — depende da 53) e **o que migra vs. fica**.

## Escopo (o que a decisão precisa cobrir)

- Gatilho de ativação: agora × threshold de uso do 1 GB free × evento (editor de PDF / fim de ciclo).
- Classificação quente × frio dos buckets atuais: `avatares` (público), `materiais`, `registro-anexos`, `documentos`, `chamado-anexos` (+ `atividades` futuro, REALIZA-55).
- Uso real atual do storage — **a verificar** no dashboard Supabase (não há métrica no repo; o plano do editor estima ~0,6 GB só de atividades: `docs/planos/editor-pdf.md:219`).
- Como a integração funciona quando ativar: service account no Shared Drive + metadados no banco + download via proxy da app (Drive não tem signed URL pública; a app media tudo — mesma fronteira de hoje).
- O ponto de troca já existe: toda leitura passa por rotas `/api/*` com row de metadados (`/api/material/[id]`, `/api/anexo/[id]`, `/api/chamado-anexo/[id]`, `/api/documento/[id]` — `ops-mapa.md` §8) — o backend de storage é trocável sem reescrever consumidores.

## Dependências / bloqueios

- **Depende de:** REALIZA-53 (Shared Drive da org precisa existir como destino).
- **Pressão vem de:** REALIZA-55/20 (editor de PDF — o maior consumidor novo de storage), T2 com ~30 duplas ativas.
- Relacionada: REALIZA-178 (se relatórios oficiais forem arquivados em vez de gerados sob demanda — `relatorios-inteligencia.md:178`).

## Esforço estimado

- **PP** — a decisão em si + medição do uso atual.
- **M–G** — quando a integração real for implementada (service account, proxy de download, script de migração com rollback, testes) — fica pra follow-up/issue de implementação.

## Riscos

- Estourar o 1 GB free no meio do ciclo com T1+T2 ativas — mitigar medindo o uso real **agora** (a verificar).
- Arquivar manualmente cedo demais = arquivos fora do alcance da app (links quebram na ficha) — por isso a recomendação é esperar gatilho.
- `documentos` é coord-only: mover pra Drive não muda a fronteira de segurança (a app já media todo acesso via signed URL), mas registra outro subprocessador com PII — cruzar com a REALIZA-33.

> DECIDIDO (Thiago): offload quando storage >~70% do 1GB; depende da 53.
