# Plano — mural do perfil: foto linkada, publicação automática, hint de visibilidade

Pedidos: (1) avatar também linka pro `/pessoas/[id]` onde o nome já linka;
(2) tirar o botão "Publicar nota" — publicação automática; (3) declarar no
composer quem vê a nota; (4) o hint tem que ser verdadeiro por papel.

## 0. Estado atual (mapa com refs)

- **Mural:** `src/components/pessoa-mural.tsx` — composer `<form>` + botão,
  feed com avatar+nome do autor, delete inline (autor ou coord). Actions:
  `addPessoaNota`/`deletePessoaNota` em `src/lib/actions.ts` (já fazem
  `revalidatePath("/pessoas/[id]")`).
- **RLS:** `supabase/migrations/0016_pessoas_perfil.sql` — select: staff
  (coord+supervisor) lê tudo; mentor lê o mural de mentorado com quem tem/tinha
  dupla. Insert = mesmo escopo. Delete = autor ou coordenação.
- **Quem anota:** `pessoas/[id]/page.tsx` — `podeAnotar` = staff sempre;
  mentor só em `tipo === "mentorado"` da própria dupla.
- **Links hoje (nome linka / avatar não):**
  - `pessoas-listas.tsx` (profiles e mentorados) — Avatar solto ao lado do
    `<Link>` do nome. Meta (email/whatsapp) é texto puro, sem controle aninhado
    — pode entrar no link.
  - `duplas/[id]/page.tsx` — card "Mentorado" linka o nome e **não tem avatar**
    no card; h1 com par de avatares sobrepostos + `DuplaNomes`, sem link.
  - `pessoa-mural.tsx` — avatar+nome do autor da nota, sem link.
- **Já linkado certo (precedente):** `app-shell.tsx` — sidebar envolve
  avatar+nome+meta num único `<Link href="/perfil">`; mobile: avatar dentro de
  link com `aria-label`.
- **Sem padrão de unsaved-changes no repo.** O único rascunho é o localStorage
  do `registro-form.tsx` (draft por encontro + banner de restore). Não se
  aplica aqui: com publicação no blur, sair da página já publica — não sobra
  rascunho a proteger.

## 1. Decisões

### 1.1 Link no avatar — um `<Link>` só englobando avatar + nome + meta

**Recomendado: link único**, não link duplo. Dois links pro mesmo destino =
tabstop duplo e anúncio duplicado em leitor de tela; `tabIndex={-1}` +
`aria-hidden` no segundo funciona, mas é remendo — o link único é o padrão que
a casa já usa (sidebar do app-shell, `duplas-lista.tsx`, rows da agenda e das
duplas no perfil). Bônus: alvo de toque maior.

- `aria-label={`Abrir perfil de ${p.nome}`}` no link — sem ele o nome
  acessível vira "Nome email +55…" (o Avatar já é `aria-hidden`, inócuo).
- Nome vira `<span>`/`p` com `group-hover:underline`; o link tem
  `focus-visible:ring-2` no bloco.
- Meta (email/whatsapp/ONG) entra no link: é texto não-interativo, e clique
  nela navegar é coerente. Trade-off aceito: seleção de texto ali fica menos
  ergonômica.
- Fallback se quiser diff mínimo: `<Link tabIndex={-1} aria-hidden>` só no
  Avatar, nome intacto. Documentado, não recomendado.

**Outros pontos:**
- `duplas/[id]` card "Mentorado": adicionar `<Avatar size={32} papel="mentorado">`
  dentro do link existente do nome — paridade com as rows de `/pessoas`.
- `duplas/[id]` h1: **manter sem link** — par sobreposto de 28px seriam dois
  alvos minúsculos colados com destinos diferentes dentro de um heading; a
  navegação já existe no card do aside.
- Feed do mural: **não linkar autor** — mentor veria link pra perfil de staff
  que dá `notFound()`. Link condicional só-staff é possível mas inconsistente
  por papel; pular na v1.

### 1.2 Publicação automática — Enter + blur; Shift+Enter quebra linha; Esc limpa

**Recomendado: publicar no blur e no Enter.**

- **Por que não debounce autosave:** `NotaEncontro` edita **um** documento
  (upsert na mesma row). O mural é feed de **posts atômicos** — `addPessoaNota`
  só insere, não existe update. Debounce de 800ms publicaria fragmentos no
  meio da digitação num mural que outras pessoas leem. Rejeitado por modelo.
- **Por que não Cmd+Enter:** indescobrível pra essa audiência e inexistente
  no mobile.
- **Enter envia** é a convenção do WhatsApp/Slack — e essa base de usuários
  vive no wa.me. `Shift+Enter` quebra linha (`whitespace-pre-wrap`). No mobile,
  `enterKeyHint="send"` rotula a tecla de retorno como "enviar".
- **Blur publica** o que estiver escrito — é o "automático" pedido: clicar
  fora, trocar de aba ou navegar commit a nota. O risco (meio-pensamento ir
  pro mural) é mitigado por: nota atômica e barata de apagar ("apagar" já
  existe inline), `Esc` limpa o rascunho antes de sair, e o hint declara o
  comportamento.
