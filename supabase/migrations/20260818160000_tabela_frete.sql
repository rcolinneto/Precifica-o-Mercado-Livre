-- Substitui o modelo antigo (custo_fixo + frete linear-por-peso) por uma
-- tabela de frete unificada peso × preço, refletindo a unificação real do
-- Mercado Livre desde março/2026: não existe mais "custo fixo abaixo de
-- R$79" como conceito separado — é tudo uma única grade de custo de envio.
--
-- Valores seed abaixo são ILUSTRATIVOS (fonte: material público de
-- terceiros, não a tabela oficial do ML) — ponto de partida editável, não
-- verdade. O usuário deve conferir na Calculadora de Frete da Central do
-- Vendedor e ajustar via tela de configurações (fora do escopo desta
-- migration).

-- =========================================================================
-- tabela_frete
-- =========================================================================
create table tabela_frete (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  modalidade     text not null check (modalidade in ('coleta', 'agencia', 'full', 'flex', 'proprio')),
  reputacao      text not null check (reputacao in ('sem_reputacao', 'vermelho', 'laranja', 'amarelo', 'verde', 'verde_escuro')),
  -- Busca é sempre peso_min_g <= valor < peso_max_g (meio-aberto). Use um
  -- teto alto (ex: 999999999) em vez de deixar a última faixa em aberto.
  peso_min_g     integer not null check (peso_min_g >= 0),
  peso_max_g     integer not null check (peso_max_g > peso_min_g),
  -- Mesma lógica meio-aberta: preco_min <= valor < preco_max.
  preco_min      numeric(10,2) not null check (preco_min >= 0),
  preco_max      numeric(10,2) not null check (preco_max > preco_min),
  custo          numeric(10,2) not null check (custo >= 0),
  vigente_desde  date not null default current_date,
  created_at     timestamptz not null default now(),
  -- Não impomos não-sobreposição de faixas no banco (exigiria exclusion
  -- constraint com GiST em múltiplas dimensões). Se duas linhas baterem na
  -- mesma busca, a aplicação usa a de vigente_desde mais recente.
  unique (user_id, modalidade, reputacao, peso_min_g, peso_max_g, preco_min, preco_max, vigente_desde)
);

create index tabela_frete_lookup_idx on tabela_frete(user_id, modalidade, reputacao);

