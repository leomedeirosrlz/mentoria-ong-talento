# REALIZA-70 — design.md

## Persona & JTBD

- **Candidato a mentor** (link vindo do Instagram/WhatsApp do programa,
  celular, ~26 perguntas + 4 uploads): inscrição séria mas sem cadastro —
  cada etapa curta (o wizard do 144 ajuda: 5 seções = 5 etapas).
- **Coordenação**: "colar UM link na bio e receber inscrições na grade",
  depois promover quem passou pra `profiles`.

## Superfícies

### Público `/f/[token]` (link intake multi-uso)

- Mesma anatomia: card de título (faixa lime), um card por pergunta,
  pill de progresso. Seções viram wizard se 144 já entregue — senão
  scroll (funciona igual).
- Uploads: ver design do 36 — 4 campos arquivo (CV, foto, RG/CNH,
  comprovante). Copy específica: "Currículo", "Foto de perfil",
  "Anexo do RG ou CNH", "Comprovante de residência" — cada um com hint
  "PDF, PNG, JPG ou WebP até 10 MB".
- Sucesso: copy específica do intake — `"Inscrição recebida! Obrigado —
  a equipe do Realiza.vc analisa e entra em contato. Pode fechar esta
  página."` (override por `formularios.sistema`, não genérico).

### Ficha do form (coord)

- Seção "Link de inscrição": chip URL + Copiar/WhatsApp
  (`src/components/forms/copiar-link` existe) + "Desativar link".
- Respostas → grade (49): linha = candidato. Coluna "Promovido ✓" quando
  `promovido_profile_id`.
- Ação por linha da grade: "Cadastrar a partir da resposta" → abre
  `NovaPessoaDialog` com prefill → confirmação humana.

## Estados

- Link desativado: mesmo card "link inválido/expirado" do token comum
  (reuso total do estado).
- Rate-limit de intake: "Recebemos muitas inscrições hoje — tente amanhã
  ou fale com a coordenação." (copy honesta, raro).
- Empty grade: "Nenhuma inscrição ainda — divulgue o link."

## Microcopy pt-BR

- "Link de inscrição" · "Gerar link público" · "Desativar link" ·
  "Cadastrar a partir da resposta" · "Promovido" · "Inscrição recebida!"

## A11y & mobile

- Herda tudo de 36/144 (grade com roving tabindex, foco de etapa).
- 4 uploads no mobile: cada um abre picker/câmera — copy da foto
  distingue: "Foto de perfil — vale selfie".

## Reuso

`formulario-publico`, `InstrumentoFlow` NÃO (intake é genérico),
`forms/copiar-link`, `NovaPessoaDialog`, grade (49), tipos novos (36).
