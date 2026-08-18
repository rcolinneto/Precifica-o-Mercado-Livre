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
    <div className="mx-auto max-w-lg p-4">
      <h1 className="mb-4 text-lg font-semibold text-gray-900">Editar produto</h1>
      <EditarProdutoForm produto={produto} />
    </div>
  );
}
