"use client";

import { useMemo, useState, useTransition } from "react";
import {
  calcularParaPreco,
  deveSugerirKit,
  precoParaMargemAlvo,
  type ConfigPrecificacao,
  type EstadoMargem,
  type ResultadoPreco,
  type ResultadoPrecoSugerido,
  type TipoAnuncio,
} from "@/lib/pricing";
import { centavosParaReais, formatarPercentual, formatarReais, reaisParaCentavos } from "@/lib/money";
import { salvarPrecificacao } from "./actions";

interface Produto {
  id: string;
  nome: string;
  custo_compra: number;
  custo_embalagem: number;
  peso_gramas: number;
}

interface ConfigDb {
  custo_fixo_padrao: number;
  limite_custo_fixo: number;
  frete_base: number;
  peso_base_gramas: number;
  custo_por_grama_adicional: number;
  imposto_pct: number;
  margem_alvo_pct: number;
}

interface Props {
  produto: Produto;
  comissaoClassicoPct: number;
  comissaoPremiumPct: number;
  config: ConfigDb;
}

const MENSAGENS_ESTADO: Partial<Record<EstadoMargem, { titulo: string; tom: string }>> = {
  PREJUIZO: { titulo: "Esse preço dá prejuízo.", tom: "bg-red-50 text-red-800 border-red-200" },
  RUIM_ESTRUTURAL: {
    titulo: "Margem ruim mesmo sem o custo fixo — o problema é o custo do produto, não a taxa do ML.",
    tom: "bg-red-50 text-red-800 border-red-200",
  },
  ZONA_MORTA: {
    titulo: "Zona morta dos R$79: o custo fixo está comendo sua margem.",
    tom: "bg-amber-50 text-amber-800 border-amber-200",
  },
  ZONA_MORTA_SEM_SAIDA: {
    titulo: "Zona morta sem saída: subir o preço não ajuda, o frete anula a economia.",
    tom: "bg-amber-50 text-amber-800 border-amber-200",
  },
  ABAIXO_DA_META: { titulo: "Abaixo da meta de margem.", tom: "bg-amber-50 text-amber-800 border-amber-200" },
};

export default function Calculadora({ produto, comissaoClassicoPct, comissaoPremiumPct, config }: Props) {
  const [precoReais, setPrecoReais] = useState("79,90");
  const [margemAlvoInput, setMargemAlvoInput] = useState(String(Math.round(Number(config.margem_alvo_pct) * 100)));
  const [salvando, startSalvando] = useTransition();
  const [mensagemSalvar, setMensagemSalvar] = useState<string | null>(null);

  const configPricing: ConfigPrecificacao = useMemo(
    () => ({
      custoFixoPadrao: reaisParaCentavos(Number(config.custo_fixo_padrao)),
      limiteCustoFixo: reaisParaCentavos(Number(config.limite_custo_fixo)),
      freteBase: reaisParaCentavos(Number(config.frete_base)),
      pesoBaseGramas: Number(config.peso_base_gramas),
      custoPorGramaAdicional: reaisParaCentavos(Number(config.custo_por_grama_adicional)),
      impostoPct: Number(config.imposto_pct),
      margemAlvoPct: Number(config.margem_alvo_pct),
    }),
    [config],
  );

  const baseParams = useMemo(
    () => ({
      custoCompra: reaisParaCentavos(Number(produto.custo_compra)),
      custoEmbalagem: reaisParaCentavos(Number(produto.custo_embalagem)),
      pesoGramas: Number(produto.peso_gramas),
      config: configPricing,
    }),
    [produto, configPricing],
  );

  const precoCentavos = reaisParaCentavos(parseFloat(precoReais.replace(",", ".")) || 0);
  const margemDesejadaPct = (parseFloat(margemAlvoInput.replace(",", ".")) || 0) / 100;

  const resultadoClassico: ResultadoPreco = useMemo(
    () => calcularParaPreco(precoCentavos, { ...baseParams, comissaoPct: comissaoClassicoPct }),
    [precoCentavos, baseParams, comissaoClassicoPct],
  );
  const resultadoPremium: ResultadoPreco = useMemo(
    () => calcularParaPreco(precoCentavos, { ...baseParams, comissaoPct: comissaoPremiumPct }),
    [precoCentavos, baseParams, comissaoPremiumPct],
  );

  const sugestaoClassico: ResultadoPrecoSugerido = useMemo(
    () => precoParaMargemAlvo(margemDesejadaPct, { ...baseParams, comissaoPct: comissaoClassicoPct }),
    [margemDesejadaPct, baseParams, comissaoClassicoPct],
  );
  const sugestaoPremium: ResultadoPrecoSugerido = useMemo(
    () => precoParaMargemAlvo(margemDesejadaPct, { ...baseParams, comissaoPct: comissaoPremiumPct }),
    [margemDesejadaPct, baseParams, comissaoPremiumPct],
  );

  function aplicarPreco(centavos: number) {
    setPrecoReais(centavosParaReais(centavos).toFixed(2).replace(".", ","));
  }

  function handleSalvar(tipo: TipoAnuncio) {
    const resultado = tipo === "classico" ? resultadoClassico : resultadoPremium;
    startSalvando(async () => {
      setMensagemSalvar(null);
      const res = await salvarPrecificacao({
        produtoId: produto.id,
        tipoAnuncio: tipo,
        precoVenda: centavosParaReais(resultado.precoVenda),
        comissaoPct: resultado.comissaoPct,
        custoFixoAplicado: centavosParaReais(resultado.custoFixoAplicado),
        limiteCustoFixo: Number(config.limite_custo_fixo),
        frete: centavosParaReais(resultado.frete.valor),
        impostoPct: resultado.impostoPct,
        margemAlvoPct: Number(config.margem_alvo_pct),
        custoCompra: Number(produto.custo_compra),
        custoEmbalagem: Number(produto.custo_embalagem),
        estadoMargem: resultado.estadoMargem,
      });
      setMensagemSalvar(res.erro ?? `Precificação (${tipo === "classico" ? "Clássico" : "Premium"}) salva no histórico.`);
    });
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4">
      <div>
        <h1 className="text-lg font-semibold text-gray-900">{produto.nome}</h1>
        <p className="text-sm text-gray-500">
          Custo: {formatarReais(reaisParaCentavos(Number(produto.custo_compra)))} · Embalagem:{" "}
          {formatarReais(reaisParaCentavos(Number(produto.custo_embalagem)))} · Peso: {produto.peso_gramas}g
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <label htmlFor="preco" className="block text-sm font-medium text-gray-700">
            Preço de venda (R$)
          </label>
          <input
            id="preco"
            type="text"
            inputMode="decimal"
            value={precoReais}
            onChange={(e) => setPrecoReais(e.target.value)}
            className="w-full rounded border border-gray-300 px-3 py-2 text-lg font-medium focus:border-gray-500 focus:outline-none"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="margemAlvo" className="block text-sm font-medium text-gray-700">
            Margem desejada (%) — calcular preço
          </label>
          <input
            id="margemAlvo"
            type="text"
            inputMode="decimal"
            value={margemAlvoInput}
            onChange={(e) => setMargemAlvoInput(e.target.value)}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <CartaoTipo
          titulo="Clássico"
          resultado={resultadoClassico}
          sugestao={sugestaoClassico}
          onAplicarSugestao={aplicarPreco}
          onSalvar={() => handleSalvar("classico")}
          salvando={salvando}
        />
        <CartaoTipo
          titulo="Premium"
          resultado={resultadoPremium}
          sugestao={sugestaoPremium}
          onAplicarSugestao={aplicarPreco}
          onSalvar={() => handleSalvar("premium")}
          salvando={salvando}
        />
      </div>

      {mensagemSalvar && <p className="text-sm text-gray-700">{mensagemSalvar}</p>}
    </div>
  );
}

