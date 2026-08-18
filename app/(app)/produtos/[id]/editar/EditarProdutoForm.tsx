"use client";

import { useActionState } from "react";
import { atualizarProduto, type EstadoProduto } from "../../actions";
import Campo from "../../Campo";

interface Props {
  produto: {
    id: string;
    nome: string;
    sku: string | null;
    marca: string;
    custo_compra: number;
    custo_embalagem: number;
    peso_gramas: number;
  };
}

export default function EditarProdutoForm({ produto }: Props) {
  const atualizarComId = atualizarProduto.bind(null, produto.id);
  const [estado, formAction, pendente] = useActionState<EstadoProduto | undefined, FormData>(
    atualizarComId,
    undefined,
  );

  return (
    <form
      action={formAction}
      className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/50"
    >
      <Campo label="Nome" name="nome" defaultValue={produto.nome} required />
      <Campo label="SKU (opcional)" name="sku" defaultValue={produto.sku ?? ""} />
      <Campo label="Marca" name="marca" defaultValue={produto.marca} />
      <div className="grid grid-cols-2 gap-4">
        <Campo
          label="Custo de compra (R$)"
          name="custo_compra"
          type="number"
          step="0.01"
          min="0"
          defaultValue={String(produto.custo_compra)}
          required
        />
        <Campo
          label="Embalagem (R$)"
          name="custo_embalagem"
          type="number"
          step="0.01"
          min="0"
          defaultValue={String(produto.custo_embalagem)}
        />
      </div>
      <Campo
        label="Peso (gramas)"
        name="peso_gramas"
        type="number"
        step="1"
        min="0"
        defaultValue={String(produto.peso_gramas)}
      />
      {estado?.erro && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{estado.erro}</p>}
      <button
        type="submit"
        disabled={pendente}
        className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo-700 disabled:opacity-50"
      >
        {pendente ? "Salvando..." : "Salvar alterações"}
      </button>
    </form>
  );
}
