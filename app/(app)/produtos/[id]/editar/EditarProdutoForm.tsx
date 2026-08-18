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
    <form action={formAction} className="space-y-4 rounded-lg border border-gray-200 bg-white p-4">
      <Campo label="Nome" name="nome" defaultValue={produto.nome} required />
      <Campo label="SKU (opcional)" name="sku" defaultValue={produto.sku ?? ""} />
      <Campo label="Marca" name="marca" defaultValue={produto.marca} />
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
        label="Custo de embalagem (R$)"
        name="custo_embalagem"
        type="number"
        step="0.01"
        min="0"
        defaultValue={String(produto.custo_embalagem)}
      />
      <Campo
        label="Peso (gramas)"
        name="peso_gramas"
        type="number"
        step="1"
        min="0"
        defaultValue={String(produto.peso_gramas)}
      />
      {estado?.erro && <p className="text-sm text-red-600">{estado.erro}</p>}
      <button
        type="submit"
        disabled={pendente}
        className="rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {pendente ? "Salvando..." : "Salvar alterações"}
      </button>
    </form>
  );
}
