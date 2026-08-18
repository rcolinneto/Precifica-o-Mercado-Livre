-- Fecha os dois buracos de peso que ficaram de propósito (2001-5000g e
-- 6001-10000g) — mesma classe de bug que 301-1000g (20260818170000): um
-- produto de 3kg ou 8kg cairia em INDETERMINADO mesmo com todos os dados
-- preenchidos. Valores por interpolação (média das faixas vizinhas),
-- estimativa marcada como tal, mesma lógica já usada e aprovada pra
-- 301-1000g.
--
-- Também consolida seed_faixa_301_1000g + seed_tabela_frete_padrao numa
-- função só: eram duas fontes de verdade que podiam dessincronizar (ex:
-- editar uma faixa de preço em uma sem lembrar da outra). Agora a tabela
-- inteira (0g a "infinito") tila sem buraco nenhum, numa lista só.
drop function if exists seed_faixa_301_1000g(uuid);

create or replace function seed_tabela_frete_padrao(p_user_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.tabela_frete
    (user_id, modalidade, reputacao, peso_min_g, peso_max_g, preco_min, preco_max, custo, vigente_desde)
  values
    -- 0-300g: dado real da fonte original
    (p_user_id, 'agencia', 'sem_reputacao',     0,   301,   0.00,   19.00,  5.65, '2026-08-18'),
    (p_user_id, 'agencia', 'sem_reputacao',     0,   301,  19.00,   49.00,  6.55, '2026-08-18'),
    (p_user_id, 'agencia', 'sem_reputacao',     0,   301,  49.00,   79.00,  7.75, '2026-08-18'),
    (p_user_id, 'agencia', 'sem_reputacao',     0,   301,  79.00, 999999.99, 12.35, '2026-08-18'),
    -- 301-1000g: estimativa (média entre 0-300g e 1-2kg)
    (p_user_id, 'agencia', 'sem_reputacao',   301,  1000,   0.00,   19.00,  5.95, '2026-08-18'),
    (p_user_id, 'agencia', 'sem_reputacao',   301,  1000,  19.00,   49.00,  6.75, '2026-08-18'),
    (p_user_id, 'agencia', 'sem_reputacao',   301,  1000,  49.00,   79.00,  7.95, '2026-08-18'),
    (p_user_id, 'agencia', 'sem_reputacao',   301,  1000,  79.00, 999999.99, 13.40, '2026-08-18'),
    -- 1-2kg: dado real da fonte original
    (p_user_id, 'agencia', 'sem_reputacao',  1000,  2001,   0.00,   19.00,  6.25, '2026-08-18'),
    (p_user_id, 'agencia', 'sem_reputacao',  1000,  2001,  19.00,   49.00,  6.95, '2026-08-18'),
    (p_user_id, 'agencia', 'sem_reputacao',  1000,  2001,  49.00,   79.00,  8.15, '2026-08-18'),
    (p_user_id, 'agencia', 'sem_reputacao',  1000,  2001,  79.00, 999999.99, 14.45, '2026-08-18'),
    -- 2001-5000g: estimativa (média entre 1-2kg e 5-6kg)
    (p_user_id, 'agencia', 'sem_reputacao',  2001,  5000,   0.00,   19.00,  6.45, '2026-08-18'),
    (p_user_id, 'agencia', 'sem_reputacao',  2001,  5000,  19.00,   49.00,  7.75, '2026-08-18'),
    (p_user_id, 'agencia', 'sem_reputacao',  2001,  5000,  49.00,   79.00,  9.05, '2026-08-18'),
    (p_user_id, 'agencia', 'sem_reputacao',  2001,  5000,  79.00, 999999.99, 19.95, '2026-08-18'),
    -- 5-6kg: dado real da fonte original
    (p_user_id, 'agencia', 'sem_reputacao',  5000,  6001,   0.00,   19.00,  6.65, '2026-08-18'),
    (p_user_id, 'agencia', 'sem_reputacao',  5000,  6001,  19.00,   49.00,  8.55, '2026-08-18'),
    (p_user_id, 'agencia', 'sem_reputacao',  5000,  6001,  49.00,   79.00,  9.95, '2026-08-18'),
    (p_user_id, 'agencia', 'sem_reputacao',  5000,  6001,  79.00, 999999.99, 25.45, '2026-08-18'),
    -- 6001-10000g: estimativa (média entre 5-6kg e 10-11kg)
    (p_user_id, 'agencia', 'sem_reputacao',  6001, 10000,   0.00,   19.00,  6.85, '2026-08-18'),
    (p_user_id, 'agencia', 'sem_reputacao',  6001, 10000,  19.00,   49.00,  9.05, '2026-08-18'),
    (p_user_id, 'agencia', 'sem_reputacao',  6001, 10000,  49.00,   79.00, 10.45, '2026-08-18'),
    (p_user_id, 'agencia', 'sem_reputacao',  6001, 10000,  79.00, 999999.99, 33.35, '2026-08-18'),
    -- 10kg+: dado real da fonte original, faixa aberta (teto alto)
    (p_user_id, 'agencia', 'sem_reputacao', 10000, 999999999, 0.00,   19.00,  7.05, '2026-08-18'),
    (p_user_id, 'agencia', 'sem_reputacao', 10000, 999999999, 19.00,   49.00,  9.55, '2026-08-18'),
    (p_user_id, 'agencia', 'sem_reputacao', 10000, 999999999, 49.00,   79.00, 10.95, '2026-08-18'),
    (p_user_id, 'agencia', 'sem_reputacao', 10000, 999999999, 79.00, 999999.99, 41.25, '2026-08-18')
  on conflict do nothing;
end;
$$;

-- Backfill das duas novas faixas pros usuários que já existem (as outras 4
-- faixas já foram semeadas antes; on conflict do nothing evita duplicar).
do $$
declare
  u record;
begin
  for u in select id from auth.users loop
    perform seed_tabela_frete_padrao(u.id);
  end loop;
end $$;