function CartaoTipo({
  titulo,
  resultado,
  sugestao,
  onAplicarSugestao,
  onSalvar,
  salvando,
}: {
  titulo: string;
  resultado: ResultadoPreco;
  sugestao: ResultadoPrecoSugerido;
  onAplicarSugestao: (centavos: number) => void;
  onSalvar: () => void;
  salvando: boolean;
}) {
  const msg = MENSAGENS_ESTADO[resultado.estadoMargem];

  return (
    <div className="space-y-3 rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-gray-900">{titulo}</h2>
        <span className="text-sm text-gray-500">{formatarPercentual(resultado.comissaoPct)} comissão</span>
      </div>

      <dl className="space-y-1 text-sm">
        <LinhaBreakdown label="Comissão" valor={-resultado.comissaoValor} />
        <LinhaBreakdown label="Custo fixo" valor={-resultado.custoFixoAplicado} />
        <LinhaBreakdown
          label="Frete"
          valor={-resultado.frete.valor}
          nota={!resultado.frete.confiavel ? "estimado, sem peso" : undefined}
        />
        <LinhaBreakdown label="Imposto" valor={-resultado.impostoValor} />
        <LinhaBreakdown label="Custo do produto" valor={-resultado.custoCompra - resultado.custoEmbalagem} />
        <div className="flex justify-between border-t border-gray-200 pt-1 font-semibold">
          <span>Lucro líquido</span>
          <span className={resultado.lucroLiquido < 0 ? "text-red-600" : "text-green-700"}>
            {formatarReais(resultado.lucroLiquido)}
          </span>
        </div>
        <div className="flex justify-between text-gray-500">
          <span>Margem líquida</span>
          <span>{formatarPercentual(resultado.margemLiquida)}</span>
        </div>
      </dl>

      {msg && (
        <div className={`rounded border p-2 text-xs ${msg.tom}`}>
          <p>{msg.titulo}</p>
          {resultado.diagnosticoZonaMorta && (
            <p className="mt-1">
              Em {formatarReais(resultado.diagnosticoZonaMorta.precoAlternativo)} a margem vai de{" "}
              {formatarPercentual(resultado.diagnosticoZonaMorta.margemAtual)} para{" "}
              {formatarPercentual(resultado.diagnosticoZonaMorta.margemAlternativa)}
              {deveSugerirKit(resultado.estadoMargem) ? " — ou monte um kit de 2-3 unidades pra passar dos R$79." : "."}
            </p>
          )}
        </div>
      )}

      {!sugestao.denominadorInvalido ? (
        <button type="button" onClick={() => onAplicarSugestao(sugestao.precoVenda)} className="text-xs underline text-gray-600">
          Usar preço sugerido: {formatarReais(sugestao.precoVenda)}
        </button>
      ) : (
        <p className="text-xs text-red-600">Meta de margem impossível com essas taxas (soma ≥ 100%).</p>
      )}

      <button
        type="button"
        onClick={onSalvar}
        disabled={salvando}
        className="w-full rounded bg-gray-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {salvando ? "Salvando..." : `Salvar precificação (${titulo})`}
      </button>
    </div>
  );
}

function LinhaBreakdown({ label, valor, nota }: { label: string; valor: number; nota?: string }) {
  return (
    <div className="flex justify-between">
      <span>
        {label}
        {nota && <span className="text-amber-600"> ({nota})</span>}
      </span>
      <span>{formatarReais(valor)}</span>
    </div>
  );
}
