# REALIZA-16 — Critérios de aceite

1. **Auditoria limpa** — rodar `scripts/auditoria-identidade-mentorado.mjs`
   no staging: exit 0 e relatório com `órfãos=0` em todas as tabelas da
   matriz (respostas, instrumentos, avaliações, assinaturas, anexos, intake).

2. **Constraint ativa** (plano A) — dado um POST/action tentando criar
   `formulario_links` com `dest_profile_id=null AND dest_mentorado_id=null
   AND dupla_id=null` → o banco rejeita com violation
   `formulario_links_tem_ancora` e a action devolve `{error}` amigável.

3. **Emissão nominada segue funcionando** — coord emite link pra dupla/dest
   normalmente; jovem responde em `/f/[token]`; resposta aparece na ficha.

4. **Vínculo retroativo (plano B, se adotado)** — dada resposta órfã legada,
   coord abre "Vincular", escolhe mentorado → resposta passa a aparecer na
   jornada/ficha dele; log/interação registra autor e timestamp.

5. **Histórico migra com a conta** — mentorado sem login acumula respostas;
   coord vincula `profile_id` no cadastro; ao logar, `/jovem/materiais`
   mostra as estações `feito` com as respostas anteriores — sem re-coleta.

6. **Regressão de schema** — `npx tsc --noEmit` + `pnpm test` limpos; teste
   `identidade-ancora.test.ts` falha se alguém remover `dest_mentorado_id`,
   `dupla_id` ou `mentorado_id` das tabelas da matriz.

7. **Schema-contract CI** — migration aplicada no remoto antes do merge;
   `check-schema-contract.mjs` verde.

8. **Caso de borda: dupla encerrada** — resposta de dupla encerrada continua
   resolvendo pro mentorado (âncora não depende de `duplas.status`).

9. **Caso de borda: link genérico legado** — se existirem órfãos históricos,
   o relatório os lista e a migration não explode (constraint adicionada só
   após saneamento, ou `not valid` + validate posterior — decisão na
   implementação conforme volume).
