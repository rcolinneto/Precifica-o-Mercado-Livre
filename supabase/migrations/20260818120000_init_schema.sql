-- Precificador Mercado Livre — schema inicial
-- Convenções:
--   * Todo valor monetário é numeric(10,2) em reais (nunca float).
--   * Todo percentual é numeric(6,4) como fração 0-1 (ex: 0.1200 = 12%).
--   * `configuracoes` guarda os valores ATUAIS/PADRÃO (editáveis a qualquer momento).
--   * `precificacoes` guarda os valores VIGENTES NA DATA da simulação (snapshot).
--     Editar `configuracoes` nunca deve alterar o resultado de uma simulação já salva.

create extension if not exists pgcrypto;

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- =========================================================================
-- categorias_ml — comissão do Mercado Livre varia por categoria
-- =========================================================================
create table categorias_ml (
  id                      uuid primary key default gen_random_uuid(),
  user_id                 uuid not null references auth.users(id) on delete cascade,
  nome                    text not null,
  comissao_classico_pct   numeric(6,4) not null check (comissao_classico_pct >= 0 and comissao_classico_pct < 1),
  comissao_premium_pct    numeric(6,4) not null check (comissao_premium_pct >= 0 and comissao_premium_pct < 1),
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  unique (user_id, nome)
);

create index categorias_ml_user_id_idx on categorias_ml(user_id);

create trigger trg_categorias_ml_updated_at
  before update on categorias_ml
  for each row execute function set_updated_at();

-- =========================================================================
-- produtos
-- =========================================================================
create table produtos (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  nome              text not null,
  sku               text,
  marca             text not null default 'Dipil',
  categoria_id      uuid references categorias_ml(id) on delete set null,
  custo_compra      numeric(10,2) not null check (custo_compra >= 0),
  custo_embalagem   numeric(10,2) not null default 0 check (custo_embalagem >= 0),
  peso_gramas       integer not null default 0 check (peso_gramas >= 0),
  ativo             boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (user_id, sku)
);

create index produtos_user_id_idx on produtos(user_id);
create index produtos_categoria_id_idx on produtos(categoria_id);

create trigger trg_produtos_updated_at
  before update on produtos
  for each row execute function set_updated_at();

-- =========================================================================
-- configuracoes — uma linha por usuário, valores padrão editáveis pela UI
-- =========================================================================
create table configuracoes (
  id                              uuid primary key default gen_random_uuid(),
  user_id                         uuid not null unique references auth.users(id) on delete cascade,
  comissao_classico_pct_padrao    numeric(6,4) not null default 0.1200 check (comissao_classico_pct_padrao >= 0 and comissao_classico_pct_padrao < 1),
  comissao_premium_pct_padrao     numeric(6,4) not null default 0.1700 check (comissao_premium_pct_padrao >= 0 and comissao_premium_pct_padrao < 1),
  custo_fixo_padrao               numeric(10,2) not null default 6.50 check (custo_fixo_padrao >= 0),
  limite_custo_fixo               numeric(10,2) not null default 79.00 check (limite_custo_fixo > 0),
  -- Frete = frete_base + max(0, peso_gramas - peso_base_gramas) * custo_por_grama_adicional,
  -- aplicado apenas quando preco >= limite_custo_fixo. Fórmula linear simples em vez de
  -- tabela de faixas: continua editável por 3 números na UI, mas deixa de ser um valor
  -- cego a peso — produtos pesados/volumosos refletem um frete real maior.
  frete_base                      numeric(10,2) not null default 0 check (frete_base >= 0),
  peso_base_gramas                integer not null default 0 check (peso_base_gramas >= 0),
  custo_por_grama_adicional       numeric(10,4) not null default 0 check (custo_por_grama_adicional >= 0),
  imposto_pct                     numeric(6,4) not null default 0.0400 check (imposto_pct >= 0 and imposto_pct < 1),
  margem_alvo_pct                 numeric(6,4) not null default 0.1500 check (margem_alvo_pct >= 0 and margem_alvo_pct < 1),
  updated_at                      timestamptz not null default now()
);

create trigger trg_configuracoes_updated_at
  before update on configuracoes
  for each row execute function set_updated_at();

