// Módulo puro de precificação — sem dependência de React ou Supabase.
//
// Convenções:
//   * Todo valor monetário é um inteiro em CENTAVOS (nunca float/reais aqui).
//   * Todo percentual é uma fração 0–1 (0.12 = 12%), nunca "12".
//   * `ConfigPrecificacao` representa taxas VIGENTES no momento do cálculo —
//     quem decide se isso vem de `configuracoes` (valores atuais) ou de um
//     snapshot em `precificacoes` (histórico) é a camada de dados, não este
//     módulo.

export type TipoAnuncio = "classico" | "premium";

export type EstadoMargem =
  | "PREJUIZO"
  | "RUIM_ESTRUTURAL"
  | "ZONA_MORTA"
  | "ZONA_MORTA_SEM_SAIDA"
  | "ABAIXO_DA_META"
  | "OK"
  | "BOA";

export interface ConfigPrecificacao {
  custoFixoPadrao: number; // centavos
  limiteCustoFixo: number; // centavos (ML: 7900 = R$79,00)
  freteBase: number; // centavos — frete quando peso <= pesoBaseGramas
  pesoBaseGramas: number; // gramas
  custoPorGramaAdicional: number; // centavos por grama acima de pesoBaseGramas
  impostoPct: number; // 0–1
  margemAlvoPct: number; // 0–1
}

export interface ParametrosCalculo {
  custoCompra: number; // centavos
  custoEmbalagem: number; // centavos
  pesoGramas: number; // 0 = desconhecido (cai no fallback de freteBase)
  comissaoPct: number; // 0–1, já resolvida (categoria ou fallback)
  config: ConfigPrecificacao;
}

export interface FreteEstimado {
  valor: number; // centavos
  confiavel: boolean; // false quando pesoGramas <= 0 (fallback genérico, não uma estimativa real)
}

export interface DiagnosticoZonaMorta {
  margemAtual: number;
  margemSemCustoFixo: number;
  precoAlternativo: number; // = limiteCustoFixo: menor preço que zera o custo fixo
  margemAlternativa: number;
  freteAlternativo: FreteEstimado;
}

export interface ResultadoPreco {
  precoVenda: number;
  comissaoPct: number;
  comissaoValor: number;
  custoFixoAplicado: number;
  frete: FreteEstimado;
  impostoPct: number;
  impostoValor: number;
  custoCompra: number;
  custoEmbalagem: number;
  lucroLiquido: number;
  margemLiquida: number;
  estadoMargem: EstadoMargem;
  /** Presente apenas quando precoVenda < limiteCustoFixo e a margem não bate a meta. */
  diagnosticoZonaMorta?: DiagnosticoZonaMorta;
}

/**
 * Resultado de "que preço eu preciso cobrar" — a fórmula divide por
 * (1 - comissão - imposto - margem), que pode ser <= 0. Union discriminada
 * em vez de lançar/retornar Infinity: a tela é obrigada a checar
 * `denominadorInvalido` antes de tocar em qualquer outro campo.
 */
export type ResultadoPrecoSugerido =
  | { denominadorInvalido: true }
  | ({ denominadorInvalido: false } & ResultadoPreco);

/** Margem além da meta para um resultado ser considerado "BOA" em vez de "OK". */
const MARGEM_BOA_BUFFER_PCT = 0.05;

function resolverCustoFixo(precoVenda: number, config: ConfigPrecificacao): number {
  return precoVenda < config.limiteCustoFixo ? config.custoFixoPadrao : 0;
}

function calcularFrete(pesoGramas: number, config: ConfigPrecificacao): FreteEstimado {
  const excedente = Math.max(0, pesoGramas - config.pesoBaseGramas);
  const valor = Math.round(config.freteBase + excedente * config.custoPorGramaAdicional);
  return { valor, confiavel: pesoGramas > 0 };
}

function resolverFrete(precoVenda: number, pesoGramas: number, config: ConfigPrecificacao): FreteEstimado {
  if (precoVenda < config.limiteCustoFixo) {
    // Frete grátis só é obrigatório a partir do limite; abaixo dele o
    // vendedor não banca frete (o comprador paga o próprio frete).
    return { valor: 0, confiavel: true };
  }
  return calcularFrete(pesoGramas, config);
}

function diagnosticarZonaMorta(
  precoVenda: number,
  lucroLiquido: number,
  margemLiquida: number,
  custoFixoAplicado: number,
  params: ParametrosCalculo,
): DiagnosticoZonaMorta {
  // Neste ramo precoVenda < limiteCustoFixo, então o frete atual é sempre 0
  // (ver resolverFrete) — remover o custo fixo é só somar ele de volta.
  const margemSemCustoFixo = (lucroLiquido + custoFixoAplicado) / precoVenda;

  const precoAlternativo = params.config.limiteCustoFixo;
  const alternativo = calcularParaPreco(precoAlternativo, params);

  return {
    margemAtual: margemLiquida,
    margemSemCustoFixo,
    precoAlternativo,
    margemAlternativa: alternativo.margemLiquida,
    freteAlternativo: alternativo.frete,
  };
}

