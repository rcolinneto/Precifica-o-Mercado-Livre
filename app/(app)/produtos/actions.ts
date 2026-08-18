"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/supabase/server";
import type { Modalidade } from "@/lib/pricing";

export interface EstadoProduto {
  erro?: string;
}

function numeroOuNull(valor: FormDataEntryValue | null): number | null {
  if (valor === null || valor === "") return null;
  const n = Number(valor);
  return Number.isFinite(n) ? n : null;
}

function lerCamposProduto(formData: FormData) {
  return {
    nome: String(formData.get("nome") ?? "").trim(),
    sku: String(formData.get("sku") ?? "").trim(),
    marca: String(formData.get("marca") ?? "Dipil").trim() || "Dipil",
    custoCompra: Number(formData.get("custo_compra")),
    custoEmbalagem: Number(formData.get("custo_embalagem") ?? 0),
    pesoRealG: numeroOuNull(formData.get("peso_real_g")),
    comprimentoCm: numeroOuNull(formData.get("comprimento_cm")),
    larguraCm: numeroOuNull(formData.get("largura_cm")),
    alturaCm: numeroOuNull(formData.get("altura_cm")),
    modalidadePadrao: (String(formData.get("modalidade_padrao") ?? "agencia") || "agencia") as Modalidade,
    aceitoNoFull: formData.get("aceito_no_full") === "on",
  };
}

export async function criarProduto(_estado: EstadoProduto | undefined, formData: FormData): Promise<EstadoProduto> {
  const { supabase, user } = await requireUser();

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
      peso_real_g: campos.pesoRealG,
      comprimento_cm: campos.comprimentoCm,
      largura_cm: campos.larguraCm,
      altura_cm: campos.alturaCm,
      modalidade_padrao: campos.modalidadePadrao,
      aceito_no_full: campos.aceitoNoFull,
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
  const { supabase, user } = await requireUser();

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
      peso_real_g: campos.pesoRealG,
      comprimento_cm: campos.comprimentoCm,
      largura_cm: campos.larguraCm,
      altura_cm: campos.alturaCm,
      modalidade_padrao: campos.modalidadePadrao,
      aceito_no_full: campos.aceitoNoFull,
    })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    if (error.code === "23505") return { erro: "Já existe um produto com esse SKU." };
    return { erro: "Não foi possível atualizar o produto." };
  }

  revalidatePath("/produtos");
  redirect(`/produtos/${id}/calculadora`);
}

export async function alternarAtivo(id: string, ativo: boolean): Promise<{ erro?: string }> {
  const { supabase, user } = await requireUser();
  const { error } = await supabase.from("produtos").update({ ativo }).eq("id", id).eq("user_id", user.id);
  revalidatePath("/produtos");
  if (error) return { erro: "Não foi possível atualizar o status." };
  return {};
}

export async function excluirProduto(id: string): Promise<{ erro?: string }> {
  const { supabase, user } = await requireUser();
  const { error } = await supabase.from("produtos").delete().eq("id", id).eq("user_id", user.id);
  if (error) return { erro: "Não foi possível excluir o produto." };
  revalidatePath("/produtos");
  return {};
}
