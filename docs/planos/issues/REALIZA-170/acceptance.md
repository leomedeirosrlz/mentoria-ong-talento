# REALIZA-170 — critérios de aceite

## Público — gate de senha

1. Dado um link `relatorio_links` ativo com senha, quando GET anônimo em
   `/resumo/<slug>`, então renderiza `ResumoSenhaForm` (nenhum dado da grade
   no HTML — grep no body por nome de mentorado não casa).
2. Dada senha errada (1ª–4ª), então `{ok:false}` genérico e form mostra
   "Senha incorreta. Confira o link e a senha recebidos." — indistinguível de
   "slug existe mas senha errada"; `resumo_acessos` ganha row `ok=false,
   motivo='senha'`.
3. Dadas 5 falhas em 15min do mesmo IP, então a 6ª retorna
   `{ok:false, motivo:'limite'}` **antes de verificar a senha** (funciona até
   com senha certa) e a UI mostra "Aguarde ~N minutos". `pg_advisory` prova:
   5 requests paralelos no mesmo slug → no máximo 5 rows de falha, nunca 6 ok.
4. Dada senha certa, então cookie `resumo_<slug>` httpOnly/Secure/Path= é
   gravado e o reload renderiza a grade; segunda visita não pede senha.
5. Dado cookie válido e a senha redefinida depois, então o acesso seguinte
   falha (`senha`) e cai de volta no form — a hash antiga morreu.
6. Dado link revogado (`revogado_em` setado), então a página mostra
   "Este resumo não está mais disponível" — mesmo com cookie válido (cada
   render re-verifica na RPC).
7. Dado link `expira_em` no passado, idem 6 com motivo `expirado` no log.
8. Dado slug inexistente, então 404 puro e **nenhuma** row em
   `resumo_acessos`.

## Link legado / seed

9. Dado o seed `t2-x7k4m9qf2w8j` (`senha_hash=null`), então `/resumo/t2-x7…`
   renderiza direto sem senha — o link em circulação não quebra no deploy.
10. Dado a coord clicando "Definir senha" nele, então `senha_hash` passa a
    existir e visitas novas pedem senha; a UI tira o badge "Sem senha".

## Conteúdo / minimização

11. Dado `config.tipo='grade'` sem `expor_contato`, então o payload da RPC não
    contém `email`/`whatsapp`/`data_nascimento`/`dados_civis`/`form_bruto` —
    verificável no JSON da RPC (não só na página).
12. Dado `expor_contato=true`, então `email`/`whatsapp` chegam e renderizam;
    `dados_civis`/`form_bruto` continuam fora (allowlist nunca os lista).
13. Dado `config.tipo='ciclo'`, então as linhas trazem encontros+registros
    sem `tema`/`reflexoes`/`observacoes`/`precisa_apoio`; `atividades` só com
    valores do catálogo `ATIVIDADES_ENCONTRO` (texto livre do "outro" filtrado).
14. Dado `config.tipo='assinaturas'`, então as linhas têm
    nome/documento/versão/status/datas — sem `cpf`/`rg`/`ip`/`token`/
    `dados_snapshot`/`url_pdf`/`hash_documento`.
15. Dado `config.tipo='respostas'` forjado direto na tabela, então
    `abrir_relatorio` rejeita (`motivo:'config'`) — o CHECK/validação de tipo
    barra mesmo com insert manual coord-side. (CHECK em `relatorio_links`? —
    decisão do PR: validação na RPC de criação é suficiente se só ela escreve;
    registrar motivo no log.)
16. Dado qualquer config, então `resumo_acessos` registra `ok=true` com
    `link_id` preenchido e `params` refletindo o que foi salvo (não a query
    da URL — a URL pública não carrega config).

## Gestão coord

17. Dado coord no `/relatorios` clicando "Publicar este recorte como link"
    com o builder num recorte X, então o dialog abre com chips resumindo X
    e, ao confirmar, mostra `https://…/resumo/<slug>` + senha uma única vez.
18. Dado mentor/supervisor acessando `/relatorios`, então 404/redirect (a
    página já é coord-only — não muda).
19. Dado `criar_relatorio_link` chamado por papel não-coord via REST, então
    `{erro:'sem_permissao'}` — a RPC gateia internamente com `has_papel`.
20. Dado `revogar_relatorio_link`, então idempotente (2× → ok) e o acesso
    público morre na hora (teste 6).
21. Dado `redefinir_senha_relatorio_link`, então retorna nova senha em claro
    **uma vez** e a anterior falha (teste 5).
22. Em modo demo: o card lista links canned e as ações retornam
    `DEMO_MSG` sem escrever.

## Rate limit extra

23. Dado 50 falhas no mesmo slug em 24h vindas de IPs distintos, então a
    51ª (de IP novo) responde `limite` — régua global por slug (sdr R1).
24. Dado `resumo_acessos` indisponível, então `abrir_relatorio` **falha
    fechado**? — decisão: a RPC faz o count dentro de try; se o count falhar
    por erro de schema (não por ausência de rows), o acesso continua e o
    erro vai pro Sentry (não derruba o público por causa do log — mesma
    filosofia da 183, mas a falha deixa `ok` não registrado → trade-off
    documentado no sdd).

## Gates

25. `npx tsc --noEmit` + `npx eslint src/` limpos; `database.types.ts` regen.
26. `schema-contract` CI verde → migration aplicada em prod antes do merge.
27. E2E `tests/e2e/app/resumo-publico.spec.ts` [NOVO] cobre: criar link →
    abrir anônimo → senha errada → certa → revogar → card "não disponível".
28. Validador REST `_valida_0107_rest.mjs`: anon executa as 2 RPCs públicas,
    não toca as tabelas; coord executa as de gestão; mentor recebe
    `sem_permissao`.
