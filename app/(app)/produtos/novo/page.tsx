"use client";

import { useActionState } from "react";
import Link from "next/link";
import { criarProduto, type EstadoProduto } from "../actions";
import Campo from "../Campo";

export default function NovoProdutoPage() {
  const [estado, formAction, pendente] = useActionState<EstadoProduto | undefined, FormData>(criarProduto, undefined);

  return (
    <div className="mx-auto max-w-lg space-y-6 p-4 py-8">
      <div>
        <Link href="/produtos" className="text-sm font-medium text-slate-500 hover:text-slate-900">
          ← Catálogo
        </Link>
        <h1 className="mt-1 text-xl font-semibold text-slate-900">Novo produto</h1>
      </div>

      <form
        action={formAction}
        className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/50"
      >
        <Campo label="Nome" name="nome" required />
        <Campo label="SKU (opcional)" name="sku" />
        <Campo label="Marca" name="marca" defaultValue="Dipil" />
        <div className="grid grid-cols-2 gap-4">
          <Campo label="Custo de compra (R$)" name="custo_compra" type="number" step="0.01" min="0" required />
          <Campo label="Embalagem (R$)" name="custo_embalagem" type="number" step="0.01" min="0" defaultValue="0" />
        </div>
        <Campo label="Peso (gramas)" name="peso_gramas" type="number" step="1" min="0" defaultValue="0" />

        {estado?.erro && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{estado.erro}</p>}

        <button
          type="submit"
          disabled={pendente}
          className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo-700 disabled:opacity-50"
        >
          {pendente ? "Salvando..." : "Salvar produto"}
        </button>
      </form>
    </div>
  );
}
