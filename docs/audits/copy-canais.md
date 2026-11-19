# Auditoria de copy — canais

**Data:** nov/2026 · **Branch:** `fix/copy-canais` · **Método:** leitura de todo o texto exibido nas superfícies de canal — WhatsApp (`whatsapp-msgs`, `acao-lembrete`, `dupla-wa-acao`, `nudge-button`, `whatsapp-rapido`, `jovem-equipe-wa`, `api/nudge`), e-mail (`email-templates`, `email`, `actions-email`, `relatorios/digest`, `enviar-email-dialog`, `digest-config-card`, `digest-botao`), avisos e notificações (`avisos-section`, `novo-comunicado-dialog`, `notificacoes`), chamados (`novo-chamado-dialog`, `chamado-detalhe`, `chamados-shared`, `chamados-app`, `chamado-anexos`, `jovem-chamados`, `meus-chamados-card`, `jovem-pedir-ajuda`, `actions-chamados`, `queries-chamados`) e lembretes in-app (`lembrete-disponibilidade`, `marco-notifier`, `actions-lembrete`).

**Régua:** skills `antislop`, `antislop-copywriting` e `humanizer` + constituição A6 e `conventions-ui` (copy pt-BR, sem travessão em texto exibido inclusive em `src/lib`, sem jargão interno). Correções aplicadas só onde o problema é claro; nenhum comportamento, destinatário, canal ou fluxo mudou.

**Fora do raio de correção:** textos gravados por RPC/trigger em migration aplicada (A9 — ledger imutável; ex.: strings de evento de sistema dos chamados e notificações criadas no banco). Ficam registrados aqui quando afetam o canal, mas correção exigiria migration nova e sai do escopo de copy.

## Corrigidos

| arquivo:linha | texto atual | problema | proposta |
|---|---|---|---|
| `src/lib/actions-email.ts:405` | `sem e-mail do jovem nem do mentor — entregue à mão` | travessão em texto exibido (A6) | `sem e-mail do jovem nem do mentor: entregue à mão` |
| `src/lib/actions-email.ts:407` | `modo demonstração — nada é emitido nem enviado` | travessão em texto exibido | `modo demonstração: nada é emitido nem enviado` |
| `src/lib/relatorios/digest.ts:280` | `Digest semanal — {faixa}` | travessão no assunto do e-mail | `Digest semanal: {faixa}` (dois-pontos casa com os demais assuntos: `Chamado {n}: …`) |
| `src/lib/relatorios/digest.ts:286` | `Semana de {faixa} — o panorama do ciclo…` | travessão no corpo do e-mail | `Semana de {faixa}: o panorama do ciclo…` |
| `src/lib/relatorios/digest.ts:319` | `<b>{nome}</b> — {motivo}` | travessão no item de lista do e-mail | `<b>{nome}</b>: {motivo}` (mesmo molde do item de encontros, `:296`) |
| `src/components/jovem-equipe-wa.tsx:44` | `Escolha com quem conversar no WhatsApp — a mensagem já sai com a sua apresentação.` | travessão em texto exibido | `Escolha com quem conversar no WhatsApp. A mensagem já sai com a sua apresentação.` |
| `src/components/jovem-equipe-wa.tsx:90` | `A equipe ainda não tem WhatsApp cadastrado — registre sua dúvida…` | travessão em texto exibido | `A equipe ainda não tem WhatsApp cadastrado. Registre sua dúvida…` |
| `src/app/(app)/relatorios/operacionais/digest-botao.tsx:27` | `Enviado para {enviados} de {destinatarios} da coordenação.` | destinatários agora incluem supervisão, pessoas e e-mails extras (REALIZA-451) — "da coordenação" ficou impreciso | `Enviado para {enviados} de {destinatarios} destinatários.` |
| `src/app/(app)/relatorios/operacionais/digest-botao.tsx:28` | `Nenhum e-mail de coordenação cadastrado — nada enviado.` | travessão + mesma imprecisão de audiência | `Nenhum destinatário com e-mail cadastrado. Nada enviado.` |
| `src/components/lembrete-disponibilidade.tsx:21` | `Conta quando você pode` | imperativo de "tu" num app que fala em "você" (`Conte o motivo`, `Conte do seu jeito`) | `Conte quando você pode` (asserts e2e atualizados junto) |
| `src/components/dupla-wa-acao.tsx:220` | `Escolhe quem recebe e por onde a mensagem sai.` | mesmo imperativo de "tu"; staff lê "Escolha" em todo o resto (`Escolha quem vai cuidar`, `Escolha quem recebe o e-mail`) | `Escolha quem recebe e por onde a mensagem sai.` |
| `src/components/dupla-wa-acao.tsx:221` | `O mesmo texto pros dois canais: escolhe onde sai.` | idem | `O mesmo texto pros dois canais: escolha onde sai.` |
| `src/components/avisos-section.tsx:180` | `E-mail enviado para {enviados} de {total}: {falhas} falharam.` | pontuação diverge do toast idêntico do `enviar-email-dialog` (`de {total}. {falhas} falharam`) | `E-mail enviado para {enviados} de {total}. {falhas} falharam.` |
| `src/lib/email-templates.ts:185` | `Este aviso também está na plataforma, na aba inicial. Você pode conferir por lá a qualquer momento.` | segunda frase repete a primeira sem informação nova | `Este aviso também está na plataforma, na aba inicial.` |

