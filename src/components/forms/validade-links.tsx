"use client";

import { useId } from "react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { VALIDADE_OPCOES } from "./link-shared";

/** Campo "Validade dos links" — o items= garante o rótulo ("Expira em 7
 *  dias") no gatilho em vez do valor cru ("7"). */
export function ValidadeLinks({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const labelId = useId();
  return (
    <div className="space-y-1.5">
      <Label id={labelId}>Validade dos links</Label>
      <Select
        value={value}
        onValueChange={(v) => onChange(v ?? "0")}
        items={Object.fromEntries(VALIDADE_OPCOES.map((o) => [o.v, o.l]))}
      >
        <SelectTrigger aria-labelledby={labelId} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {VALIDADE_OPCOES.map((o) => (
            <SelectItem key={o.v} value={o.v}>
              {o.l}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
