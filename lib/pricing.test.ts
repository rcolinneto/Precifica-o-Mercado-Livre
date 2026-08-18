import { describe, expect, it } from "vitest";
import {
  calcularCustoEnvio,
  calcularParaPreco,
  calcularPrecoSugerido,
  deveSugerirKit,
  precoParaMargemAlvo,
  type ConfigPrecificacao,
  type LinhaTabelaFrete,
  type ParametrosCalculo,
} from "./pricing";

// Tabela de referência pra teste: 4 faixas de preço (as mesmas do seed da
// migration, em centavos) x 2 faixas de peso (leve e pesada), modalidade
// 'agencia', reputação 'sem_reputacao'. Números redondos, fáceis de
// conferir na mão — não refletem a tabela real do ML.
const tabelaLeve: LinhaTabelaFrete[] = [
  { modalidade: "agencia", reputacao: "sem_reputacao", pesoMinG: 0, pesoMaxG: 301, precoMin: 0, precoMax: 1900, custo: 565 },
  { modalidade: "agencia", reputacao: "sem_reputacao", pesoMinG: 0, pesoMaxG: 301, precoMin: 1900, precoMax: 4900, custo: 655 },
  { modalidade: "agencia", reputacao: "sem_reputacao", pesoMinG: 0, pesoMaxG: 301, precoMin: 4900, precoMax: 7900, custo: 775 },
  { modalidade: "agencia", reputacao: "sem_reputacao", pesoMinG: 0, pesoMaxG: 301, precoMin: 7900, precoMax: 9999999, custo: 1235 },
];

const tabelaPesada: LinhaTabelaFrete[] = [
  { modalidade: "agencia", reputacao: "sem_reputacao", pesoMinG: 10000, pesoMaxG: 999999999, precoMin: 0, precoMax: 1900, custo: 705 },
  { modalidade: "agencia", reputacao: "sem_reputacao", pesoMinG: 10000, pesoMaxG: 999999999, precoMin: 1900, precoMax: 4900, custo: 955 },
  { modalidade: "agencia", reputacao: "sem_reputacao", pesoMinG: 10000, pesoMaxG: 999999999, precoMin: 4900, precoMax: 7900, custo: 1095 },
  { modalidade: "agencia", reputacao: "sem_reputacao", pesoMinG: 10000, pesoMaxG: 999999999, precoMin: 7900, precoMax: 9999999, custo: 4125 },
];

const tabelaCompleta = [...tabelaLeve, ...tabelaPesada];

const configBase: ConfigPrecificacao = {
  limiteFreteGratis: 7900,
  divisorCubagem: 6000,
  impostoPct: 0.04,
  margemAlvoPct: 0.15,
  reputacao: "sem_reputacao",
  ganhoMinimoPct: 0.03, // 3 pontos percentuais
};

function params(overrides: Partial<ParametrosCalculo> = {}): ParametrosCalculo {
  return {
    custoCompra: 500,
    custoEmbalagem: 0,
    pesoRealG: 200,
    dimensoesCm: null,
    modalidade: "agencia",
    comissaoPct: 0.12,
    tabela: tabelaCompleta,
    config: configBase,
    ...overrides,
  };
}

