"use server";

import { createClient } from "@/lib/supabase/server";
import type { EstadoMargem, TipoAnuncio } from "@/lib/pricing";

interface SalvarPrecificacaoInput {
  produtoId: string;
  tipoAnuncio: TipoAnuncio;
  precoVenda: number; // reais
  comissaoPct: number;
  custoFixoAplicado: number; // reais
  limiteCustoFixo: number; // reais
  frete: number; // reais
  impostoPct: number;
  margemAlvoPct: number;
  custoCompra: number; // reais
  custoEmbalagem: number; // reais
  estadoMargem: EstadoMargem;
}

export async function salvarPrecificacao(input: SalvarPrecificacaoInput): Promise<{ erro?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { erro: "Sessão expirada, entre de novo." };

  const { error } = await supabase.from("precificacoes").insert({
    user_id: user.id,
    produto_id: input.produtoId,
    preco_venda: input.precoVenda,
    tipo_anuncio: input.tipoAnuncio,
    comissao_pct: input.comissaoPct,
    custo_fixo_aplicado: input.custoFixoAplicado,
    limite_custo_fixo: input.limiteCustoFixo,
    frete: input.frete,
    imposto_pct: input.impostoPct,
    margem_alvo_pct: input.margemAlvoPct,
    custo_compra: input.custoCompra,
    custo_embalagem: input.custoEmbalagem,
    estado_margem: input.estadoMargem,
  });

  if (error) return { erro: "Não foi possível salvar a precificação." };
  return {};
}
