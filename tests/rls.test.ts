import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Teste de INTEGRAÇÃO contra o banco real (não é um teste puro como
// lib/pricing.test.ts). Prova que a RLS realmente isola usuário A de
// usuário B em cada tabela — não confia só na leitura da migration.
//
// Requer NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY e
// SUPABASE_SERVICE_ROLE_KEY em .env.local. Sem essas variáveis (ex: clone
// novo do repo, CI sem secrets), o suite inteiro é pulado em vez de falhar.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const hasCredentials = Boolean(url && anonKey && serviceKey);

type SimpleTable = "categorias_ml" | "produtos" | "kits";

const simpleRows: Record<SimpleTable, Record<string, unknown>> = {
  categorias_ml: { nome: "Categoria RLS Test", comissao_classico_pct: 0.12, comissao_premium_pct: 0.17 },
  produtos: { nome: "Produto RLS Test", custo_compra: 10.5 },
  kits: { nome: "Kit RLS Test" },
};

describe.skipIf(!hasCredentials)("RLS — isolamento entre usuários (integração, banco real)", () => {
  let admin: SupabaseClient;
  let clientA: SupabaseClient;
  let clientB: SupabaseClient;
  let userAId: string;
  let userBId: string;

  const suffix = Date.now();
  const emailA = `rls-test-a-${suffix}@precificador-dipil.test`;
  const emailB = `rls-test-b-${suffix}@precificador-dipil.test`;
  const password = `senha-teste-${suffix}-!Aa1`;

  beforeAll(async () => {
    admin = createClient(url!, serviceKey!, { auth: { autoRefreshToken: false, persistSession: false } });

    const { data: createdA, error: errA } = await admin.auth.admin.createUser({
      email: emailA,
      password,
      email_confirm: true,
    });
    if (errA) throw errA;
    const { data: createdB, error: errB } = await admin.auth.admin.createUser({
      email: emailB,
      password,
      email_confirm: true,
    });
    if (errB) throw errB;
    userAId = createdA.user!.id;
    userBId = createdB.user!.id;

    clientA = createClient(url!, anonKey!, { auth: { autoRefreshToken: false, persistSession: false } });
    clientB = createClient(url!, anonKey!, { auth: { autoRefreshToken: false, persistSession: false } });

    const { error: signInErrA } = await clientA.auth.signInWithPassword({ email: emailA, password });
    if (signInErrA) throw signInErrA;
    const { error: signInErrB } = await clientB.auth.signInWithPassword({ email: emailB, password });
    if (signInErrB) throw signInErrB;
  }, 30000);

  afterAll(async () => {
    // on delete cascade em todas as tabelas: apagar os usuários limpa tudo
    // que os testes criaram (produtos, kits, precificacoes, categorias, etc).
    if (userAId) await admin.auth.admin.deleteUser(userAId);
    if (userBId) await admin.auth.admin.deleteUser(userBId);
  });

  it.each(Object.keys(simpleRows) as SimpleTable[])(
    "usuário B não enxerga, edita nem apaga linha de %s criada pelo usuário A",
    async (table) => {
      const { data: inserted, error: insertError } = await clientA
        .from(table)
        .insert({ ...simpleRows[table], user_id: userAId })
        .select()
        .single();
      expect(insertError).toBeNull();
      expect(inserted).toBeTruthy();

      const { data: seenByA } = await clientA.from(table).select("id").eq("id", inserted!.id);
      expect(seenByA).toHaveLength(1);

      const { data: seenByB } = await clientB.from(table).select("id").eq("id", inserted!.id);
      expect(seenByB).toHaveLength(0);

      const { data: updatedByB } = await clientB
        .from(table)
        .update({ nome: "hackeado" })
        .eq("id", inserted!.id)
        .select();
      expect(updatedByB).toHaveLength(0);

      const { data: deletedByB } = await clientB.from(table).delete().eq("id", inserted!.id).select();
      expect(deletedByB).toHaveLength(0);

      // a linha de A continua intacta depois das tentativas de B
      const { data: stillThere } = await clientA.from(table).select("id, nome").eq("id", inserted!.id);
      expect(stillThere).toHaveLength(1);
      const [linhaIntacta] = stillThere ?? [];
      expect(linhaIntacta?.nome).toBe(simpleRows[table].nome);
    },
  );

  it("usuário B não enxerga a configuracoes de A (linha criada automaticamente no signup)", async () => {
    const { data: seenByB } = await clientB.from("configuracoes").select("user_id");
    expect(seenByB).toHaveLength(1); // só a própria linha de B
    expect(seenByB!.every((row) => row.user_id === userBId)).toBe(true);

    const { data: seenByA } = await clientA.from("configuracoes").select("user_id");
    expect(seenByA).toHaveLength(1);
    expect(seenByA!.every((row) => row.user_id === userAId)).toBe(true);
  });

  it("usuário B não enxerga precificacoes de A", async () => {
    const { data: produtoA, error: produtoError } = await clientA
      .from("produtos")
      .insert({ nome: "Produto p/ precificação RLS", custo_compra: 10, user_id: userAId })
      .select()
      .single();
    expect(produtoError).toBeNull();

    const { data: precificacaoA, error: precoError } = await clientA
      .from("precificacoes")
      .insert({
        user_id: userAId,
        produto_id: produtoA!.id,
        preco_venda: 50,
        tipo_anuncio: "classico",
        comissao_pct: 0.12,
        custo_envio: 6.5,
        peso_cobravel_g: 200,
        modalidade: "agencia",
        reputacao: "sem_reputacao",
        origem_custo_envio: "tabela",
        limite_frete_gratis: 79,
        imposto_pct: 0.04,
        margem_alvo_pct: 0.15,
        custo_compra: 10,
        custo_embalagem: 0,
        estado_margem: "OK",
      })
      .select()
      .single();
    expect(precoError).toBeNull();

    const { data: seenByB } = await clientB.from("precificacoes").select("id").eq("id", precificacaoA!.id);
    expect(seenByB).toHaveLength(0);

    const { data: seenByA } = await clientA.from("precificacoes").select("id").eq("id", precificacaoA!.id);
    expect(seenByA).toHaveLength(1);
  });

  it("usuário B não enxerga nem consegue inserir kit_itens no kit de A (política via EXISTS)", async () => {
    const { data: produtoA } = await clientA
      .from("produtos")
      .insert({ nome: "Produto p/ kit RLS", custo_compra: 5, user_id: userAId })
      .select()
      .single();
    const { data: kitA } = await clientA
      .from("kits")
      .insert({ nome: "Kit de A RLS", user_id: userAId })
      .select()
      .single();
    const { data: itemA, error: itemError } = await clientA
      .from("kit_itens")
      .insert({ kit_id: kitA!.id, produto_id: produtoA!.id, quantidade: 2 })
      .select()
      .single();
    expect(itemError).toBeNull();

    const { data: seenByB } = await clientB.from("kit_itens").select("id").eq("id", itemA!.id);
    expect(seenByB).toHaveLength(0);

    // B tenta inserir um item no kit de A: RLS bloqueia pelo WITH CHECK,
    // isso é diferente de select/update/delete — gera erro, não linha vazia.
    const { error: insertByBError } = await clientB
      .from("kit_itens")
      .insert({ kit_id: kitA!.id, produto_id: produtoA!.id, quantidade: 1 });
    expect(insertByBError).not.toBeNull();
  });

  it("excluir um produto com precificação salva funciona e preserva o histórico (regressão)", async () => {
    // Bug real encontrado em produção: precificacoes_produto_ou_kit exigia
    // EXATAMENTE UM de produto_id/kit_id. produto_id tem "on delete set
    // null" pra preservar histórico, mas isso deixava os dois nulos ao
    // mesmo tempo numa precificação sem kit — violava a constraint e
    // travava a exclusão do produto inteira. Corrigido pra "no máximo um".
    const { data: produtoA } = await clientA
      .from("produtos")
      .insert({ nome: "Produto p/ excluir RLS", custo_compra: 10, user_id: userAId })
      .select()
      .single();

    const { data: precificacaoA, error: precoError } = await clientA
      .from("precificacoes")
      .insert({
        user_id: userAId,
        produto_id: produtoA!.id,
        preco_venda: 50,
        tipo_anuncio: "classico",
        comissao_pct: 0.12,
        custo_envio: 6.5,
        peso_cobravel_g: 200,
        modalidade: "agencia",
        reputacao: "sem_reputacao",
        origem_custo_envio: "tabela",
        limite_frete_gratis: 79,
        imposto_pct: 0.04,
        margem_alvo_pct: 0.15,
        custo_compra: 10,
        custo_embalagem: 0,
        estado_margem: "OK",
      })
      .select()
      .single();
    expect(precoError).toBeNull();

    const { error: deleteError } = await clientA.from("produtos").delete().eq("id", produtoA!.id);
    expect(deleteError).toBeNull();

    const { data: sobrevivente } = await clientA
      .from("precificacoes")
      .select("id, produto_id")
      .eq("id", precificacaoA!.id)
      .single();
    expect(sobrevivente).toBeTruthy();
    expect(sobrevivente!.produto_id).toBeNull();
  });
});