describe("calcularCustoEnvio", () => {
  it("peso real vence cubagem quando é o maior dos dois", () => {
    // peso real 250g > peso cubado (10x10x10/6000 = 0,1667kg = 167g)
    const r = calcularCustoEnvio({
      pesoRealG: 250,
      dimensoesCm: { comprimento: 10, largura: 10, altura: 10 },
      precoVenda: 3000,
      modalidade: "agencia",
      reputacao: "sem_reputacao",
      tabela: tabelaLeve,
      divisorCubagem: 6000,
    });
    expect(r.pesoCobravelG).toBe(250);
    expect(r.usouCubagem).toBe(false);
    expect(r.confiavel).toBe(true);
    expect(r.origem).toBe("tabela");
  });

  it("cubagem vence peso real quando a caixa é grande e leve", () => {
    // peso real 100g, mas caixa 30x30x30 -> peso cubado = 27000/6000 = 4,5kg = 4500g
    const r = calcularCustoEnvio({
      pesoRealG: 100,
      dimensoesCm: { comprimento: 30, largura: 30, altura: 30 },
      precoVenda: 3000,
      modalidade: "agencia",
      reputacao: "sem_reputacao",
      tabela: tabelaLeve,
      divisorCubagem: 6000,
    });
    expect(r.pesoCobravelG).toBe(4500);
    expect(r.usouCubagem).toBe(true);
    // 4500g não bate em nenhuma faixa das nossas duas tabelas de teste (leve é só até 300g)
    expect(r.confiavel).toBe(false);
  });

  it("peso e dimensões faltando -> confiavel: false, nunca custo 0 silencioso", () => {
    const r = calcularCustoEnvio({
      pesoRealG: null,
      dimensoesCm: null,
      precoVenda: 3000,
      modalidade: "agencia",
      reputacao: "sem_reputacao",
      tabela: tabelaLeve,
      divisorCubagem: 6000,
    });
    expect(r.confiavel).toBe(false);
    expect(r.faltando).toBeTruthy();
  });

  it("faixa inexistente na tabela -> confiavel: false com mensagem explicando o que faltou", () => {
    const r = calcularCustoEnvio({
      pesoRealG: 200,
      dimensoesCm: null,
      precoVenda: 3000,
      modalidade: "full", // só temos linhas de 'agencia' nas tabelas de teste
      reputacao: "sem_reputacao",
      tabela: tabelaLeve,
      divisorCubagem: 6000,
    });
    expect(r.confiavel).toBe(false);
    expect(r.faltando).toMatch(/full/);
  });

  it("produto exatamente em R$79,00 cai na faixa de preço 79+, não na de baixo", () => {
    const emCimaDoLimite = calcularCustoEnvio({
      pesoRealG: 200,
      dimensoesCm: null,
      precoVenda: 7900,
      modalidade: "agencia",
      reputacao: "sem_reputacao",
      tabela: tabelaLeve,
      divisorCubagem: 6000,
    });
    const umCentavoAbaixo = calcularCustoEnvio({
      pesoRealG: 200,
      dimensoesCm: null,
      precoVenda: 7899,
      modalidade: "agencia",
      reputacao: "sem_reputacao",
      tabela: tabelaLeve,
      divisorCubagem: 6000,
    });
    expect(emCimaDoLimite.valor).toBe(1235);
    expect(umCentavoAbaixo.valor).toBe(775);
  });

  it("R$79,00 e R$79,90 caem na mesma faixa (sugestão pode exibir 79,90 com o custo calculado em 79,00)", () => {
    const a = calcularCustoEnvio({
      pesoRealG: 200, dimensoesCm: null, precoVenda: 7900,
      modalidade: "agencia", reputacao: "sem_reputacao", tabela: tabelaLeve, divisorCubagem: 6000,
    });
    const b = calcularCustoEnvio({
      pesoRealG: 200, dimensoesCm: null, precoVenda: 7990,
      modalidade: "agencia", reputacao: "sem_reputacao", tabela: tabelaLeve, divisorCubagem: 6000,
    });
    expect(a.valor).toBe(b.valor);
  });

  it("intervalo meio-aberto: preço exatamente no teto de uma faixa cai na PRÓXIMA faixa", () => {
    const tabelaMinima: LinhaTabelaFrete[] = [
      { modalidade: "agencia", reputacao: "sem_reputacao", pesoMinG: 0, pesoMaxG: 1000, precoMin: 0, precoMax: 1000, custo: 100 },
      { modalidade: "agencia", reputacao: "sem_reputacao", pesoMinG: 0, pesoMaxG: 1000, precoMin: 1000, precoMax: 2000, custo: 200 },
    ];
    const noTeto = calcularCustoEnvio({
      pesoRealG: 200, dimensoesCm: null, precoVenda: 1000,
      modalidade: "agencia", reputacao: "sem_reputacao", tabela: tabelaMinima, divisorCubagem: 6000,
    });
    const umAbaixoDoTeto = calcularCustoEnvio({
      pesoRealG: 200, dimensoesCm: null, precoVenda: 999,
      modalidade: "agencia", reputacao: "sem_reputacao", tabela: tabelaMinima, divisorCubagem: 6000,
    });
    expect(noTeto.valor).toBe(200); // entrou na segunda faixa
    expect(umAbaixoDoTeto.valor).toBe(100); // ficou na primeira
  });

  it("arredondar peso cubado pra cima pode empurrar o produto pra fora da faixa (intencional)", () => {
    // 30 x 20 x 3.001cm = 1800.6cm³ / 6000 = 0,3001kg = 300,1g -> arredonda pra 301g
    const r = calcularCustoEnvio({
      pesoRealG: 50, // peso real bem menor, cubagem que decide
      dimensoesCm: { comprimento: 30, largura: 20, altura: 3.001 },
      precoVenda: 3000,
      modalidade: "agencia",
      reputacao: "sem_reputacao",
      tabela: tabelaLeve, // só tem a faixa "até 300g" (pesoMaxG: 301)
      divisorCubagem: 6000,
    });
    expect(r.pesoCobravelG).toBe(301);
    expect(r.usouCubagem).toBe(true);
    // 301 não é < 301 -> sai da única faixa de peso que existe na tabela de teste
    expect(r.confiavel).toBe(false);
  });
});

