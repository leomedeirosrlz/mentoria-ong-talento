/** Lockup "Mentor e Mentorado" — a ordem fixa mentor→mentorado é a chave
 *  não-cromática; o dot amarelo no mentorado é redundância (PV-2), o mesmo
 *  marcador dos labels de parear. O pai controla peso, tamanho e truncate.
 *  Spec §1. */
export function DuplaNomes({
  mentor,
  mentorado,
  onDark,
  truncar,
}: {
  mentor: string;
  mentorado: string;
  /** sobre --brand-ink: o "e" afunda em muted-foreground, então white/50 */
  onDark?: boolean;
  /** opt-in pra pais flex de largura limitada (lista/cards): cada nome corta
   *  com "…" próprio em vez do lockup clipar no meio do glifo */
  truncar?: boolean;
}) {
  return (
    <>
      <span className={truncar ? "min-w-0 truncate" : undefined}>{mentor}</span>{" "}
      {/* o lockup "e • mentorado" é uma caixa só: o conector nunca quebra
          órfão no início de linha e, com truncar, corta junto ao nome */}
      <span
        className={
          truncar
            ? "inline-flex min-w-0 items-center gap-1.5"
            : "inline-flex items-center gap-1.5"
        }
      >
        {/* "e" é conector, não nome: meio-tom do contexto — muted-foreground no
            claro; sobre --brand-ink ele afundaria (~2.9:1), então white/50,
            a mesma meia-tinta que o banner já usa no overline/meta */}
        <span
          className={
            onDark ? "font-normal text-white/50" : "font-normal text-muted-foreground"
          }
        >
          e
        </span>
        <span
          aria-hidden
          className="size-1.5 shrink-0 rounded-full bg-[var(--role-mentorado)]"
        />
        <span className={truncar ? "min-w-0 truncate" : undefined}>{mentorado}</span>
      </span>
    </>
  );
}
