// Módulo puro de precificação — sem dependência de React ou Supabase.
//
// Convenções:
//   * Todo valor monetário é um inteiro em CENTAVOS (nunca float/reais aqui).
//   * Todo percentual é uma fração 0–1 (0.12 = 12%), nunca "12".
//   * Busca na tabela de frete é sempre meio-aberta: min <= valor < max.
//   * `ConfigPrecificacao` representa taxas VIGENTES no momento do cálculo —
//     quem decide se isso vem de `configuracoes` (valores atuais) ou de um
//     snapshot em `precificacoes` (histórico) é a camada de dados, não este
//     módulo.
//
// TODO(kits): ao montar kit, recalcular peso E dimensões da caixa combinada
// (não só somar custo/preço) — a faixa de peso/cubagem do kit pode ser
// diferente da de qualquer item isolado. Ver DiagnosticoCruzamento/
// calcularCustoEnvio: eles já aceitam peso/dimensões agregados sem mudança
// de assinatura, só precisam receber os valores certos quando kits existir.

export type TipoAnuncio = "classico" | "premium";

export type Modalidade = "coleta" | "agencia" | "full" | "flex" | "proprio";
export type Reputacao = "sem_reputacao" | "vermelho" | "laranja" | "amarelo" | "verde" | "verde_escuro";
export type OrigemCustoEnvio = "tabela" | "manual" | "estimado";

export type EstadoMargem =
  | "INDETERMINADO"
  | "PREJUIZO"
  | "RUIM_ESTRUTURAL"
  | "ZONA_MORTA"
  | "ZONA_MORTA_SEM_SAIDA"
  | "ABAIXO_DA_META"
  | "OK"
  | "BOA";

export interface DimensoesCm {
  comprimento: number;
  largura: number;
  altura: number;
}

export interface LinhaTabelaFrete {
  modalidade: Modalidade;
  reputacao: Reputacao;
  pesoMinG: number;
  pesoMaxG: number; // exclusivo: pesoMinG <= peso < pesoMaxG
  precoMin: number; // centavos
  precoMax: number; // centavos, exclusivo: precoMin <= preço < precoMax
  custo: number; // centavos
}

export interface CustoEnvio {
  valor: number; // centavos
  pesoCobravelG: number;
  usouCubagem: boolean; // cubagem superou o peso real
  origem: OrigemCustoEnvio; // esta função só produz 'tabela' ou 'estimado' — 'manual' é setado por quem chama, quando o usuário sobrescreve
  confiavel: boolean;
  faltando?: string; // motivo legível quando confiavel=false
}

export interface ParametrosCustoEnvio {
  pesoRealG: number | null;
  dimensoesCm: DimensoesCm | null;
  precoVenda: number; // centavos
  modalidade: Modalidade;
  reputacao: Reputacao;
  tabela: LinhaTabelaFrete[];
  divisorCubagem: number;
}

export interface ConfigPrecificacao {
  limiteFreteGratis: number; // centavos (ML: 7900 = R$79,00) — ponto de referência do diagnóstico de cruzamento
  divisorCubagem: number; // ex: 6000
  impostoPct: number; // 0–1
  margemAlvoPct: number; // 0–1
  reputacao: Reputacao; // é da conta inteira, não por produto
  ganhoMinimoPct: number; // 0–1 (fração; DB guarda em pontos percentuais, conversão é responsabilidade de quem monta este objeto)
}

export interface ParametrosCalculo {
  custoCompra: number; // centavos
  custoEmbalagem: number; // centavos
  pesoRealG: number | null;
  dimensoesCm: DimensoesCm | null;
  modalidade: Modalidade;
  comissaoPct: number; // 0–1, já resolvida (categoria ou fallback)
  tabela: LinhaTabelaFrete[];
  config: ConfigPrecificacao;
}