describe("calcularParaPreco — INDETERMINADO tem prioridade sobre tudo", () => {
  it("sem peso nem dimensão -> INDETERMINADO, sem diagnóstico, nunca finge que a margem é boa", () => {
    const r = calcularParaPreco(3000, params({ pesoRealG: null, dimensoesCm: null, custoCompra: 100 }));
    expect(r.estadoMargem).toBe("INDETERMINADO");
    expect(r.custoEnvio.confiavel).toBe(false);
    expect(r.diagnosticoCruzamento).toBeUndefined();
  });
});

describe("calcularParaPreco — guardas de PREJUIZO e margem já OK", () => {
  it("lucro negativo -> PREJUIZO", () => {
    const r = calcularParaPreco(3000, params({ custoCompra: 5000 }));
    expect(r.lucroLiquido).toBeLessThan(0);
    expect(r.estadoMargem).toBe("PREJUIZO");
  });

  it("margem já bate a meta -> OK/BOA direto, mas ainda expõe o degrau (preço abaixo do limite)", () => {
    const r = calcularParaPreco(3000, params({ custoCompra: 500 }));
    expect(["OK", "BOA"]).toContain(r.estadoMargem);
    expect(r.margemLiquida).toBeGreaterThanOrEqual(configBase.margemAlvoPct);
    expect(r.diagnosticoCruzamento).toBeDefined();
    if (r.diagnosticoCruzamento?.confiavel) {
      expect(typeof r.diagnosticoCruzamento.degrauCustoEnvio).toBe("number");
    }
  });
});

describe("calcularParaPreco — guarda: produto já acima do limite não entra em zona morta", () => {
  it("preço acima de R$79 com margem ruim -> ABAIXO_DA_META, nunca ZONA_MORTA_SEM_SAIDA", () => {
    // preco 12000 (R$120), custo alto o bastante pra ficar abaixo da meta mas lucrativo
    const r = calcularParaPreco(12000, params({ custoCompra: 8000 }));
    expect(r.lucroLiquido).toBeGreaterThan(0);
    expect(r.margemLiquida).toBeLessThan(configBase.margemAlvoPct);
    expect(r.estadoMargem).toBe("ABAIXO_DA_META");
    expect(r.diagnosticoCruzamento).toBeUndefined();
  });
});

describe("calcularParaPreco — RUIM_ESTRUTURAL", () => {
  it("mesmo sem o degrau do frete a margem não bateria a meta -> RUIM_ESTRUTURAL, nunca sugere kit", () => {
    const r = calcularParaPreco(7000, params({ custoCompra: 4900 }));
    expect(r.lucroLiquido).toBeGreaterThan(0);
    expect(r.estadoMargem).toBe("RUIM_ESTRUTURAL");
    expect(deveSugerirKit(r.estadoMargem)).toBe(false);
    expect(r.diagnosticoCruzamento?.confiavel).toBe(true);
  });
});

