import { describe, expect, it } from "vitest";
import {
  calcularParaPreco,
  calcularPrecoSugerido,
  deveSugerirKit,
  precoParaMargemAlvo,
  type ConfigPrecificacao,
  type ParametrosCalculo,
} from "./pricing";

// Config de referência para os testes: valores redondos, fáceis de conferir
// na mão. Nada aqui reflete taxas reais do ML — isso vive em `configuracoes`
// no banco e é editável pela UI.
const configBase: ConfigPrecificacao = {
  custoFixoPadrao: 650, // R$ 6,50
  limiteCustoFixo: 7900, // R$ 79,00
  freteBase: 1500, // R$ 15,00 — frete quando preço >= limite, peso <= pesoBaseGramas
  pesoBaseGramas: 300,
  custoPorGramaAdicional: 1, // R$ 0,01 por grama acima de pesoBaseGramas
  impostoPct: 0.04,
  margemAlvoPct: 0.15,
};

function params(overrides: Partial<ParametrosCalculo> = {}): ParametrosCalculo {
  return {
    custoCompra: 1000,
    custoEmbalagem: 100,
    pesoGramas: 200,
    comissaoPct: 0.12,
    config: configBase,
    ...overrides,
  };
}

describe("calcularParaPreco — produto abaixo de R$79", () => {
  it("aplica custo fixo e não aplica frete", () => {
    const r = calcularParaPreco(3000, params());
    expect(r.custoFixoAplicado).toBe(650);
    expect(r.frete.valor).toBe(0);
  });

  it("classifica como OK ou BOA quando a margem bate a meta com folga", () => {
    const r = calcularParaPreco(3000, params());
    // lucro = 3000 - 360(comissão) - 650(fixo) - 0(frete) - 120(imposto) - 1000 - 100 = 770
    expect(r.lucroLiquido).toBe(770);
    expect(r.margemLiquida).toBeCloseTo(770 / 3000, 4);
    expect(["OK", "BOA"]).toContain(r.estadoMargem);
  });
});

describe("calcularParaPreco — limite dos R$79", () => {
  it("exatamente R$79 NÃO paga custo fixo (regra é 'a partir de')", () => {
    const r = calcularParaPreco(7900, params());
    expect(r.custoFixoAplicado).toBe(0);
  });

  it("acima de R$79 não paga custo fixo e o frete obrigatório entra", () => {
    const r = calcularParaPreco(9000, params());
    expect(r.custoFixoAplicado).toBe(0);
    expect(r.frete.valor).toBeGreaterThan(0);
    expect(r.frete.valor).toBe(1500); // peso 200g < pesoBaseGramas, fica no freteBase
  });
});

describe("calcularParaPreco — prejuízo", () => {
  it("custo de compra maior que o preço de venda dá PREJUIZO", () => {
    const r = calcularParaPreco(3000, params({ custoCompra: 5000, custoEmbalagem: 0 }));
    expect(r.lucroLiquido).toBeLessThan(0);
    expect(r.estadoMargem).toBe("PREJUIZO");
  });
});

describe("calcularParaPreco — RUIM_ESTRUTURAL", () => {
  it("quando mesmo sem custo fixo a margem não bate a meta, não sugere kit", () => {
    // preço 5000, custoCompra 3500: lucro=50 (positivo, não é PREJUIZO),
    // margemSemCustoFixo = (50+650)/5000 = 0.14 < 0.15 (meta) -> o vilão não é o custo fixo
    const r = calcularParaPreco(5000, params({ custoCompra: 3500, custoEmbalagem: 0 }));
    expect(r.lucroLiquido).toBeGreaterThan(0);
    expect(r.estadoMargem).toBe("RUIM_ESTRUTURAL");
    expect(deveSugerirKit(r.estadoMargem)).toBe(false);
  });
});

describe("calcularParaPreco — ZONA_MORTA (produto leve)", () => {
  it("custo fixo é o vilão e subir para R$79 melhora a margem real", () => {
    const p = params({ custoCompra: 2850, custoEmbalagem: 0, pesoGramas: 200 });
    const r = calcularParaPreco(5000, p);

    expect(r.margemLiquida).toBeLessThan(configBase.margemAlvoPct);
    expect(r.estadoMargem).toBe("ZONA_MORTA");
    expect(deveSugerirKit(r.estadoMargem)).toBe(true);

    expect(r.diagnosticoZonaMorta).toBeDefined();
    const diag = r.diagnosticoZonaMorta!;
    expect(diag.margemSemCustoFixo).toBeGreaterThanOrEqual(configBase.margemAlvoPct);
    expect(diag.precoAlternativo).toBe(configBase.limiteCustoFixo);
    expect(diag.margemAlternativa).toBeGreaterThan(r.margemLiquida);
  });
});

