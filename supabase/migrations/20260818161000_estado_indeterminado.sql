-- Acrescenta o estado INDETERMINADO ao check de estado_margem: quando o
-- custo de envio não é confiável (peso/dimensão faltando, ou faixa
-- inexistente na tabela de frete), nenhuma das outras 7 categorias serve —
-- todas fingiriam saber algo que não sabemos.
alter table precificacoes drop constraint precificacoes_estado_margem_check;
alter table precificacoes add constraint precificacoes_estado_margem_check check (estado_margem in (
  'INDETERMINADO', 'PREJUIZO', 'RUIM_ESTRUTURAL', 'ZONA_MORTA',
  'ZONA_MORTA_SEM_SAIDA', 'ABAIXO_DA_META', 'OK', 'BOA'
));
