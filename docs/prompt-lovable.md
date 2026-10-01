# Prompt pro Lovable — identidade visual Realiza.vc

> Cola isso no começo do prompt dela (ou como instruction/design style, se o
> projeto já existir). Descreve só a estética — aplica a qualquer app que ela
> montar.

---

Use esta identidade visual em tudo que gerar — é o design system do
Realiza.vc. Idioma da interface: **português brasileiro**.

## Logo

- Wordmark: `logo-realiza.png` (1920×262, PNG com fundo transparente).
- Uso: altura 20px na topbar, 24px na sidebar, 32px na tela de login. Nunca
  esticar; sempre o arquivo original sobre fundo claro.
- Banner de marca (e-mails, capas): `vamos-juntos.png` — arte horizontal com
  a ilustração do instituto; usar inteira, sem cortar.
- Os dois arquivos estão em `public/` no repositório — suba eles como assets
  no projeto do Lovable.

## Paleta

```css
:root {
  --background: hsl(75 10% 95%);        /* "papel" quente da família do lime */
  --card:       hsl(0 0% 100%);         /* cartões são branco puro */
  --foreground: hsl(0 0% 15%);          /* tinta quase-preta */
  --muted-foreground: hsl(75 4% 40%);
  --border:     hsl(75 6% 87%);

  --primary:    hsl(78 56% 53%);        /* lima da marca */
  --primary-foreground: hsl(0 0% 12%);  /* NUNCA branco sobre a lima */
  --secondary:  hsl(0 0% 15%);          /* botão secundário = tinta */

  /* status */
  --ok:     hsl(78 58% 38%);   /* lima escura */
  --warn:   hsl(43 95% 44%);   /* âmbar */
  --danger: hsl(0 80% 48%);    /* vermelho */

  --radius: 0.75rem;  /* 12px */
}
```

## Tipografia

**Mitr** (Google Fonts, pesos 400/500/600/700) em tudo. **JetBrains Mono**
só pra números de dashboard e dados técnicos (IDs, logs, datas de log).

Escala real usada no app:

| Uso | Tailwind | Px | Peso |
|-----|----------|-----|------|
| Título de página | `text-2xl font-semibold tracking-tight` | 24 | 600 |
| Nome de pessoa / título de card | `text-base font-semibold` | 16 | 600 |
| Corpo e labels de form | `text-sm` | 14 | 400/500 |
| Meta (data, autor, contexto) | `text-xs` | 12 | 400 |
| Etiqueta de seção | `text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground` | 11 | 700 |
| Número de KPI | `font-mono text-xl font-semibold tabular-nums` | 20 | 600 (mono) |

## Componentes — copiar o padrão

**Cartão** (a superfície base de tudo — branco sobre papel, "sombra-como-borda"):

```tsx
<div className="rounded-xl bg-card p-4 shadow-[var(--shadow-border)]">
```

```css
--shadow-border:
  0 0 0 1px hsl(0 0% 0% / 0.06),
  0 1px 2px -1px hsl(0 0% 0% / 0.06),
  0 4px 8px -2px hsl(0 0% 0% / 0.05);
```

**Botão primário** (lima, texto quase-preto, altura 32–36px):

```tsx
<button className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50">
  Salvar
</button>
```

**Etiqueta de seção** (padrão em TODAS as seções):

```tsx
<h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
  Combinados
</h2>
```

**Chip/badge de status** (semáforo — dot colorido + texto):

```tsx
<span className="inline-flex items-center gap-1.5 text-xs">
  <span className="size-2 rounded-full bg-[var(--warn)]" />
  Atenção
</span>
```

**Campo de formulário:** input com `rounded-lg border bg-background px-3 py-2
text-sm`, label em `text-sm font-medium` acima, descrição de ajuda em
`text-xs text-muted-foreground` abaixo.

**Estado vazio:** ícone suave dentro de círculo `bg-muted` + frase que explica
o que aparece ali — nunca a palavra "vazio" sozinha.

## Movimento

Entrada de listas com stagger de 35ms (`translateY(4px)` + fade, 180ms),
easing `cubic-bezier(0.2,0,0,1)` — rápido, sem overshoot. Respeita
`prefers-reduced-motion`. Loading = skeleton com shimmer ou spinner —
nada de clique sem feedback: todo submit mostra spinner e desabilita.

## Template de e-mail

E-mails do sistema saem numa casca única: card branco de 600px sobre fundo
`#f5f5f6`, banner da marca no topo e no rodapé, CTA em pill lima. Só tabelas
+ CSS inline (o que Gmail/Outlook respeitam).

```css
/* hex pra e-mail (cliente de e-mail não lê CSS var) */
INK        #323232   LIME        #a0c644   LIME_CLARO  #b8d85f
LIME_ESCURO #7fa02e  /* eyebrow 11px — o lime puro não lê nesse tamanho */
FUNDO      #f5f5f6   MUTED       #9a9aa3   BORDA       #ececef
```

```html
<table width="600" style="background:#fff;border-radius:16px;overflow:hidden;
      box-shadow:0 1px 3px rgba(0,0,0,.06);">
  <tr><td><img src=".../vamos-juntos.png" width="600" alt="Realiza.vc"></td></tr>
  <tr><td style="padding:32px;font:15px/1.55 'Mitr','Segoe UI',sans-serif;color:#323232;">
    <p style="font-size:11px;font-weight:700;text-transform:uppercase;
              letter-spacing:1.6px;color:#7fa02e;margin:0 0 6px;">EYEBROW</p>
    <h1 style="font-size:22px;line-height:1.35;font-weight:600;margin:0 0 16px;">
      Título do e-mail</h1>
    <!-- parágrafos 15px, margin-bottom 14px -->
    <a href="..." style="display:inline-block;background:linear-gradient(90deg,#a0c644,#b8d85f);
       color:#fff;font-weight:600;padding:14px 28px;border-radius:999px;
       font-size:15px;text-decoration:none;">Chamada</a>
  </td></tr>
  <tr><td style="padding:0 32px 16px;font-size:14px;">— Equipe Realiza.vc</td></tr>
</table>
```

Repare: no e-mail o CTA usa texto **branco** sobre o gradiente lima (contraste
de e-mail é outra história); no app, texto sobre lima é sempre quase-preto.

## O que evitar

- Gradientes roxos/azuis de template SaaS (o único gradiente permitido é o
  lima→lima-claro do CTA de e-mail)
- Emoji em botões/títulos; sombra difusa pesada; hero section de marketing —
  é app de operação, denso e sóbrio
