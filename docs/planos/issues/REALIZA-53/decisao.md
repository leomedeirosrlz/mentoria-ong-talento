# REALIZA-53 — Decisão: acervo do Drive — Shared Drive org × item a item

## Contexto

Mapeamento de 02/out/2026 (`docs/planos/forms-google-mapeamento.md`): a conta
`thiago@realiza.vc` enxerga **6 arquivos** (3 Sheets de resposta, 1 Form, 1
Doc de ata, 1 xlsx). O ownership real está fora da org: quase tudo é de
`thixaraujo@gmail.com` (Last-Edited-By em tudo), e o form "Avaliação semanal"
é de `fernanda@realiza.vc`. Existem **zero Shared Drives** na conta hoje.

O acesso por API existe mas é cego: MCP `gworkspace`
(`~/.config/devin/mcp_config.json`, `uvx workspace-mcp --tools drive forms
sheets --read-only --single-user`, OAuth read-only) só lê o que está
compartilhado com `thiago@realiza.vc`. Os 4 Google Forms oficiais já foram
lidos assim (`forms-google-mapeamento.md`), mas os links `/d/e/1FAIpQL…`
restantes são responder-URLs opacas — pra ler via API preciso do ID interno
**e** do form compartilhado.

A ata decidiu a direção: Shared Drive nonprofit (6 TB) como acervo da org —
esta issue é formalizar **e executar** essa decisão. Ela também é
pré-requisito da REALIZA-65 (offload de arquivos frios precisa de um Drive da
org como destino) e destrava leitura/API dos documentos restantes (360º,
anamnese antiga, avaliação do encontro pelo mentorado — pendências do
mapeamento).

## Opções

### A — Shared Drive org "Realiza.vc" (recomendada)

Criar o Shared Drive no Workspace nonprofit, definir gestores (Thiago + Léo
no mínimo) e estrutura mínima de pastas, e migrar o acervo canônico —
guias/termos/cronogramas/relatórios oficiais — pra dentro dele. Donos de
arquivos em contas pessoais arrastam os arquivos pra dentro (o que transfere
ownership pra org).

Estrutura inicial sugerida (enxuta, cresce sob demanda):

| Pasta | Conteúdo | Acesso |
|---|---|---|
| `01-Programa` | guias oficiais, metodologia, cronogramas PDF, base comparativa | org inteira |
| `02-Turmas` | por turma: cronograma, pareamento, atas | equipe |
| `03-Intake-histórico` | exports de forms/Sheets antigos (RG, comprovantes) | **restrito** (coord + Thiago) |
| `04-Acervo-materiais` | instrumentos oficiais, worksheets (fonte do bucket `materiais`) | org inteira |
| `99-Arquivo-morto` | destino dos frios da REALIZA-65 | restrito |

- **Prós:** org é dona — arquivo não morre com a conta pessoal de ninguém;
  visível pra API/service account de imediato (MCP já lê Shared Drive);
  permissionamento por pasta resolve o "sensível × programa"; pré-requisito
  da 65 e do futuro offload da app; alinha com a ata.
- **Contras:** exige ação de admin do Workspace pra criar; migração manual
  depende de cada dono arrastar (não existe move administrativo de fora pra
  dentro de gmail pessoal); mudança de hábito — quem continuar criando no
  "Meu Drive" pessoal recria o problema (mitigação: regra simples "documento
  de programa nasce no Shared Drive").

### B — Compartilhar item a item (status quo formalizado)

Cada dono compartilha os forms/docs restantes individualmente com
`thiago@realiza.vc`.

- **Prós:** zero estrutura nova; resolve o caso pontual de hoje (ler os
  forms restantes).
- **Contras:** não resolve nada estrutural — org continua sem acervo;
  ownership continua em conta pessoal; cada documento novo repete o ciclo;
  API continua cega pra tudo que ninguém lembrou de compartilhar; **não
  habilita a 65** (offload precisa de destino da org, não de share solto).

### C — Híbrido (A + exceção item-a-item)

Shared Drive como canônico + tolerar compartilhamento avulso pra material
transitório/de terceiros que não merece pasta (um doc que alguém manda uma
vez).

- É a realidade de qualquer implementação de A — registrar pra não vender a
  ilusão de "tudo centralizado no dia 1".

## Recomendação

**A.** É a única opção que resolve o problema real (acervo da org refém de
conta pessoal) e destrava a 65. O custo é administrativo, não técnico: criar
o Shared Drive, nomear gestores, e rodar um checklist de migração com os
donos (`thixaraujo@gmail.com` é o maior — combinar uma sessão única de
arrasto). Na prática vira C organicamente.

Passos sugeridos (operacionais, sem código):

1. Admin do Workspace cria o Shared Drive `Realiza.vc`; gestores: Thiago +
   Léo; coord como membro.
2. Criar a estrutura mínima de pastas (acima).
3. Checklist de migração por dono — prioridade: guias oficiais, termos,
   cronogramas T1/T2, planilhas de resposta, forms restantes.
4. `thiago@realiza.vc` (e depois a service account da 65) entra como membro
   — MCP passa a enxergar tudo.
5. Regra de ouro nova: documento de programa nasce no Shared Drive.

## Decisão que falta o Thiago assinar

**Criar o Shared Drive `Realiza.vc` no Workspace nonprofit (ação de admin)
com Thiago + Léo como gestores, adotá-lo como acervo canônico da org e rodar
a migração dos documentos de programa via checklist com os donos atuais —
confirma?**
