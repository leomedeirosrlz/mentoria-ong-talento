import { cn } from "@/lib/utils";

/** Altura do <img> × font-size do wordmark de texto (os glifos do PNG
 *  ocupam ~88% da altura da imagem — o texto precisa de ~0,92× pra ler
 *  com o mesmo peso). */
const TAMANHO = {
  sm: { img: "h-5", texto: "text-[18px]" },
  md: { img: "h-6", texto: "text-[22px]" },
  lg: { img: "h-7", texto: "text-[26px]" },
  xl: { img: "h-8", texto: "text-[30px]" },
} as const;

/** Logo "REALIZA.VC" adaptável ao tema (REALIZA-192). Light: o PNG oficial.
 *  Dark: o "REALIZA" do PNG é tinta e some no fundo escuro — assume o
 *  wordmark em texto puro, a mesma construção do site-footer (REALIZA em
 *  foreground + ponto amarelo + VC lime). O `dark:` estrutural aqui é a
 *  única exceção da regra "dark nasce só dos tokens": é troca de arte,
 *  não de cor. */
export function Logo({
  size = "md",
  className,
}: {
  size?: keyof typeof TAMANHO;
  className?: string;
}) {
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logo-realiza.png"
        alt="Realiza.vc"
        width={1920}
        height={262}
        className={cn("w-auto dark:hidden", TAMANHO[size].img, className)}
      />
      {/* aria-hidden: o alt do img já nomeia a marca nos dois temas */}
      <span
        aria-hidden
        className={cn(
          "hidden font-black italic leading-none tracking-tight dark:inline-block",
          TAMANHO[size].texto,
          className
        )}
      >
        <span className="text-foreground">REALIZA</span>
        <span className="text-[var(--role-mentorado)]">.</span>
        <span className="text-[var(--brand-lime)]">VC</span>
      </span>
    </>
  );
}
