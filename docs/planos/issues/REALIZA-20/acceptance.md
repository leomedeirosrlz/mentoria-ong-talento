# REALIZA-20 — Critérios de aceite

## Rascunho server-side

1. Dado link vigente de instrumento, jovem digita metade e fecha → ao abrir
   **em outro browser/dispositivo** com o mesmo token, os campos vêm
   preenchidos do servidor e o banner "Continuando de onde você parou"
   aparece.
2. Autosave não perde digitação: digitar contínuo por 5s → nenhum save
   intermediário quebra o foco; `salvo_em` atualiza.
3. Offline: sem rede, o rascunho fica no localStorage e a UI não mostra erro
   intrusivo; ao voltar a rede + uma mudança, sincroniza.
4. Payload inválido (campo não declarado / tipo errado / acima do cap) → RPC
   rejeita; client não insiste (log silencioso).
5. Rascunho parcial **não** valida obrigatórios; submit com obrigatório
   vazio segue focando o primeiro inválido (comportamento atual).

## Status

6. `visto_em`: primeira abertura do `/f/[token]` seta; segunda abertura não
   muda o valor.
7. Ficha da dupla: link com rascunho server-side mostra "Em andamento";
   link nunca aberto mostra "Pendente"; enviado "Respondida".
8. Minha jornada: estação com rascunho server-side exibe "Em andamento"
   mesmo em aparelho onde o rascunho nunca foi digitado.

## Devolução

9. Mentor DPP devolve resposta da própria dupla com motivo → jovem reabre o
   link, vê respostas preenchidas + banner com o recado, re-submete → status
   volta 'enviada'.
10. Mentor de outra dupla tenta `devolver_resposta_formulario` → RPC nega.
11. Submit direto em resposta 'enviada' (sem devolução) → rejeitado como
    hoje ("já respondida").
12. `usado_em` nunca volta a null após envio; `jornada_autoemit` não
    reemite instrumento com resposta devolvida já re-enviada.

## Bordas

13. Token inválido/expirado/form inativo → estados existentes intactos
    (rascunho também rejeita).
14. Dupla encerrada (`status` fora de ativa/pausada): rascunho/submit de
    instrumento rejeitam igual ao submit atual — **a verificar** se a RPC de
    submit já checa status da dupla; se não, a devolução herda a mesma regra.
15. Resposta devolvida segue contando como "feita" na jornada até re-envio?
    Decisão: sim (houve entrega; revisão é qualidade) — estação mostra
    "devolvida p/ revisão", não "a fazer".
16. Concorrência: dois tabs salvando rascunho → último ganha, sem erro; um
    tab submete enquanto outro salva → submit vence (status trava).

## Infra

17. `npx tsc --noEmit` + `npx eslint src/` + `pnpm test` limpos;
    schema-contract verde com migration aplicada no remoto antes do merge.
18. Demo mode: fixture com instrumento `status='rascunho'` exibe "Em
    andamento" na ficha demo; spec e2e demo cobre.
19. REST: `salvar_rascunho_formulario` rejeita token malformado
    (`^[A-Za-z0-9_-]{20,128}$` — mesma `TOKEN_RE` de `page.tsx`).