## Registrados, sem correção

| arquivo:linha | texto atual | problema | proposta |
|---|---|---|---|
| `src/app/api/nudge/route.ts` | `Vale outro a partir de {data}.` | telegráfico demais para uma página de bloqueio; aceitável, mas limítrofe | `Você pode enviar outro a partir de {data}.` — não corrigido: página de borda, ganho marginal |
| `src/components/novo-comunicado-dialog.tsx` vs `src/components/avisos-section.tsx` | `Coordenação e auxiliares executivos` (label do select) vs `Equipe` (badge da lista) | dois nomes para a mesma audiência | alinhar o badge com o label (`Equipe do programa`?) — não corrigido: decisão de nome de produto, não de gramática |
| migrations `0084`+ (RPCs de chamado e triggers de notificação) | textos de evento/notificação com travessão gravados no banco (ex.: `Chamado resolvido — …`) | travessão em texto que reaparece na UI | corrigir em migration nova, fora do escopo desta auditoria (A9) |

## O que foi lido e está limpo

- **`whatsapp-msgs.ts` e `acao-lembrete.ts`** — o catálogo inteiro de mensagens: tom de conversa, concreto ("Rolou?", "Consegue preencher hoje?"), sem tell de IA, sem travessão. A distinção mentor (operacional) × mentorado (sem cobrança) está correta e foi preservada.
- **`email-templates.ts`** — instrumentos, repasse ao mentor, desfecho 6 meses, convite de acesso, urgência/atualização de chamado e confirmações de credencial: frases curtas, dados reais, CTAs específicos. Nenhum claim inflado.
- **`novo-chamado-dialog.tsx` / `chamado-detalhe.tsx` / `chamados-shared.tsx` / `chamado-anexos.tsx` / `jovem-chamados.tsx` / `meus-chamados-card.tsx`** — linguagem simples para o jovem ("Seu mentor não vê este pedido"), status com rótulo por audiência (staff vê "Sem dono", autor vê "Aguardando a equipe"), placeholders com exemplos reais.
- **`notificacoes.tsx`, `avisos-section.tsx`, `novo-comunicado-dialog.tsx`, `enviar-email-dialog.tsx`, `digest-config-card.tsx`, `marco-notifier.tsx`, `nudge-button.tsx`, `whatsapp-rapido.tsx`, `actions-lembrete.ts`, `actions-chamados.ts`** — sem achados: textos curtos, específicos, sem redundância nem travessão.
