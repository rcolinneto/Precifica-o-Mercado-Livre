import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import EditarProdutoForm from "./EditarProdutoForm";

export default async function EditarProdutoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: produto } = await supabase
    .from("produtos")
    .select("id, nome, sku, marca, custo_compra, custo_embalagem, peso_gramas")
    .eq("id", id)
    .single();

  if (!produto) notFound();

  return (
    <div className="mx-auto max-w-lg space-y-6 p-4 py-8">
      <div>
        <Link href="/produtos" className="text-sm font-medium text-slate-500 hover:text-slate-900">
          ← Catálogo
        </Link>
        <h1 className="mt-1 text-xl font-semibold text-slate-900">Editar produto</h1>
      </div>
      <EditarProdutoForm produto={produto} />
    </div>
  );
}