describe("calcularParaPreco — ganho mínimo em pontos percentuais decide ZONA_MORTA vs SEM_SAIDA", () => {
  it("ganho abaixo do mínimo configurado (3pp) -> ZONA_MORTA_SEM_SAIDA", () => {
    const r = calcularParaPreco(7000, params({ custoCompra: 4100 }));
    expect(r.estadoMargem).toBe("ZONA_MORTA_SEM_SAIDA");
    expect(deveSugerirKit(r.estadoMargem)).toBe(false);
    const diag = r.diagnosticoCruzamento;
    expect(diag?.confiavel).toBe(true);
    if (diag?.confiavel) {
      const ganho = diag.margemAlternativa - r.margemLiquida;
      expect(ganho).toBeGreaterThan(0);
      expect(ganho).toBeLessThan(configBase.ganhoMinimoPct);
    }
  });

  it("ganho acima do mínimo configurado (3pp) -> ZONA_MORTA", () => {
    const r = calcularParaPreco(7000, params({ custoCompra: 4300 }));
    expect(r.estadoMargem).toBe("ZONA_MORTA");
    expect(deveSugerirKit(r.estadoMargem)).toBe(true);
    const diag = r.diagnosticoCruzamento;
    expect(diag?.confiavel).toBe(true);
    if (diag?.confiavel) {
      const ganho = diag.margemAlternativa - r.margemLiquida;
      expect(ganho).toBeGreaterThanOrEqual(configBase.ganhoMinimoPct);
      expect(diag.precoAlternativo).toBe(7990); // exibido como 79,90, não 79,00
    }
  });
});

describe("calcularParaPreco — cruzamento não avaliável", () => {
  it("custo de envio na alternativa não é confiável -> ABAIXO_DA_META com aviso, não RUIM_ESTRUTURAL nem ZONA_MORTA", () => {
    // tabela só cobre a faixa de preço atual (49-78,99), não tem linha pra 79+
    const tabelaComBuraco: LinhaTabelaFrete[] = [
      { modalidade: "agencia", reputacao: "sem_reputacao", pesoMinG: 0, pesoMaxG: 301, precoMin: 4900, precoMax: 7900, custo: 775 },
    ];
    const r = calcularParaPreco(7000, params({ custoCompra: 4900, tabela: tabelaComBuraco }));
    expect(r.custoEnvio.confiavel).toBe(true); // o preço ATUAL tem linha
    expect(r.estadoMargem).toBe("ABAIXO_DA_META");
    expect(r.diagnosticoCruzamento?.confiavel).toBe(false);
  });
});

describe("calcularPrecoSugerido / precoParaMargemAlvo", () => {
  it("denominador inválido (comissão + imposto + margem >= 100%) não quebra nem retorna Infinity", () => {
    const r = precoParaMargemAlvo(0.9, params({ comissaoPct: 0.12 }));
    expect(r.status).toBe("denominador_invalido");
  });

  it("sem peso nem dimensão -> sem_dados_confiaveis, não inventa preço", () => {
    const r = calcularPrecoSugerido(params({ pesoRealG: null, dimensoesCm: null }));
    expect(r.status).toBe("sem_dados_confiaveis");
  });

  it("resolve um preço autoconsistente com a tabela e reproduz a margem alvo", () => {
    const p = params({ custoCompra: 500 });
    const r = calcularPrecoSugerido(p);
    expect(r.status).toBe("ok");
    if (r.status === "ok") {
      expect(r.margemLiquida).toBeCloseTo(configBase.margemAlvoPct, 2);
      const conferencia = calcularParaPreco(r.precoVenda, p);
      expect(conferencia.margemLiquida).toBeCloseTo(configBase.margemAlvoPct, 2);
    }
  });
});