alter table tabela_frete enable row level security;
create policy tabela_frete_isolamento on tabela_frete
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Seed padrão (16 linhas: 4 faixas de peso x 4 faixas de preço), modalidade
-- 'agencia' e reputação 'sem_reputacao' — a situação real de um vendedor
-- novo. Função reutilizável: chamada pelo trigger de novo usuário e, uma
-- vez, para usuários que já existiam antes desta migration.
create or replace function seed_tabela_frete_padrao(p_user_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.tabela_frete
    (user_id, modalidade, reputacao, peso_min_g, peso_max_g, preco_min, preco_max, custo, vigente_desde)
  values
    (p_user_id, 'agencia', 'sem_reputacao',     0,   301,   0.00,   19.00,  5.65, '2026-08-18'),
    (p_user_id, 'agencia', 'sem_reputacao',     0,   301,  19.00,   49.00,  6.55, '2026-08-18'),
    (p_user_id, 'agencia', 'sem_reputacao',     0,   301,  49.00,   79.00,  7.75, '2026-08-18'),
    (p_user_id, 'agencia', 'sem_reputacao',     0,   301,  79.00, 999999.99, 12.35, '2026-08-18'),
    (p_user_id, 'agencia', 'sem_reputacao',  1000,  2001,   0.00,   19.00,  6.25, '2026-08-18'),
    (p_user_id, 'agencia', 'sem_reputacao',  1000,  2001,  19.00,   49.00,  6.95, '2026-08-18'),
    (p_user_id, 'agencia', 'sem_reputacao',  1000,  2001,  49.00,   79.00,  8.15, '2026-08-18'),
    (p_user_id, 'agencia', 'sem_reputacao',  1000,  2001,  79.00, 999999.99, 14.45, '2026-08-18'),
    (p_user_id, 'agencia', 'sem_reputacao',  5000,  6001,   0.00,   19.00,  6.65, '2026-08-18'),
    (p_user_id, 'agencia', 'sem_reputacao',  5000,  6001,  19.00,   49.00,  8.55, '2026-08-18'),
    (p_user_id, 'agencia', 'sem_reputacao',  5000,  6001,  49.00,   79.00,  9.95, '2026-08-18'),
    (p_user_id, 'agencia', 'sem_reputacao',  5000,  6001,  79.00, 999999.99, 25.45, '2026-08-18'),
    (p_user_id, 'agencia', 'sem_reputacao', 10000, 999999999, 0.00,   19.00,  7.05, '2026-08-18'),
    (p_user_id, 'agencia', 'sem_reputacao', 10000, 999999999, 19.00,   49.00,  9.55, '2026-08-18'),
    (p_user_id, 'agencia', 'sem_reputacao', 10000, 999999999, 49.00,   79.00, 10.95, '2026-08-18'),
    (p_user_id, 'agencia', 'sem_reputacao', 10000, 999999999, 79.00, 999999.99, 41.25, '2026-08-18')
  on conflict do nothing;
end;
$$;

-- Backfill único para usuários que já existiam antes desta migration.
do $$
declare
  u record;
begin
  for u in select id from auth.users loop
    perform seed_tabela_frete_padrao(u.id);
  end loop;
end $$;

-- Trigger de novo usuário passa a semear a tabela de frete também.
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.configuracoes (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  perform seed_tabela_frete_padrao(new.id);
  return new;
end;
$$;

-- =========================================================================
-- produtos — peso_gramas vira peso_real_g (nullable: 0g não existe de
-- verdade, NULL agora significa "não sei" de forma explícita) + dimensões
-- da embalagem + modalidade padrão + elegibilidade pro Full.
-- =========================================================================
alter table produtos rename column peso_gramas to peso_real_g;
alter table produtos alter column peso_real_g drop not null;
alter table produtos alter column peso_real_g drop default;
update produtos set peso_real_g = null where peso_real_g = 0;

alter table produtos add column comprimento_cm numeric(6,2) check (comprimento_cm is null or comprimento_cm > 0);
alter table produtos add column largura_cm     numeric(6,2) check (largura_cm is null or largura_cm > 0);
alter table produtos add column altura_cm      numeric(6,2) check (altura_cm is null or altura_cm > 0);

alter table produtos add column modalidade_padrao text not null default 'agencia'
  check (modalidade_padrao in ('coleta', 'agencia', 'full', 'flex', 'proprio'));

-- Produto tóxico/inflamável/aerossol (boa parte do catálogo Dipil) não é
-- aceito no Full — precisa ser marcado por produto, não globalmente.
alter table produtos add column aceito_no_full boolean not null default true;

-- =========================================================================
-- configuracoes — remove o modelo antigo, acrescenta o novo
-- =========================================================================
alter table configuracoes drop column custo_fixo_padrao;
alter table configuracoes drop column frete_base;
alter table configuracoes drop column peso_base_gramas;
alter table configuracoes drop column custo_por_grama_adicional;

alter table configuracoes rename column limite_custo_fixo to limite_frete_gratis;

alter table configuracoes add column reputacao_atual text not null default 'sem_reputacao'
  check (reputacao_atual in ('sem_reputacao', 'vermelho', 'laranja', 'amarelo', 'verde', 'verde_escuro'));

alter table configuracoes add column divisor_cubagem integer not null default 6000 check (divisor_cubagem > 0);

-- Ganho mínimo, em PONTOS PERCENTUAIS (não fração), pra zona morta virar
-- alerta de "subir o preço": ex. 3.00 = exige pelo menos 3pp de melhora
-- real de margem, senão a recomendação vira ruído pra decisões de +/-100%
-- no preço. Convertido pra fração (/100) só no app, não aqui.
alter table configuracoes add column ganho_minimo_pp numeric(5,2) not null default 3.00 check (ganho_minimo_pp >= 0);

-- =========================================================================
-- precificacoes — troca custo_fixo_aplicado + frete por custo_envio
-- =========================================================================

-- GENERATED columns precisam sumir antes de mexer nas colunas que elas
-- referenciam.
alter table precificacoes drop column lucro_liquido;
alter table precificacoes drop column margem_liquida;

alter table precificacoes add column custo_envio numeric(10,2);
alter table precificacoes add column peso_cobravel_g integer;
alter table precificacoes add column modalidade text
  check (modalidade in ('coleta', 'agencia', 'full', 'flex', 'proprio'));
alter table precificacoes add column reputacao text
  check (reputacao in ('sem_reputacao', 'vermelho', 'laranja', 'amarelo', 'verde', 'verde_escuro'));
-- 'legado': linha salva pelo modelo antigo (custo_fixo + frete), nunca
-- recalculada — não é a mesma coisa que 'estimado' (calculado com dado
-- incompleto no modelo atual). Não misturar as duas histórias.
alter table precificacoes add column origem_custo_envio text
  check (origem_custo_envio in ('tabela', 'manual', 'estimado', 'legado'));
alter table precificacoes add column limite_frete_gratis numeric(10,2);

update precificacoes
set custo_envio = custo_fixo_aplicado + frete,
    origem_custo_envio = 'legado',
    limite_frete_gratis = limite_custo_fixo;

alter table precificacoes alter column custo_envio set not null;
alter table precificacoes add constraint precificacoes_custo_envio_check check (custo_envio >= 0);
alter table precificacoes alter column origem_custo_envio set not null;
alter table precificacoes alter column limite_frete_gratis set not null;
-- peso_cobravel_g/modalidade/reputacao ficam nullable: pra linhas 'legado'
-- não temos como reconstruir isso retroativamente, e não faz sentido
-- inventar um valor.

alter table precificacoes drop column custo_fixo_aplicado;
alter table precificacoes drop column frete;
alter table precificacoes drop column limite_custo_fixo;

alter table precificacoes add column lucro_liquido numeric(10,2) generated always as (
  preco_venda
  - round(preco_venda * comissao_pct, 2)
  - custo_envio
  - round(preco_venda * imposto_pct, 2)
  - custo_compra
  - custo_embalagem
) stored;

alter table precificacoes add column margem_liquida numeric(6,4) generated always as (
  case when preco_venda = 0 then 0 else round((
    preco_venda
    - round(preco_venda * comissao_pct, 2)
    - custo_envio
    - round(preco_venda * imposto_pct, 2)
    - custo_compra
    - custo_embalagem
  ) / preco_venda, 4) end
) stored;
