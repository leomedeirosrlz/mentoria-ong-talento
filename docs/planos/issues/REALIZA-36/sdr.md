# REALIZA-36 — sdr.md (superfície pública & LGPD)

## Superfície de ataque

| Vetor | Risco | Mitigação |
|---|---|---|
| `form_anexo_put` com token forjado | upload não autorizado | RPC valida `formulario_links` **pendente e não expirado**; token é o bearer já existente do canal |
| Flood de uploads | storage 1GB estoura | cap 20 anexos/link na RPC + `max_mb` por campo + links expiráveis; sem cron — limpeza manual documentada |
| Binário malicioso no bucket | XSS/malware servido | allowlist MIME (pdf/png/jpg/webp — sem svg/heic), bucket privado, download só via `/api/form-anexo/[id]` signed URL coord-only; servir com `Content-Disposition: attachment` |
| Path traversal/injeção | objeto fora do prefixo | path gerado no servidor `form-anexos/<link_id>/<uuid>.<ext>` — o cliente nunca manda path; sanitizer exige prefixo do link |
| `visible_if` burlado client-side | resposta a pergunta oculta | servidor reavalia com `campo_visivel()` — valor oculto é dropado no sanitizer |
| Enumeração de tokens | acesso a forms alheios | já mitigado no modelo atual (token opaco, uso único, expiração) — nada muda |
| Formulário sistema editado | intake oficial adulterado | `formularios_sistema_guard` (já existe) barra update; builder desabilita edição |

## RLS

- `formulario_anexos`: `select` **só** `my_role()='coordenacao'`; nenhum
  insert/update/delete pra roles normais — escrita exclusiva via definer.
- Bucket `form-anexos`: policy apenas `service_role` (anon/authenticated
  não leem nem escrevem storage; leitura via route handler com join na
  tabela RLS).
- `formularios`/`links`/`respostas`: inalterado (coord-only; anon só RPC).

## Rate limits

- `form_anexo_put`: máx 20 anexos por `link_id` (erro pt-BR "Limite de
  anexos atingido").
- Sem novo rate-limit global: submit já é uso único por token.

## Auditoria

- `formulario_anexos.created_at` + `link_id` dão trilha "quem subiu o quê
  quando" por link (link já identifica destinatário/contexto).
- Leitura via `/api/form-anexo/[id]` segue o padrão dos demais handlers —
  logar `id` acessado no servidor (mesmo nível de auditoria de
  `/api/anexo/[id]`).

## Retenção & LGPD

- Anexo de candidato em intake **é dado pessoal possivelmente sensível**
  (CV, doc): `on delete cascade` do link — apagar resposta/link apaga
  metadado; objeto do bucket removido pela action de delete (mesmo padrão
  `deleteDupla`→bucket de anexos).
- Minimização: `arquivo` nunca obrigatório por default; builder deve
  orientar ("só peça documento se for exigido no processo").
- Dados de menores: mentorados respondem forms — arquivo/grid seguem a
  mesma visibilidade coord-only das respostas. Nada expõe ao público.
