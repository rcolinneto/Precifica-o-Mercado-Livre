"use client";

import { useActionState } from "react";
import { atualizarProduto, type EstadoProduto } from "../../actions";
import Campo from "../../Campo";
import CampoSelect from "../../CampoSelect";
import CampoCheckbox from "../../CampoCheckbox";
import { OPCOES_MODALIDADE } from "../../opcoesModalidade";

interface Props {
  produto: {
    id: string;
    nome: string;
    sku: string | null;
    marca: string;
    custo_compra: number;
    custo_embalagem: number;
    peso_real_g: number | null;
    comprimento_cm: number | null;
    largura_cm: number | null;
    altura_cm: number | null;
    modalidade_padrao: string;
    aceito_no_full: boolean;
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

      <div className="border-t border-slate-100 pt-4">
        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-slate-500">
          Peso e dimensões — usados pra calcular o custo de envio real
        </p>
        <div className="grid grid-cols-2 gap-4">
          <Campo
            label="Peso real (gramas)"
            name="peso_real_g"
            type="number"
            step="1"
            min="0"
            defaultValue={produto.peso_real_g !== null ? String(produto.peso_real_g) : ""}
          />
          <div />
          <Campo
            label="Comprimento (cm)"
            name="comprimento_cm"
            type="number"
            step="0.1"
            min="0"
            defaultValue={produto.comprimento_cm !== null ? String(produto.comprimento_cm) : ""}
          />
          <Campo
            label="Largura (cm)"
            name="largura_cm"
            type="number"
            step="0.1"
            min="0"
            defaultValue={produto.largura_cm !== null ? String(produto.largura_cm) : ""}
          />
          <Campo
            label="Altura (cm)"
            name="altura_cm"
            type="number"
            step="0.1"
            min="0"
            defaultValue={produto.altura_cm !== null ? String(produto.altura_cm) : ""}
          />
        </div>
        <p className="mt-1.5 text-xs text-slate-500">
          Dimensões são da embalagem final, não do produto. Sem peso nem dimensões, a calculadora não tem como
          estimar o custo de envio.
        </p>
      </div>

      <div className="border-t border-slate-100 pt-4 space-y-3">
        <div>
          <CampoSelect
            label="Modalidade de envio padrão"
            name="modalidade_padrao"
            defaultValue={produto.modalidade_padrao}
            opcoes={OPCOES_MODALIDADE}
          />
          <p className="mt-1.5 text-xs text-slate-500">
            Só Agência tem tabela de frete cadastrada por enquanto — as outras aparecem aqui assim que tiverem dado
            real.
          </p>
        </div>
        <CampoCheckbox
          label="Aceito no Full"
          name="aceito_no_full"
          defaultChecked={produto.aceito_no_full}
          ajuda="Desmarque para aerossol, inflamável ou produto tóxico — o Full não aceita."
        />
      </div>

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
