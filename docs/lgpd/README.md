# LGPD — documentos de conformidade do Programa de Mentoria

> Escopo aprovado pelo Thiago (**escopo B** da decisão — ver
> `docs/planos/issues/_decisoes.md` e `docs/planos/issues/REALIZA-33/decisao.md`):
> inventário formal de dados + base legal + política de retenção **escrita**,
> **sem** deleção/anonimização automática. O texto da autorização do
> responsável está **em revisão jurídica pessoal do Thiago** — não existe
> redação final.
>
> **Documento vivo.** Toda tabela/coluna nova que carregue dado pessoal entra
> no inventário na mesma PR que a cria (regra firmada na revisão de segurança
> de REALIZA-33). Quem escreve migration lê `inventario-dados.md` antes.

## Documentos

| Arquivo | Conteúdo | Estado |
|---|---|---|
| `inventario-dados.md` | Inventário de dados pessoais por tabela — titular, sensibilidade Art. 11, quem lê, base legal, retenção | Vigente (schema até migration `0111`) |
| `base-legal.md` | Mapeamento de bases legais (Art. 7/11/14) por finalidade; subprocessadores; cláusulas da autorização **em revisão jurídica** | Vigente, com pendências jurídicas marcadas |
| `politica-retencao.md` | Política de retenção por categoria — o que é decidido, o que é proposta, como executar manualmente | Vigente (execução manual — sem automação) |
| `lacunas-e-riscos.md` | Registro de lacunas/riscos da revisão com estado e dono | Vivo — atualizar a cada mudança de estado |

## Controlador e papéis

- **Controlador:** Instituto Realiza Você (Realiza.vc) — CNPJ 53.034.217/0001-89.
- **Encarregado (ponto de contato do titular):** coordenação do programa —
  canal público `mentoria@realiza.vc` (mesmo da página `/privacidade`).
- **Titulares:** mentorados (adolescentes/jovens — inclui menores de idade),
  mentores/supervisores/coordenação/especialistas (adultos), responsáveis
  legais dos mentorados, terceiros indicados (familiares/amigos — não
  consentiram) e visitantes dos links públicos.

## O que NÃO está neste escopo (follow-up)

- **Anonimização/expurgo automático** — escopo C, adiado para o primeiro
  encerramento de ciclo real (ver `politica-retencao.md` §6 e
  `REALIZA-33/decisao.md` opção C).
- **Endpoint "meus dados" do titular** — base técnica existe
  (`meus_dados_civis`, `meus_dados_pessoais`); produto não decidido.
- **DPAs formais com subprocessadores** — registro em `base-legal.md` §4.
- **Parecer jurídico** — restrito ao texto da autorização + política de
  retenção; continua como **gate fechado** para IA sobre texto livre de
  menores (REALIZA-178/179/180).
