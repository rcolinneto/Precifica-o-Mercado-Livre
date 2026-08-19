// Só "agência" tem linha na tabela_frete hoje (ver seed_tabela_frete_padrao
// na migration) — as fontes que embasaram a tabela cobriam só essa
// modalidade. Mostrar coleta/full/flex/próprio aqui seria deixar o usuário
// escolher uma opção que sempre cai em INDETERMINADO (aconteceu na prática
// duas vezes). Reative uma modalidade nesta lista só quando ela tiver dado
// de verdade na tabela_frete pra reputação em uso — nunca antes disso.
export const OPCOES_MODALIDADE = [{ valor: "agencia", rotulo: "Agência" }];