- **Estados:** `pending` via `useTransition`; caption `aria-live="polite"`
  mostra "Publicando…"; erro → `toast.error` e **texto fica no campo**.
  Sucesso: limpar só se o campo ainda contém o que foi enviado —
  `setTexto(cur => cur.trim() === enviado ? "" : cur)` preserva o que a pessoa
  digitou durante o voo da action.
- **Sem rascunho/guard:** sair da página = blur = publica. O caso "mudei de
  ideia" é Esc antes de sair ou "apagar" depois de publicado.

### 1.3 Visibilidade — a frase do usuário hoje é falsa; decisão fica com ele

**Fato:** "apenas quem escreve vê" não é verdade hoje. No mural de um
mentorado, a nota é lida por coordenação, **qualquer** supervisor e **todos**
os mentores que já tiveram dupla com ele (inclusive a coordenação escreve e o
mentor lê). No mural de um staff, só coord+supervisor leem. O mentorado nunca
vê nada — não tem conta.

**Opções mapeadas:**
- **(a) Copy only — recomendado.** Declarar a visibilidade real. O mural existe
  pra coordenação acompanhar a mentoria; nota do mentor sobre o mentorado é
  exatamente o que a coordenação quer ler. Zero migration, zero risco.
- **(b) Privada do autor.** `pessoa_notas_select` vira
  `created_by = my_profile_id()`. Custo real: coordenação e supervisão perdem
  a leitura das observações do mentor (quebra a função de monitoria — o mural
  vira caderneta privada); mentor remanejado não vê histórico do mentor
  anterior; a delete-policy da coordenação fica inócua. Reversível, mas muda o
  produto.
- **(c) Meio-termo: autor + staff.** `created_by = my_profile_id() or
  my_role() in ('coordenacao','supervisor')` — nota do mentor continua chegando
  à equipe (monitoria preservada), mas mentor deixa de ler notas de outros
  mentores **e da coordenação** sobre o próprio mentorado.

**Copy proposta (opção a), por papel:**
- mentor no mural de mentorado: "Quem vê: você, a equipe e outros mentores de
  {primeiroNome}."
- staff no mural de mentorado: "Quem vê: a equipe e os mentores de
  {primeiroNome}."
- staff no mural de profile: "Quem vê: só a equipe (coordenação e supervisão)."
- (se b): "Só você vê esta nota." em todos.
- (se c): mentor → "Quem vê: você e a equipe (coordenação e supervisão).";
  staff → "Quem vê: só a equipe."

## 2. Mudanças por arquivo

1. **`src/components/pessoas-listas.tsx`** — o bloco `div.flex-1` vira
   `<Link className="group …" aria-label>` englobando avatar+nome+meta; nome
   com `group-hover:underline`; badges e actions continuam irmãos fora do link.
2. **`src/app/(app)/duplas/[id]/page.tsx`** — card "Mentorado": Avatar 32
   `papel="mentorado"` dentro do link do nome (reestrutura o `<p>` em row flex).
3. **`src/components/pessoa-mural.tsx`** — composer sem `<form>`/`<Button>`:
   `Textarea` com `onKeyDown` (Enter→publica, Shift+Enter passa, Esc→limpa),
   `onBlur`→publica se `texto.trim()` e `!pending`, `enterKeyHint="send"`,
   `aria-describedby` pro hint. Hint `text-xs text-muted-foreground`:
   "{visibilidade} · Enter ou sair do campo publica · Shift+Enter pula linha".
   Nova prop `ehStaff` pra copy por papel. Remover import de `Button`.
4. **`src/app/(app)/pessoas/[id]/page.tsx`** — passar `ehStaff` ao `PessoaMural`.
5. **Só se (b) ou (c):** `supabase/migrations/0017_*.sql` — `drop policy
   pessoa_notas_select` + policy nova; revisar copy do hint, do empty state e a
   delete-policy.

## 3. Ordem

1. Item 1 (links) — independente, sem backend.
2. Items 2+3a+4 juntos no `pessoa-mural.tsx` + prop na page — assumindo copy
   only como default.
3. Pergunta de alinhamento antes de qualquer migration; 0017 só se escolher
   (b)/(c).

## 4. Riscos e edge cases

- Blur publica meio-pensamento → Esc/apagar/hint declarativo; nota é barata de
  remover.
- Enter enviar onde se esperava quebra de linha → convenção de chat +
  Shift+Enter no hint + `enterKeyHint="send"`.
- Race: digitar durante o publish → `setTexto` funcional comparando com o
  texto enviado.
- Link englobando meta → `aria-label` mantém anúncio limpo; sem aninhamento de
  interativos.
- `router.refresh()` + `revalidatePath` já coexistem na action — manter.
- Sob (b)/(c): visibilidade muda na hora pra notas existentes (sem perda de
  dado; reversível revertendo a policy); empty state precisa de copy nova.

## 5. Verificação

- `npx tsc --noEmit` · `npx eslint src/`
- Manual por papel: hint correto; Enter/Shift+Enter/blur/Esc no composer;
  avatar clicável em /pessoas com 1 tabstop por pessoa; `enterKeyHint` no
  mobile; leitor de tela anuncia "Abrir perfil de …" uma vez.
- Se migration: testar RLS por role no remoto (MCP supabase).
