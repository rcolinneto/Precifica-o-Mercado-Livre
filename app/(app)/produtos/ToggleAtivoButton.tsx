"use client";

import { useState, useTransition } from "react";
import { alternarAtivo } from "./actions";

export default function ToggleAtivoButton({ id, ativo }: { id: string; ativo: boolean }) {
  const [pendente, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  function handleClick() {
    startTransition(async () => {
      const res = await alternarAtivo(id, !ativo);
      setErro(res.erro ?? null);
    });
  }

  return (
    <span>
      <button
        type="button"
        disabled={pendente}
        onClick={handleClick}
        className="text-sm font-medium text-slate-500 hover:text-slate-900 disabled:opacity-50"
      >
        {ativo ? "Desativar" : "Ativar"}
      </button>
      {erro && <span className="ml-2 text-xs text-red-600">{erro}</span>}
    </span>
  );
}
