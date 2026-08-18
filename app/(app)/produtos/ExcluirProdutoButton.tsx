"use client";

import { useState, useTransition } from "react";
import { excluirProduto } from "./actions";

export default function ExcluirProdutoButton({ id, nome }: { id: string; nome: string }) {
  const [pendente, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  function handleClick() {
    const confirmado = window.confirm(
      `Excluir "${nome}"? Simulações de preço já salvas pra esse produto continuam no histórico, mas o cadastro some do catálogo. Não dá pra desfazer.`,
    );
    if (!confirmado) return;

    startTransition(async () => {
      const res = await excluirProduto(id);
      setErro(res.erro ?? null);
    });
  }

  return (
    <span>
      <button
        type="button"
        disabled={pendente}
        onClick={handleClick}
        className="text-sm font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
      >
        Excluir
      </button>
      {erro && <span className="ml-2 text-xs text-red-600">{erro}</span>}
    </span>
  );
}