export type DiagnosticoCruzamento =
  | { confiavel: false; faltando: string }
  | {
      confiavel: true;
      margemAtual: number;
      precoAlternativo: number; // limiteFreteGratis + 90 centavos — exibido como "79,90", não "79,00"
      margemAlternativa: number; // cenário real (custo de envio recalculado no preço alternativo)
      margemAlternativaSemDegrau: number; // hipotético: preço sobe, custo de envio finge que não mudou
      custoEnvioAlternativo: CustoEnvio;
      degrauCustoEnvio: number; // custoEnvioAlternativo.valor - custoEnvioAtual.valor — "o número mais acionável"
    };

export interface ResultadoPreco {
  precoVenda: number;
  comissaoPct: number;
  comissaoValor: number;
  custoEnvio: CustoEnvio;
  impostoPct: number;
  impostoValor: number;
  custoCompra: number;
  custoEmbalagem: number;
  lucroLiquido: number;
  margemLiquida: number;
  estadoMargem: EstadoMargem;
  /** Presente quando precoVenda < limiteFreteGratis e o custo de envio atual é confiável. Ausente em INDETERMINADO e quando já se está acima do limite. */
  diagnosticoCruzamento?: DiagnosticoCruzamento;
}

/**
 * Resultado de "que preço eu preciso cobrar". Três desfechos possíveis, não
 * dois: além do denominador inválido, a tabela de frete pode não ter dado
 * suficiente pra sequer tentar (peso desconhecido, ou nenhuma faixa bate).
 * A tela é obrigada a checar `status` antes de tocar em qualquer outro campo.
 */
export type ResultadoPrecoSugerido =
  | { status: "denominador_invalido" }
  | { status: "sem_dados_confiaveis"; faltando: string }
  | ({ status: "ok" } & ResultadoPreco);

/** Margem além da meta para um resultado ser considerado "BOA" em vez de "OK". */
const MARGEM_BOA_BUFFER_PCT = 0.05;

/** Preço de exibição do "cruzar a barreira": 79,90, não 79,00 — mas calculado
 * na mesma faixa de tabela (testado explicitamente em pricing.test.ts). */
const CENTAVOS_ACIMA_DO_LIMITE_PARA_SUGESTAO = 90;

function resolverPesoCobravel(
  pesoRealG: number | null,
  dimensoesCm: DimensoesCm | null,
  divisorCubagem: number,
): { pesoCobravelG: number; usouCubagem: boolean; conhecido: boolean } {
  if (pesoRealG === null && dimensoesCm === null) {
    return { pesoCobravelG: 0, usouCubagem: false, conhecido: false };
  }
  const pesoCubadoG = dimensoesCm
    ? (dimensoesCm.comprimento * dimensoesCm.largura * dimensoesCm.altura * 1000) / divisorCubagem
    : 0;
  const pesoRealResolvido = pesoRealG ?? 0;
  const usouCubagem = pesoCubadoG > pesoRealResolvido;
  // Nunca subestima: arredonda pra cima, mesmo que isso empurre o produto
  // pra fora da faixa de peso mais barata (testado explicitamente).
  const pesoCobravelG = Math.ceil(Math.max(pesoRealResolvido, pesoCubadoG));
  return { pesoCobravelG, usouCubagem, conhecido: true };
}

function buscarLinhaTabela(
  tabela: LinhaTabelaFrete[],
  modalidade: Modalidade,
  reputacao: Reputacao,
  pesoCobravelG: number,
  precoVenda: number,
): LinhaTabelaFrete | undefined {
  return tabela.find(
    (l) =>
      l.modalidade === modalidade &&
      l.reputacao === reputacao &&
      pesoCobravelG >= l.pesoMinG &&
      pesoCobravelG < l.pesoMaxG &&
      precoVenda >= l.precoMin &&
      precoVenda < l.precoMax,
  );
}

