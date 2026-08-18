"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export interface EstadoProduto {
  erro?: string;
}

function lerCamposProduto(formData: FormData) {
  return {
    nome: String(formData.get("nome") ?? "").trim(),
    sku: String(formData.get("sku") ?? "").trim(),
    marca: String(formData.get("marca") ?? "Dipil").trim() || "Dipil",
    custoCompra: Number(formData.get("custo_compra")),
    custoEmbalagem: Number(formData.get("custo_embalagem") ?? 0),
    pesoGramas: Number(formData.get("peso_gramas") ?? 0),
  };
}

export async function criarProduto(_estado: EstadoProduto | undefined, formData: FormData): Promise<EstadoProduto> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const campos = lerCamposProduto(formData);
  if (!campos.nome) return { erro: "Informe o nome do produto." };
  if (!Number.isFinite(campos.custoCompra) || campos.custoCompra < 0) {
    return { erro: "Custo de compra inválido." };
  }

  const { error, data } = await supabase
    .from("produtos")
    .insert({
      user_id: user.id,
      nome: campos.nome,
      sku: campos.sku || null,
      marca: campos.marca,
      custo_compra: campos.custoCompra,
      custo_embalagem: Number.isFinite(campos.custoEmbalagem) ? campos.custoEmbalagem : 0,
      peso_gramas: Number.isFinite(campos.pesoGramas) ? Math.round(campos.pesoGramas) : 0,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") return { erro: "Já existe um produto com esse SKU." };
    return { erro: "Não foi possível salvar o produto." };
  }

  revalidatePath("/produtos");
  redirect(`/produtos/${data.id}/calculadora`);
}

export async function atualizarProduto(
  id: string,
  _estado: EstadoProduto | undefined,
  formData: FormData,
): Promise<EstadoProduto> {
  const supabase = await createClient();

  const campos = lerCamposProduto(formData);
  if (!campos.nome) return { erro: "Informe o nome do produto." };
  if (!Number.isFinite(campos.custoCompra) || campos.custoCompra < 0) {
    return { erro: "Custo de compra inválido." };
  }

  const { error } = await supabase
    .from("produtos")
    .update({
      nome: campos.nome,
      sku: campos.sku || null,
      marca: campos.marca,
      custo_compra: campos.custoCompra,
      custo_embalagem: Number.isFinite(campos.custoEmbalagem) ? campos.custoEmbalagem : 0,
      peso_gramas: Number.isFinite(campos.pesoGramas) ? Math.round(campos.pesoGramas) : 0,
    })
    .eq("id", id);

  if (error) {
    if (error.code === "23505") return { erro: "Já existe um produto com esse SKU." };
    return { erro: "Não foi possível atualizar o produto." };
  }

  revalidatePath("/produtos");
  redirect(`/produtos/${id}/calculadora`);
}

export async function alternarAtivo(id: string, ativo: boolean) {
  const supabase = await createClient();
  await supabase.from("produtos").update({ ativo }).eq("id", id);
  revalidatePath("/produtos");
}