describe("calcularParaPreco — ZONA_MORTA_SEM_SAIDA (produto pesado)", () => {
  it("produto de 3kg: subir para R$79 piora a margem por causa do frete", () => {
    // mesmos custos do teste de ZONA_MORTA, só o peso muda (200g -> 3000g)
    const p = params({ custoCompra: 2850, custoEmbalagem: 0, pesoGramas: 3000 });
    const r = calcularParaPreco(5000, p);

    expect(r.estadoMargem).toBe("ZONA_MORTA_SEM_SAIDA");
    expect(deveSugerirKit(r.estadoMargem)).toBe(false);

    const diag = r.diagnosticoZonaMorta!;
    // frete no preço alternativo: 1500 (base) + (3000-300)*1 = 4200 centavos
    expect(diag.freteAlternativo.valor).toBe(4200);
    expect(diag.margemAlternativa).toBeLessThanOrEqual(r.margemLiquida);
  });

  it("sinaliza frete não confiável quando o produto não tem peso cadastrado", () => {
    const p = params({ pesoGramas: 0 });
    const r = calcularParaPreco(9000, p); // acima do limite, frete entra
    expect(r.frete.confiavel).toBe(false);
  });
});

describe("calcularPrecoSugerido — denominador inválido", () => {
  it("comissão + imposto + margem >= 100% não quebra nem retorna Infinity", () => {
    const configInvalida: ConfigPrecificacao = {
      ...configBase,
      margemAlvoPct: 0.25,
    };
    const r = calcularPrecoSugerido(
      params({ comissaoPct: 0.5, config: { ...configInvalida, impostoPct: 0.3 } }),
    );
    expect(r.denominadorInvalido).toBe(true);
    // discriminated union: nenhum outro campo deve ser acessível/necessário aqui
    expect(Object.keys(r)).toEqual(["denominadorInvalido"]);
  });

  it("precoParaMargemAlvo também retorna denominadorInvalido em vez de quebrar", () => {
    const r = precoParaMargemAlvo(0.9, params({ comissaoPct: 0.12 }));
    expect(r.denominadorInvalido).toBe(true);
  });
});

describe("calcularPrecoSugerido — resolve o preço certo dos dois lados do limite", () => {
  it("produto barato: preço sugerido fica abaixo de R$79 e bate a margem alvo", () => {
    const r = calcularPrecoSugerido(
      params({ custoCompra: 500, custoEmbalagem: 50, pesoGramas: 200 }),
    );
    expect(r.denominadorInvalido).toBe(false);
    if (r.denominadorInvalido) throw new Error("unreachable");

    expect(r.precoVenda).toBeLessThan(configBase.limiteCustoFixo);
    expect(r.margemLiquida).toBeCloseTo(configBase.margemAlvoPct, 2);

    // o resultado precisa ser autoconsistente: recalcular no preço sugerido
    // tem que reproduzir a mesma margem
    const conferencia = calcularParaPreco(r.precoVenda, params({ custoCompra: 500, custoEmbalagem: 50, pesoGramas: 200 }));
    expect(conferencia.margemLiquida).toBeCloseTo(configBase.margemAlvoPct, 2);
  });

  it("produto caro: preço sugerido cruza para R$79+ e passa a pagar frete em vez de custo fixo", () => {
    const p = params({ custoCompra: 6000, custoEmbalagem: 200, pesoGramas: 200 });
    const r = calcularPrecoSugerido(p);
    expect(r.denominadorInvalido).toBe(false);
    if (r.denominadorInvalido) throw new Error("unreachable");

    expect(r.precoVenda).toBeGreaterThanOrEqual(configBase.limiteCustoFixo);
    expect(r.custoFixoAplicado).toBe(0);
    expect(r.frete.valor).toBeGreaterThan(0);
    expect(r.margemLiquida).toBeCloseTo(configBase.margemAlvoPct, 2);
  });
});
