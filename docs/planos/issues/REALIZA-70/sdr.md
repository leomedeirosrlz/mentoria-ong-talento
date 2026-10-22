# REALIZA-70 — sdr.md (intake público — o mais sensível do cluster)

## Superfície de ataque

| Vetor | Risco | Mitigação |
|---|---|---|
| Link público multi-uso | spam/abuse ilimitado | honeypot existente + caps na RPC (500 total, 50/dia) + desativar link é operação coord |
| Uploads de estranhos | malware/dados de terceiros | allowlist 36 (pdf/img, ≤10MB), bucket privado, definer valida token — ver sdr do 36 |
| Enumeração de respostas | dados de candidatos vazam | respostas continuam coord-only via RLS; `/f/[token]` lê o FORM, nunca respostas alheias |
| Rate-limit por IP indisponível | definer não vê IP | cap por link + `formulario_links.expira_em`/desativação manual |
| RG/comprovante/CV = dados sensíveis | LGPD — menor ou não | LGPD §abaixo |

## RLS

- `formulario_respostas`/`formulario_anexos`: coord-only (inalterado).
- `formulario_links` multi_uso: mesmo select coord; `formulario_por_token`
  é a única leitura pública (devolve form, não dados).
- `promovido_profile_id`: dentro da row coord-only — sem grant extra.

## LGPD / dados sensíveis (pesado neste issue)

- O intake pede **cor/raça, gênero, RG, comprovante de residência, foto,
  CV** — dados sensíveis por natureza. Mitigações:
  - Copy de privacidade do form **reforçada** no card de título pro
        intake: "Seus dados são lidos pela equipe do Realiza.vc e usados
        só pro processo de seleção do programa." (override por sistema).
  - Promoção move dados civis pro destino canônico (`dados_civis` jsonb
    coord-only / `documentos_pessoa`) — a resposta não vira cópia
    paralela solta; promovido → `promovido_profile_id` marca a ponte.
  - Retenção: respostas de candidatos não-selecionados = dados
    pessoais parados → **decisão documentada**: coord pode apagar a
    resposta (delete cascata apaga anexos — já desenhado no 36). Sem
    TTL automático (decisão consciente, opera humana).
- Menores: mentorados podem preencher o 69 — mesmas proteções.

## Auditoria

- `promoverRespostaIntake` marca `promovido_profile_id` + `created_at`
  do profile = trilha "resposta → cadastro".
- `formulario_anexos` já dá "quem subiu o quê".

## Retenção

- Sem auto-expurgo; delete manual coord com cascata (link→resposta→
  anexos→bucket).
