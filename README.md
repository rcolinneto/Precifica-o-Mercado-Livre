# Precificador Mercado Livre

Sistema interno de precificação de produtos para Mercado Livre. Guarda o catálogo, calcula o preço certo de cada item (comissão, custo fixo, frete, imposto, margem) e alerta quando um produto cai na "zona morta" dos R$79 — a faixa de preço onde o custo fixo por venda do Mercado Livre corrói a margem.

## Stack

Next.js (App Router) + TypeScript + Tailwind CSS v4 + Supabase (Postgres + Auth, com Row Level Security). Sem ORM — client oficial do Supabase.

## Rodando localmente

Pré-requisitos: Node 20+ e uma conta Supabase com um projeto criado.

```bash
npm install
cp .env.local.example .env.local
# preencha .env.local (veja "Variáveis de ambiente" abaixo)
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000).

## Telas

- `/cadastro`, `/login` — Supabase Auth (e-mail/senha). Confirmação de e-mail está desativada no projeto (uso interno, 2 usuários conhecidos) — cadastro já loga na hora.
- `/produtos` — catálogo: listar, criar, editar, ativar/desativar.
- `/produtos/[id]/calculadora` — o coração do sistema: preço recalculado em tempo real (Clássico vs Premium lado a lado), breakdown de comissão/custo fixo/frete/imposto/lucro, botão "calcular preço pra uma margem alvo", alerta de zona morta dos R$79, e salvar a simulação no histórico (`precificacoes`).

Todas as rotas autenticadas ficam sob `app/(app)/`, protegidas por `proxy.ts` (convenção do Next 16 para middleware) — sem sessão, qualquer rota redireciona pra `/login`.

Ainda não construído: seletor de categoria por produto no formulário (comissão cai no padrão de `configuracoes` por enquanto), tela de Configurações, Dashboard, Comparativo e Kits.

## Variáveis de ambiente

Todas ficam em `.env.local` (nunca commitado — está no `.gitignore`). Copie `.env.local.example` como ponto de partida.

| Variável | Onde encontrar | Uso |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Painel do Supabase → Project Settings → API → Project URL | URL do projeto. Pública por natureza. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Painel do Supabase → Project Settings → API → chave `anon`/`publishable` | Chave pública do client. Só é segura porque RLS está habilitado em toda tabela — nunca use no lugar da `service_role`. |
| `SUPABASE_SERVICE_ROLE_KEY` | Painel do Supabase → Project Settings → API → chave `service_role`/`secret` | **Secreta.** Bypassa RLS. Só é necessária localmente para rodar `tests/rls.test.ts` (que precisa criar/apagar usuários de teste via Admin API). O app em si nunca usa essa chave — nenhum código de produção a importa. **Nunca** exponha no client nem em variável `NEXT_PUBLIC_*`. |

Em produção (Vercel), essas mesmas três variáveis são configuradas no painel do projeto, nunca commitadas.

## Banco de dados e migrations

O schema vive em `supabase/migrations/`. Para aplicar num projeto Supabase:

```bash
npx supabase login                                  # autentica o CLI (pede um access token pessoal)
npx supabase link --project-ref <seu-project-ref>    # linka este repo ao projeto Supabase
npx supabase db push                                 # aplica as migrations pendentes
```

O `project-ref` aparece na URL do painel do projeto (`supabase.com/dashboard/project/<ref>`) ou em Project Settings → General.

Toda tabela tem Row Level Security habilitada: cada usuário só enxerga suas próprias linhas (`auth.uid() = user_id`, ou via join para `kit_itens`, que não tem `user_id` próprio). Um trigger cria uma linha padrão em `configuracoes` automaticamente no cadastro de cada usuário.

## Testes

```bash
npm test
```

`lib/pricing.test.ts` é puro — sem rede, sem Supabase, roda sempre. `tests/rls.test.ts` é um teste de **integração**: cria dois usuários reais no projeto Supabase configurado, confirma que um não enxerga/edita/apaga linha do outro em nenhuma tabela, e depois apaga os dois usuários de teste. Ele só roda se `SUPABASE_SERVICE_ROLE_KEY` estiver definida em `.env.local` — sem ela, o suite é pulado (não falha), então `npm test` funciona mesmo sem essa chave.

## Deploy

Pensado para Vercel: build padrão do Next.js (`npm run build`), variáveis de ambiente configuradas no painel do projeto Vercel (nunca no código). Depois do primeiro deploy, adicione a URL de produção em Supabase → Authentication → URL Configuration (Site URL e Redirect URLs), senão o fluxo de login quebra em produção mesmo funcionando local.
