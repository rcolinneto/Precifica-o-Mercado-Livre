"use server";

import { createClient } from "@/lib/supabase/server";
import type { EstadoMargem, Modalidade, OrigemCustoEnvio, Reputacao, TipoAnuncio } from "@/lib/pricing";

interface SalvarPrecificacaoInput {
  produtoId: string;
  tipoAnuncio: TipoAnuncio;
  precoVenda: number; // reais
  comissaoPct: number;
  custoEnvio: number; // reais
  pesoCobravelG: number;
  modalidade: Modalidade;
  reputacao: Reputacao;
  origemCustoEnvio: OrigemCustoEnvio;
  limiteFreteGratis: number; // reais
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
    custo_envio: input.custoEnvio,
    peso_cobravel_g: input.pesoCobravelG,
    modalidade: input.modalidade,
    reputacao: input.reputacao,
    origem_custo_envio: input.origemCustoEnvio,
    limite_frete_gratis: input.limiteFreteGratis,
    imposto_pct: input.impostoPct,
    margem_alvo_pct: input.margemAlvoPct,
    custo_compra: input.custoCompra,
    custo_embalagem: input.custoEmbalagem,
    estado_margem: input.estadoMargem,
  });

  if (error) {
    // Só o usuário vê a mensagem genérica abaixo; o motivo real do Postgres
    // fica no log do servidor pra dar pra diagnosticar.
    console.error("salvarPrecificacao falhou:", error);
    return { erro: "Não foi possível salvar a precificação." };
  }
  return {};
}
