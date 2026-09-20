/** Lockup "Mentor e Mentorado" — a ordem fixa mentor→mentorado é a chave
 *  não-cromática; o dot amarelo no mentorado é redundância (PV-2), o mesmo
 *  marcador dos labels de parear. O pai controla peso, tamanho e truncate.
 *  Spec §1. */
export function DuplaNomes({
  mentor,
  mentorado,
  onDark,
}: {
  mentor: string;
  mentorado: string;
  /** sobre --brand-ink: o "e" afunda em muted-foreground, então white/50 */
  onDark?: boolean;
}) {
  return (
    <>
      {mentor}{" "}
      {/* "e" é conector, não nome: meio-tom do contexto — muted-foreground no
          claro; sobre --brand-ink ele afundaria (~2.9:1), então white/50,
          a mesma meia-tinta que o banner já usa no overline/meta */}
      <span
        className={
          onDark ? "font-normal text-white/50" : "font-normal text-muted-foreground"
        }
      >
        e
      </span>{" "}
      <span className="inline-flex items-center gap-1.5">
        <span
          aria-hidden
          className="size-1.5 shrink-0 rounded-full bg-[var(--role-mentorado)]"
        />
        {mentorado}
      </span>
    </>
  );
}
