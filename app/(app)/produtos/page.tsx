import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatarReais, reaisParaCentavos } from "@/lib/money";
import ToggleAtivoButton from "./ToggleAtivoButton";

export default async function ProdutosPage() {
  const supabase = await createClient();
  const { data: produtos } = await supabase
    .from("produtos")
    .select("id, nome, sku, custo_compra, ativo")
    .order("created_at", { ascending: false });

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900">Catálogo de produtos</h1>
        <Link href="/produtos/novo" className="rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white">
          + Novo produto
        </Link>
      </div>

      {!produtos || produtos.length === 0 ? (
        <p className="text-sm text-gray-500">Nenhum produto cadastrado ainda.</p>
      ) : (
        <div className="overflow-x-auto rounded border border-gray-200 bg-white">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="bg-gray-50 text-left text-gray-600">
              <tr>
                <th className="px-3 py-2">Nome</th>
                <th className="px-3 py-2">SKU</th>
                <th className="px-3 py-2">Custo</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {produtos.map((p) => (
                <tr key={p.id} className="border-t border-gray-100">
                  <td className="px-3 py-2">
                    <Link
                      href={`/produtos/${p.id}/calculadora`}
                      className="font-medium text-gray-900 underline-offset-2 hover:underline"
                    >
                      {p.nome}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-gray-500">{p.sku ?? "—"}</td>
                  <td className="px-3 py-2">{formatarReais(reaisParaCentavos(Number(p.custo_compra)))}</td>
                  <td className="px-3 py-2">
                    <span className={p.ativo ? "text-green-700" : "text-gray-400"}>
                      {p.ativo ? "Ativo" : "Inativo"}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right space-x-3">
                    <Link href={`/produtos/${p.id}/editar`} className="text-sm underline">
                      Editar
                    </Link>
                    <ToggleAtivoButton id={p.id} ativo={p.ativo} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
