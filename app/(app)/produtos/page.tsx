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
    <div className="mx-auto max-w-4xl space-y-6 p-4 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Catálogo de produtos</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            {produtos?.length ?? 0} produto{produtos?.length === 1 ? "" : "s"} cadastrado{produtos?.length === 1 ? "" : "s"}
          </p>
        </div>
        <Link
          href="/produtos/novo"
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo-700"
        >
          + Novo produto
        </Link>
      </div>

      {!produtos || produtos.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <p className="text-sm text-slate-500">Nenhum produto cadastrado ainda.</p>
          <Link href="/produtos/novo" className="mt-2 inline-block text-sm font-medium text-indigo-600 hover:text-indigo-700">
            Cadastrar o primeiro produto
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-200/50">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Nome</th>
                  <th className="px-4 py-3">SKU</th>
                  <th className="px-4 py-3">Custo</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {produtos.map((p) => (
                  <tr key={p.id} className="transition-colors hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <Link href={`/produtos/${p.id}/calculadora`} className="font-medium text-slate-900 hover:text-indigo-600">
                        {p.nome}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{p.sku ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-700">{formatarReais(reaisParaCentavos(Number(p.custo_compra)))}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          p.ativo ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {p.ativo ? "Ativo" : "Inativo"}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right space-x-4">
                      <Link href={`/produtos/${p.id}/editar`} className="text-sm font-medium text-slate-500 hover:text-slate-900">
                        Editar
                      </Link>
                      <ToggleAtivoButton id={p.id} ativo={p.ativo} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
