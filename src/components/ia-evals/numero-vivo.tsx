"use client";

import { useEffect } from "react";
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from "motion/react";
import { cn } from "@/lib/utils";

/** Live number that interpolates as items land — same NumeroVivo pattern
 *  as registros-painel (useSpring eases the read; reduced-motion falls
 *  back to the direct value via MotionConfig + the hook). */
export function NumeroVivo({
  valor,
  formato = (v) => String(Math.round(v)),
  className,
}: {
  valor: number;
  formato?: (v: number) => string;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const mv = useMotionValue(valor);
  const spring = useSpring(mv, { stiffness: 240, damping: 30 });
  const txt = useTransform(spring, (v) => formato(v));
  useEffect(() => {
    mv.set(valor);
  }, [valor, mv]);
  if (reduced)
    return <span className={cn("tabular-nums", className)}>{formato(valor)}</span>;
  return (
    <motion.span className={cn("tabular-nums", className)}>{txt}</motion.span>
  );
}
