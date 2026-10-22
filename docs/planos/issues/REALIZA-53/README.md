# REALIZA-53 — DECISÃO: acervo do Drive — mover pro Shared Drive org ou compartilhar item a item

- **Jira:** [REALIZA-53](https://kelyng.atlassian.net/browse/REALIZA-53) (Tarefa, prioridade **Medium**; migrada do Linear REALIZA-28)
- **Tier:** C — decisão (`decisao.md`)
- **Veredito de status:** **ABERTO.** A conta `thiago@realiza.vc` enxerga só 6 arquivos no Drive (`docs/planos/forms-google-mapeamento.md:7-22`); o dono real de quase tudo é `thixaraujo@gmail.com` (pessoal) e o form semanal é de `fernanda@realiza.vc`. **Zero Shared Drives** existem hoje. O MCP `gworkspace` (read-only, `~/.config/devin/mcp_config.json`) lê o que estiver compartilhado — hoje quase nada.

## Escopo (o que a decisão precisa cobrir)

- Destino canônico do acervo: Shared Drive org (6 TB nonprofit, decisão da ata) × compartilhamento item a item.
- Pré-requisito da REALIZA-65: offload de arquivos frios pro Drive pressupõe um Drive da org existente — sem Shared Drive não há nem onde pousar.
- Estrutura mínima de pastas e gestores (quem administra o Shared Drive).
- Migração: arquivos em gmail pessoal não "movem" — donos precisam arrastar pra dentro do Shared Drive (transferência de ownership).
- Leitura por API: Shared Drive resolve o acesso via `thiago@realiza.vc` + futura service account (offload/IA).

## Dependências / bloqueios

- **Desbloqueia:** REALIZA-65 (offload frios), leitura via API dos forms/documentos restantes (`forms-google-mapeamento.md` pendências), futura integração Drive da app.
- **Depende de:** admin do Workspace nonprofit (criar Shared Drive é ação de admin/gestor) — Thiago ou Léo.
- Relacionada: REALIZA-180 (pipeline de importação lê fontes do Drive), REALIZA-178 (relatórios/IA sobre acervo).

## Esforço estimado

- **PP** — decisão + criação do Shared Drive (ação admin) + checklist de migração pelos donos. Trabalho operacional, não de código.

## Riscos

- Manter status quo = acervo da org refém de conta Gmail pessoal (`thixaraujo@gmail.com`) — sai a pessoa, some o acesso/ownership.
- Migração manual depende da colaboração de cada dono (não há "force move" de fora); mitigar com checklist + janela combinada.
- Shared Drive mistura público-interno e sensível sem cuidado — pastas com restrição de membro resolvem (intake histórico com RG/CPF não é pra org inteira).