export function calcularCustoEnvio(params: ParametrosCustoEnvio): CustoEnvio {
  const { pesoRealG, dimensoesCm, precoVenda, modalidade, reputacao, tabela, divisorCubagem } = params;

  const { pesoCobravelG, usouCubagem, conhecido } = resolverPesoCobravel(pesoRealG, dimensoesCm, divisorCubagem);

  if (!conhecido) {
    return { valor: 0, pesoCobravelG: 0, usouCubagem: false, origem: "estimado", confiavel: false, faltando: "peso ou dimensões do produto" };
  }

  const linha = buscarLinhaTabela(tabela, modalidade, reputacao, pesoCobravelG, precoVenda);

  if (!linha) {
    return {
      valor: 0,
      pesoCobravelG,
      usouCubagem,
      origem: "estimado",
      confiavel: false,
      faltando: `sem linha na tabela de frete para modalidade "${modalidade}", reputação "${reputacao}", peso ${pesoCobravelG}g, preço ${(precoVenda / 100).toFixed(2)}`,
    };
  }

  return { valor: linha.custo, pesoCobravelG, usouCubagem, origem: "tabela", confiavel: true };
}

function margemComCustoEnvio(precoVenda: number, custoEnvioValor: number, params: ParametrosCalculo): number {
  const comissaoValor = Math.round(precoVenda * params.comissaoPct);
  const impostoValor = Math.round(precoVenda * params.config.impostoPct);
  const lucro = precoVenda - comissaoValor - custoEnvioValor - impostoValor - params.custoCompra - params.custoEmbalagem;
  return precoVenda === 0 ? 0 : lucro / precoVenda;
}

function diagnosticarCruzamento(
  precoVenda: number,
  custoEnvioAtual: CustoEnvio,
  margemAtual: number,
  params: ParametrosCalculo,
): DiagnosticoCruzamento {
  const precoAlternativo = params.config.limiteFreteGratis + CENTAVOS_ACIMA_DO_LIMITE_PARA_SUGESTAO;
  const alternativo = calcularParaPreco(precoAlternativo, params);

  if (!alternativo.custoEnvio.confiavel) {
    return { confiavel: false, faltando: alternativo.custoEnvio.faltando ?? "não foi possível avaliar o cruzamento" };
  }

  const margemAlternativaSemDegrau = margemComCustoEnvio(precoAlternativo, custoEnvioAtual.valor, params);

  return {
    confiavel: true,
    margemAtual,
    precoAlternativo,
    margemAlternativa: alternativo.margemLiquida,
    margemAlternativaSemDegrau,
    custoEnvioAlternativo: alternativo.custoEnvio,
    degrauCustoEnvio: alternativo.custoEnvio.valor - custoEnvioAtual.valor,
  };
}

function classificarEstado(
  precoVenda: number,
  custoEnvioAtual: CustoEnvio,
  lucroLiquido: number,
  margemLiquida: number,
  params: ParametrosCalculo,
): { estado: EstadoMargem; diagnostico?: DiagnosticoCruzamento } {
  // 1. Sem custo de envio confiável, nada mais importa: não fingir margem.
  if (!custoEnvioAtual.confiavel) {
    return { estado: "INDETERMINADO" };
  }

  const alvo = params.config.margemAlvoPct;

  // Diagnóstico de cruzamento é útil sempre que preço < limite, independente
  // do estado de margem (inclusive OK/BOA) — computado uma vez, reusado.
  const diagnostico =
    precoVenda < params.config.limiteFreteGratis
      ? diagnosticarCruzamento(precoVenda, custoEnvioAtual, margemLiquida, params)
      : undefined;

  // 2. Prejuízo.
  if (lucroLiquido <= 0) {
    return { estado: "PREJUIZO", diagnostico };
  }

  // 3. Margem já bate a meta — nem entra na cadeia de zona morta.
  if (margemLiquida >= alvo) {
    return { estado: margemLiquida >= alvo + MARGEM_BOA_BUFFER_PCT ? "BOA" : "OK", diagnostico };
  }

  // 4. Já está no preço livre de frete grátis ou acima: zona morta não se
  // aplica (cruzar "pra cima" não existe, já está lá; e custoEnvioAlternativo
  // significaria BAIXAR o preço, o que não é a pergunta que essa análise responde).
  if (precoVenda >= params.config.limiteFreteGratis) {
    return { estado: "ABAIXO_DA_META" };
  }

  // 5. Cruzamento não avaliável (tabela sem linha pro preço alternativo).
  if (!diagnostico || !diagnostico.confiavel) {
    return { estado: "ABAIXO_DA_META", diagnostico };
  }

  // 6. Nem sem o degrau do frete a meta seria batida — problema é o custo
  // do produto, não o frete. Cruzar pode ajudar ou não, mas não resolve.
  if (diagnostico.margemAlternativaSemDegrau < alvo) {
    return { estado: "RUIM_ESTRUTURAL", diagnostico };
  }

  // 7/8. Cruzar precisa valer a pena de verdade (ganho mínimo em pontos
  // percentuais), não só ser tecnicamente melhor por uma fração.
  const ganho = diagnostico.margemAlternativa - margemLiquida;
  if (ganho >= params.config.ganhoMinimoPct) {
    return { estado: "ZONA_MORTA", diagnostico };
  }
  return { estado: "ZONA_MORTA_SEM_SAIDA", diagnostico };
}

