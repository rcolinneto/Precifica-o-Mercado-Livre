import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Calculadora from "./Calculadora";

export default async function CalculadoraPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: produto } = await supabase
    .from("produtos")
    .select(
      "id, nome, custo_compra, custo_embalagem, peso_real_g, comprimento_cm, largura_cm, altura_cm, modalidade_padrao, categoria_id",
    )
    .eq("id", id)
    .single();

  if (!produto) notFound();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: config } = await supabase
    .from("configuracoes")
    .select(
      "comissao_classico_pct_padrao, comissao_premium_pct_padrao, limite_frete_gratis, divisor_cubagem, imposto_pct, margem_alvo_pct, reputacao_atual, ganho_minimo_pp",
    )
    .eq("user_id", user!.id)
    .single();

  // Não deveria acontecer: o trigger de signup sempre cria uma linha.
  if (!config) notFound();

  const { data: tabelaFrete } = await supabase
    .from("tabela_frete")
    .select("modalidade, reputacao, peso_min_g, peso_max_g, preco_min, preco_max, custo")
    .eq("user_id", user!.id);

  let comissaoClassicoPct = Number(config.comissao_classico_pct_padrao);
  let comissaoPremiumPct = Number(config.comissao_premium_pct_padrao);

  if (produto.categoria_id) {
    const { data: categoria } = await supabase
      .from("categorias_ml")
      .select("comissao_classico_pct, comissao_premium_pct")
      .eq("id", produto.categoria_id)
      .single();
    if (categoria) {
      comissaoClassicoPct = Number(categoria.comissao_classico_pct);
      comissaoPremiumPct = Number(categoria.comissao_premium_pct);
    }
  }

  return (
    <Calculadora
      produto={produto}
      comissaoClassicoPct={comissaoClassicoPct}
      comissaoPremiumPct={comissaoPremiumPct}
      config={config}
      tabelaFrete={tabelaFrete ?? []}
    />
  );
}
