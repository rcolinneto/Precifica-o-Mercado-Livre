"use client";

import { useActionState } from "react";
import { criarProduto, type EstadoProduto } from "../actions";
import Campo from "../Campo";

export default function NovoProdutoPage() {
  const [estado, formAction, pendente] = useActionState<EstadoProduto | undefined, FormData>(criarProduto, undefined);

  return (
    <div className="mx-auto max-w-lg p-4">
      <h1 className="mb-4 text-lg font-semibold text-gray-900">Novo produto</h1>
      <form action={formAction} className="space-y-4 rounded-lg border border-gray-200 bg-white p-4">
        <Campo label="Nome" name="nome" required />
        <Campo label="SKU (opcional)" name="sku" />
        <Campo label="Marca" name="marca" defaultValue="Dipil" />
        <Campo label="Custo de compra (R$)" name="custo_compra" type="number" step="0.01" min="0" required />
        <Campo label="Custo de embalagem (R$)" name="custo_embalagem" type="number" step="0.01" min="0" defaultValue="0" />
        <Campo label="Peso (gramas)" name="peso_gramas" type="number" step="1" min="0" defaultValue="0" />
        {estado?.erro && <p className="text-sm text-red-600">{estado.erro}</p>}
        <button
          type="submit"
          disabled={pendente}
          className="rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {pendente ? "Salvando..." : "Salvar produto"}
        </button>
      </form>
    </div>
  );
}
