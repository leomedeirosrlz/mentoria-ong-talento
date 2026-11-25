# REALIZA-295 — MCP por papel: emissão de PAT e matriz de tools

Issue: `ia`,`mcp`. Fonte: plano `ia-chatbot-mcp.md` §6 ("expandir papel por papel") + fase 4 da sequência. Status: a fazer.

## O que exige vs. o que existe

A issue foi escrita quando o MCP era coord-only. **O gate de handshake já está expandido** — verificado no staging:

- `PAPEIS_MCP` inclui os 5 papéis (`src/app/api/mcp/route.ts:35-41`): todo perfil com papel no programa conecta. 403 só pra `papeis` vazio (:109-114).
- `tools/list` já filtra por `roles` da tool (:137-146); `tools/call` re-confere antes do rate-limit (:170-178); `executarTool` aplica o gate uma terceira vez por papel efetivo (`tools.ts:1656-1661`, via `my_papeis`/`papeisForcados` — usuário híbrido usa a união dos papéis).
- Execução sempre sob JWT impersonado do dono do PAT (`route.ts:160`, `impersonar.ts`) — supervisor via MCP lê exatamente o que leria no chat. Sem caminho de priv-esc.
- Matriz `roles` por tool (`src/lib/ia/tools.ts`) — verificado linha a linha:

| Tool | roles | Cobre a issue? |
|---|---|---|
| `resumo_semana` | coord, supervisor (:304) | supervisor: semáforo ✓ |
| `ficha_dupla` | TODOS (:319) — jovem recebe versão sem semáforo via `jovem_duplas` (:323-363) | jovem: própria dupla ✓ |
| `registros_da_dupla` | coord, sup, dpp, esp (:378) — campos estruturados only | supervisor/mentor: registros ✓ |
| `aguardando_par`, `capacidade_mentores` | coord (:408,:447) | — |
| `duplas_do_usuario` | coord, sup, dpp, esp (:480) — mentorado fora por desenho (sem grant em `duplas`; usa `minha_dupla`) | supervisor/mentor: suas duplas ✓ |
| `agenda_do_periodo`, `historico_encontros` | coord, sup, dpp, esp (:505,:536) | mentor: agenda ✓ |
| `guia_consulta`, `chamados_resumo`, `instrumentos_da_dupla` | TODOS (:618,:644,:702) | jovem: instrumentos ✓ |
| `pessoas_busca` | coord, supervisor (:683) | — |
| `minha_dupla`, `minha_agenda`, `meus_combinados`, `meu_progresso`, `meus_pedidos`, `ajuda_faq` | mentorado (:724-899) | jovem: encontros/progresso ✓ |
| `mural_especialista` | coord, sup, esp, dpp (:932) | — |
| escritas `escreve:true` (chamados, `jovem_*`, `desmarcar_encontro`, solicitações) | por papel (:993+) | envelope `pendente_confirmacao` obrigatório |

**O gap real que sobra**: ninguém fora da coordenação consegue **mintar** um PAT. A seção de tokens vive dentro de `AssistenteConfig`, cuja entrada é `papeis.includes("coordenacao") && !demo` (`assistente-bolha.tsx:649,656`). A RLS já permite — `ia_mcp_tokens_dono` (0149) deixa qualquer autenticado gerenciar só os próprios tokens — falta só a superfície de UI.

## Decisões

- **Emissão self-service, nunca coord-emite-pra-outro.** PAT é credencial pessoal: a policy `with check (profile_id = my_profile_id())` já impede insert pra terceiros, e um token "da coordenação emprestado ao mentor" executaria **como a coordenação** — priv-esc por desenho. Cada papel minta o próprio token. Alternativa descartada: RPC definer mintando pra outro profile — criaria justamente o caminho que o desenho fecha.
- **Extrair o bloco de PAT pra componente próprio** (`src/components/tokens-mcp.tsx`), montado em 3 superfícies:
  - `AssistenteConfig` — coord mantém onde já está (o componente substitui o bloco inline de `assistente-config.tsx:247-291`, sem cópia dupla);
  - `/perfil` — staff (supervisor, mentor_dpp, mentor_especialista): nova seção "Conectar IA externa" na página de perfil, gate `papeis.some(p => PAPEIS_MCP.includes(p)) && !coordenacao-somente`… na prática `papeis.length > 0` — todo mundo com papel;
  - `/jovem/perfil` — mentorado, mesma seção com copy adaptada (segunda pessoa jovem, sem jargão "MCP": "Conectar uma IA externa (Claude, ChatGPT…) à sua conta").
