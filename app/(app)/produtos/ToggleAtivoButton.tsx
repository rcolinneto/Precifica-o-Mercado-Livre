"use client";

import { useTransition } from "react";
import { alternarAtivo } from "./actions";

export default function ToggleAtivoButton({ id, ativo }: { id: string; ativo: boolean }) {
  const [pendente, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pendente}
      onClick={() => startTransition(() => alternarAtivo(id, !ativo))}
      className="text-sm font-medium text-slate-500 hover:text-slate-900 disabled:opacity-50"
    >
      {ativo ? "Desativar" : "Ativar"}
    </button>
  );
}