-- Cria uma linha de configuração padrão automaticamente ao criar o usuário,
-- assim a calculadora nunca fica sem parâmetros para ler.
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.configuracoes (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- =========================================================================
-- kits / kit_itens
-- =========================================================================
create table kits (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  nome        text not null,
  ativo       boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index kits_user_id_idx on kits(user_id);

create trigger trg_kits_updated_at
  before update on kits
  for each row execute function set_updated_at();

create table kit_itens (
  id           uuid primary key default gen_random_uuid(),
  kit_id       uuid not null references kits(id) on delete cascade,
  produto_id   uuid not null references produtos(id) on delete cascade,
  quantidade   integer not null default 1 check (quantidade > 0),
  unique (kit_id, produto_id)
);

create index kit_itens_kit_id_idx on kit_itens(kit_id);
create index kit_itens_produto_id_idx on kit_itens(produto_id);

-- =========================================================================
-- precificacoes — histórico de simulações salvas
--
-- Cada linha é auto-suficiente: guarda uma FOTOGRAFIA das taxas vigentes
-- no momento em que a simulação foi salva (comissão, imposto, custo fixo,
-- limite, frete, custo do produto). Isso é proposital, não redundância:
-- se você editar `configuracoes` ou o custo de um produto amanhã, o
-- histórico de hoje não pode mudar de valor. Por depender só de colunas
-- da própria linha, lucro_liquido e margem_liquida podem ser GENERATED.
-- =========================================================================
create table precificacoes (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references auth.users(id) on delete cascade,

  -- exatamente um dos dois deve estar preenchido
  produto_id            uuid references produtos(id) on delete set null,
  kit_id                uuid references kits(id) on delete set null,

  preco_venda           numeric(10,2) not null check (preco_venda >= 0),
  tipo_anuncio          text not null check (tipo_anuncio in ('classico', 'premium')),

  -- snapshot das taxas vigentes na data (não referenciam configuracoes)
  comissao_pct          numeric(6,4) not null check (comissao_pct >= 0),
  custo_fixo_aplicado   numeric(10,2) not null default 0 check (custo_fixo_aplicado >= 0),
  limite_custo_fixo     numeric(10,2) not null check (limite_custo_fixo > 0),
  frete                 numeric(10,2) not null default 0 check (frete >= 0),
  imposto_pct           numeric(6,4) not null check (imposto_pct >= 0),
  margem_alvo_pct       numeric(6,4) not null check (margem_alvo_pct >= 0),

  -- snapshot do custo do item na data (o preço do representante muda)
  custo_compra          numeric(10,2) not null check (custo_compra >= 0),
  custo_embalagem       numeric(10,2) not null default 0 check (custo_embalagem >= 0),

  -- diagnóstico calculado por lib/pricing.ts no momento do save
  -- (não é GENERATED: depende de frete estimado por peso, que é lógica
  -- de aplicação, não uma expressão determinística de colunas da linha)
  estado_margem         text not null check (estado_margem in (
                           'PREJUIZO', 'RUIM_ESTRUTURAL', 'ZONA_MORTA',
                           'ZONA_MORTA_SEM_SAIDA', 'ABAIXO_DA_META', 'OK', 'BOA'
                         )),

  lucro_liquido         numeric(10,2) generated always as (
                           preco_venda
                           - round(preco_venda * comissao_pct, 2)
                           - custo_fixo_aplicado
                           - frete
                           - round(preco_venda * imposto_pct, 2)
                           - custo_compra
                           - custo_embalagem
                         ) stored,

  margem_liquida         numeric(6,4) generated always as (
                           case when preco_venda = 0 then 0 else round((
                             preco_venda
                             - round(preco_venda * comissao_pct, 2)
                             - custo_fixo_aplicado
                             - frete
                             - round(preco_venda * imposto_pct, 2)
                             - custo_compra
                             - custo_embalagem
                           ) / preco_venda, 4) end
                         ) stored,

  created_at            timestamptz not null default now(),

  constraint precificacoes_produto_ou_kit check (
    (produto_id is not null)::int + (kit_id is not null)::int = 1
  )
);

create index precificacoes_user_id_created_at_idx on precificacoes(user_id, created_at desc);
create index precificacoes_produto_id_idx on precificacoes(produto_id);
create index precificacoes_kit_id_idx on precificacoes(kit_id);

-- =========================================================================
-- Row Level Security — cada usuário só enxerga as próprias linhas
-- =========================================================================
alter table categorias_ml enable row level security;
alter table produtos enable row level security;
alter table configuracoes enable row level security;
alter table kits enable row level security;
alter table kit_itens enable row level security;
alter table precificacoes enable row level security;

create policy categorias_ml_isolamento on categorias_ml
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy produtos_isolamento on produtos
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy configuracoes_isolamento on configuracoes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy kits_isolamento on kits
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy precificacoes_isolamento on precificacoes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- kit_itens não tem user_id próprio: a posse é derivada do kit pai.
create policy kit_itens_isolamento on kit_itens
  for all using (
    exists (select 1 from kits where kits.id = kit_itens.kit_id and kits.user_id = auth.uid())
  ) with check (
    exists (select 1 from kits where kits.id = kit_itens.kit_id and kits.user_id = auth.uid())
  );