- **Mesmo geração, mesmas regras**: `rlz_mcp_` + 24 bytes → sha256 (reuso do fluxo de `assistente-config.tsx:95-105`), mostrado **uma vez**, `rotulo` obrigatório ("Claude desktop"), revogação lista→`revogado_em`, expiração 90d default do banco (0159). Nenhuma RPC nova — insert/delete direto sob RLS, como hoje.
- **Matriz de tools fica como está.** O recon linha a linha cobre a superfície pedida (supervisor: duplas supervisionadas + semáforo + registros; mentor: própria dupla + registros + agenda; jovem: próprios instrumentos + encontros). Único ajuste fino a reavaliar na implementação: `duplas_do_usuario` segue fora do mentorado por desenho (jovem não tem grant em `duplas`; `minha_dupla`/`ficha_dupla` cobrem o caso) — documentar, não "consertar".
- **Handshake claim**: `ia_mcp_autorizar` já devolve `papel` (primário) + `papeis` (efetivo, `profile_papeis`) — o híbrido recebe a união em `tools/list`/`tools/call`. Nada a mudar na RPC; o claim por papel efetivo é o comportamento desejado.
- **Sem flag de rollout por papel.** As escritas já são proteladas pelo envelope `pendente_confirmacao`; a leitura é RLS-bound. Um `PAPEIS_MCP` curto segue sendo a única chave de liga/desliga por papel no código — suficiente.

## Schema

**Nenhuma.** `ia_mcp_tokens` + RLS owner-only (0149), expiração + `user_id` no autorizar (0159) e matriz `roles` no registry já cobrem. Se a implementação decidir uma RPC `revogar_meu_token` pra esconder o delete direto, é sugar — não exigida.

## Domínio (src/lib/)

- `src/components/tokens-mcp.tsx` [NOVO] — extrai de `assistente-config.tsx` a geração (`crypto.getRandomValues` → `rlz_mcp_`+hex → `crypto.subtle.digest`), listagem, criação e revogação. Props: `rotuloPadrao` e `textos` (copy varia por superfície).
- `assistente-config.tsx` — passa a renderizar `TokensMcp` no lugar do bloco inline.
- `tools.ts` — nenhuma mudança de `roles` esperada; se o review decidir expor algo a mais pra supervisor (ex.: `pessoas_busca` já o inclui), a mudança é de uma linha + teste.

## UI

- `/perfil` (staff): card "Conectar IA externa" — explica em uma frase que o token dá acesso **com suas permissões**, campo de rótulo, botão "Gerar token", exibição única com copiar + aviso "guarde agora — não mostramos de novo", lista de tokens com rótulo/`criado_em`/`ultimo_uso_em`/`expira_em` e "Revogar". Copy pt-BR sem travessão; segue hierarquia de texto do AGENTS.md.
- `/jovem/perfil`: mesma seção, copy jovem — o que a IA externa pode fazer é exatamente o que ele mesmo faria no app.
- `assistente-config` (coord): sem mudança visual — só a extração do componente.

## Seed + demo

- Demo: seção escondida quando `demo` (sem sessão real — `ia_mcp_tokens` é autenticada); verificar que `demoRole` não renderiza o bloco.
- Fixtures e2e de PAT por papel ficam na spec REALIZA-297 (seed `ia_mcp_tokens` via service role) — não duplicar aqui.

## Testes

- **vitest** (`tests/`): componente gera token `rlz_mcp_` + 48 hex chars; hash gravado é sha256 do token cru; lista/refetch após revogar.
- **e2e** (`tests/e2e/app/`): staff não-coord vê "Conectar IA externa" em `/perfil`, gera token, revoga. (Os asserts de conexão por papel ficam na 297 — aqui basta a superfície de emissão.)
- Gate: coord não perde a seção na bolha; jovem vê em `/jovem/perfil`; demo não renderiza.

## Critérios de aceite

- [ ] Todo papel de `PAPEIS_MCP` tem superfície pra mintar o próprio PAT: coord na bolha (inalterado), staff em `/perfil`, mentorado em `/jovem/perfil`.
- [ ] Nenhum caminho permite criar token pra `profile_id` de outra pessoa (RLS + UI).
- [ ] Token gerado é mostrado uma única vez; banco guarda só sha256; revogação marca `revogado_em` e derruba o acesso no próximo `tools/call` (401).
- [ ] `tools/list` por papel devolve exatamente a união dos `roles` efetivos — verificado pra coord, supervisor, mentor_dpp, mentor_especialista, mentorado e híbrido (dpp+esp).
- [ ] `tools/call` de tool fora do papel responde erro "não está disponível pro seu papel" antes de executar — e jovem **não** acessa nenhuma tool de staff (`resumo_semana`, `registros_da_dupla`, `pessoas_busca`, `duplas_do_usuario`, `aguardando_par`).
- [ ] Execução continua `clientImpersonado` (RLS-bound) — nenhum caminho de tool roda com service role.
- [ ] Matriz documentada nesta spec bate com `tools.ts` linha a linha no review de implementação.
- [ ] Demo não renderiza a seção de tokens.

## Fora de escopo

- OAuth Supabase (`/auth/v1/oauth`) como Bearer alternativo — `a verificar` do sdd 179 §4; PAT cobre todos os papéis sem ele.
- Mudança na matriz de tools (novos recortes ou tools novas) — a matriz atual já cobre a superfície pedida; evoluções entram por issues próprias.
- Escopo por-recurso dentro do PAT ("token só-leitura", "token só pra guia_consulta") — PAT carrega o papel do dono, sem escopo granular.
- Cobertura e2e do transporte — é a REALIZA-297.