function classificarEstado(
  precoVenda: number,
  lucroLiquido: number,
  margemLiquida: number,
  custoFixoAplicado: number,
  params: ParametrosCalculo,
): { estado: EstadoMargem; diagnostico?: DiagnosticoZonaMorta } {
  const alvo = params.config.margemAlvoPct;

  if (lucroLiquido <= 0) {
    return { estado: "PREJUIZO" };
  }

  if (margemLiquida >= alvo) {
    return { estado: margemLiquida >= alvo + MARGEM_BOA_BUFFER_PCT ? "BOA" : "OK" };
  }

  // margemLiquida < alvo, mas o produto dá lucro.
  if (precoVenda >= params.config.limiteCustoFixo) {
    // Já está acima do limite: não há custo fixo para culpar, nem "subir o
    // preço para 79" como saída — é só um produto abaixo da meta mesmo.
    return { estado: "ABAIXO_DA_META" };
  }

  const diagnostico = diagnosticarZonaMorta(precoVenda, lucroLiquido, margemLiquida, custoFixoAplicado, params);

  if (diagnostico.margemSemCustoFixo < alvo) {
    // Mesmo sem o custo fixo a meta não seria batida: o vilão é o custo do
    // produto, não a taxa do ML. Sugerir kit ou subir para R$79 não resolve.
    return { estado: "RUIM_ESTRUTURAL", diagnostico };
  }

  if (diagnostico.margemAlternativa > margemLiquida) {
    return { estado: "ZONA_MORTA", diagnostico };
  }

  // O custo fixo é o vilão, mas o frete obrigatório acima de R$79 anula (ou
  // piora) a economia — típico de produto pesado/volumoso. Subir o preço
  // não resolve; o caminho é reduzir custo de compra ou peso/dimensão.
  return { estado: "ZONA_MORTA_SEM_SAIDA", diagnostico };
}

export function calcularParaPreco(precoVenda: number, params: ParametrosCalculo): ResultadoPreco {
  const { config } = params;
  const custoFixoAplicado = resolverCustoFixo(precoVenda, config);
  const frete = resolverFrete(precoVenda, params.pesoGramas, config);
  const comissaoValor = Math.round(precoVenda * params.comissaoPct);
  const impostoValor = Math.round(precoVenda * config.impostoPct);

  const lucroLiquido =
    precoVenda -
    comissaoValor -
    custoFixoAplicado -
    frete.valor -
    impostoValor -
    params.custoCompra -
    params.custoEmbalagem;

  const margemLiquida = precoVenda === 0 ? 0 : lucroLiquido / precoVenda;

  const { estado, diagnostico } = classificarEstado(
    precoVenda,
    lucroLiquido,
    margemLiquida,
    custoFixoAplicado,
    params,
  );

  return {
    precoVenda,
    comissaoPct: params.comissaoPct,
    comissaoValor,
    custoFixoAplicado,
    frete,
    impostoPct: config.impostoPct,
    impostoValor,
    custoCompra: params.custoCompra,
    custoEmbalagem: params.custoEmbalagem,
    lucroLiquido,
    margemLiquida,
    estadoMargem: estado,
    diagnosticoZonaMorta: diagnostico,
  };
}

function resolverPrecoPorMargem(margemDesejadaPct: number, params: ParametrosCalculo): ResultadoPrecoSugerido {
  const { config } = params;
  const denominador = 1 - params.comissaoPct - config.impostoPct - margemDesejadaPct;

  if (denominador <= 0) {
    return { denominadorInvalido: true };
  }

  const baseCusto = params.custoCompra + params.custoEmbalagem;

  // Candidato 1: assume preço abaixo do limite (paga custo fixo, frete=0).
  const preco1 = (baseCusto + config.custoFixoPadrao) / denominador;

  // Candidato 2: assume preço no limite ou acima (paga frete, sem custo fixo).
  const freteCandidato = calcularFrete(params.pesoGramas, config).valor;
  const preco2 = (baseCusto + freteCandidato) / denominador;

  let precoFinal: number;
  if (preco1 < config.limiteCustoFixo) {
    precoFinal = preco1;
  } else if (preco2 >= config.limiteCustoFixo) {
    precoFinal = preco2;
  } else {
    // Nenhum candidato é consistente com a própria premissa — acontece só
    // perto do limite quando frete < custo fixo. Usa o limite como resposta
    // segura em vez de escolher arbitrariamente entre os dois.
    precoFinal = config.limiteCustoFixo;
  }

  return { denominadorInvalido: false, ...calcularParaPreco(Math.round(precoFinal), params) };
}

export function calcularPrecoSugerido(params: ParametrosCalculo): ResultadoPrecoSugerido {
  return resolverPrecoPorMargem(params.config.margemAlvoPct, params);
}

export function precoParaMargemAlvo(margemDesejadaPct: number, params: ParametrosCalculo): ResultadoPrecoSugerido {
  return resolverPrecoPorMargem(margemDesejadaPct, params);
}

/** Só a ZONA_MORTA tem "subir para R$79 ou montar kit" como saída real. */
export function deveSugerirKit(estado: EstadoMargem): boolean {
  return estado === "ZONA_MORTA";
}
