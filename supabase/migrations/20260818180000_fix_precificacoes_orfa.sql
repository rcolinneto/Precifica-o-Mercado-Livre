-- Bug de schema desde a migration inicial: precificacoes_produto_ou_kit
-- exigia EXATAMENTE UM de produto_id/kit_id preenchido. Mas produto_id tem
-- "on delete set null" (de propósito, pra preservar histórico quando um
-- produto é excluído) — e quando isso dispara pra uma precificação que
-- nunca teve kit_id, os dois ficam nulos ao mesmo tempo, violando a
-- constraint e fazendo a exclusão do produto inteira falhar/dar rollback.
--
-- Corrige pra "no máximo um" (nunca os dois ao mesmo tempo) em vez de
-- "exatamente um" — uma precificação órfã (produto excluído, nenhum kit)
-- é um estado válido, não um erro de dado.
alter table precificacoes drop constraint precificacoes_produto_ou_kit;
alter table precificacoes add constraint precificacoes_produto_ou_kit check (
  (produto_id is not null)::int + (kit_id is not null)::int <= 1
);