export function calcularParaPreco(precoVenda: number, params: ParametrosCalculo): ResultadoPreco {
  const { config } = params;
  const custoEnvio = calcularCustoEnvio({
    pesoRealG: params.pesoRealG,
    dimensoesCm: params.dimensoesCm,
    precoVenda,
    modalidade: params.modalidade,
    reputacao: config.reputacao,
    tabela: params.tabela,
    divisorCubagem: config.divisorCubagem,
  });

  const comissaoValor = Math.round(precoVenda * params.comissaoPct);
  const impostoValor = Math.round(precoVenda * config.impostoPct);
  const lucroLiquido = precoVenda - comissaoValor - custoEnvio.valor - impostoValor - params.custoCompra - params.custoEmbalagem;
  const margemLiquida = precoVenda === 0 ? 0 : lucroLiquido / precoVenda;

  const { estado, diagnostico } = classificarEstado(precoVenda, custoEnvio, lucroLiquido, margemLiquida, params);

  return {
    precoVenda,
    comissaoPct: params.comissaoPct,
    comissaoValor,
    custoEnvio,
    impostoPct: config.impostoPct,
    impostoValor,
    custoCompra: params.custoCompra,
    custoEmbalagem: params.custoEmbalagem,
    lucroLiquido,
    margemLiquida,
    estadoMargem: estado,
    diagnosticoCruzamento: diagnostico,
  };
}

function resolverPrecoPorMargem(margemDesejadaPct: number, params: ParametrosCalculo): ResultadoPrecoSugerido {
  const { config } = params;
  const denominador = 1 - params.comissaoPct - config.impostoPct - margemDesejadaPct;

  if (denominador <= 0) {
    return { status: "denominador_invalido" };
  }

  const { pesoCobravelG, conhecido } = resolverPesoCobravel(params.pesoRealG, params.dimensoesCm, config.divisorCubagem);
  if (!conhecido) {
    return { status: "sem_dados_confiaveis", faltando: "peso ou dimensões do produto" };
  }

  const baseCusto = params.custoCompra + params.custoEmbalagem;

  // Custo de envio é uma função em degraus do preço (a tabela), não linear —
  // generaliza o antigo "dois candidatos" pra N candidatos, um por faixa de
  // preço aplicável a esse peso/modalidade/reputação, testando autoconsistência.
  const linhasAplicaveis = params.tabela
    .filter(
      (l) =>
        l.modalidade === params.modalidade &&
        l.reputacao === config.reputacao &&
        pesoCobravelG >= l.pesoMinG &&
        pesoCobravelG < l.pesoMaxG,
    )
    .sort((a, b) => a.precoMin - b.precoMin);

  for (const linha of linhasAplicaveis) {
    const precoCandidato = Math.round((baseCusto + linha.custo) / denominador);
    if (precoCandidato >= linha.precoMin && precoCandidato < linha.precoMax) {
      return { status: "ok", ...calcularParaPreco(precoCandidato, params) };
    }
  }

  return {
    status: "sem_dados_confiaveis",
    faltando: "nenhuma faixa de frete disponível pra esse peso produz um preço autoconsistente com a margem desejada",
  };
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
