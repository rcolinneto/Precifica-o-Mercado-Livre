-- Fecha o buraco de 301g-1000g na tabela_frete: a fonte original só dava
-- exemplos "até 0,3kg" e "1-2kg", sem cobrir o meio, e um produto real de
-- ~600g (garrafa de 500ml-1L, comum no catálogo) caía em INDETERMINADO
-- mesmo com peso e dimensões preenchidos — não é bug, é o buraco de dado
-- de fato existindo. Preenche com a MÉDIA entre as duas faixas vizinhas —
-- é uma estimativa marcada como tal, não um valor real da fonte. Ajustar
-- pelo Simulador de Custos oficial assim que a tela de Configurações
-- existir.
create or replace function seed_faixa_301_1000g(p_user_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.tabela_frete
    (user_id, modalidade, reputacao, peso_min_g, peso_max_g, preco_min, preco_max, custo, vigente_desde)
  values
    (p_user_id, 'agencia', 'sem_reputacao', 301, 1000,   0.00,   19.00,  5.95, '2026-08-18'),
    (p_user_id, 'agencia', 'sem_reputacao', 301, 1000,  19.00,   49.00,  6.75, '2026-08-18'),
    (p_user_id, 'agencia', 'sem_reputacao', 301, 1000,  49.00,   79.00,  7.95, '2026-08-18'),
    (p_user_id, 'agencia', 'sem_reputacao', 301, 1000,  79.00, 999999.99, 13.40, '2026-08-18')
  on conflict do nothing;
end;
$$;

-- Backfill pros usuários que já existem.
do $$
declare
  u record;
begin
  for u in select id from auth.users loop
    perform seed_faixa_301_1000g(u.id);
  end loop;
end $$;

-- E pros usuários futuros: acrescenta a chamada dentro do seed padrão.
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

  perform seed_faixa_301_1000g(p_user_id);
end;
$$;
