"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export interface EstadoAuth {
  erro?: string;
}

export async function entrar(_estado: EstadoAuth | undefined, formData: FormData): Promise<EstadoAuth> {
  const email = String(formData.get("email") ?? "").trim();
  const senha = String(formData.get("senha") ?? "");

  if (!email || !senha) {
    return { erro: "Preencha e-mail e senha." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password: senha });

  if (error) {
    return { erro: "E-mail ou senha inválidos." };
  }

  redirect("/produtos");
}
