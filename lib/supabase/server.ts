import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // setAll chamado a partir de um Server Component: ignorável
            // se houver middleware renovando a sessão.
          }
        },
      },
    },
  );
}

/**
 * Server client + usuário autenticado, num só lugar. Redireciona pra
 * /login se a sessão não existir (ex: expirou entre o proxy.ts e este
 * render) em vez de deixar `user!.id` estourar TypeError e virar 500.
 * Toda query em produtos/precificacoes/configuracoes/tabela_frete deve
 * filtrar por `user.id` explicitamente, não confiar só na RLS.
 */
export async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}
