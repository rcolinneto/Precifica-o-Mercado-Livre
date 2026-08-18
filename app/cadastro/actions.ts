"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export interface EstadoAuth {
  erro?: string;
}

export async function cadastrar(_estado: EstadoAuth | undefined, formData: FormData): Promise<EstadoAuth> {
  const email = String(formData.get("email") ?? "").trim();
  const senha = String(formData.get("senha") ?? "");
  const confirmacao = String(formData.get("confirmacao") ?? "");

  if (!email || !senha) {
    return { erro: "Preencha e-mail e senha." };
  }
  if (senha !== confirmacao) {
    return { erro: "As senhas não coincidem." };
  }
  if (senha.length < 6) {
    return { erro: "A senha precisa de pelo menos 6 caracteres." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({ email, password: senha });

  if (error) {
    if (error.message.toLowerCase().includes("already registered")) {
      return { erro: "Esse e-mail já tem conta. Tente entrar." };
    }
    return { erro: "Não foi possível criar a conta. Tente de novo." };
  }

  // Confirmação de e-mail está desativada para este app interno, então
  // signUp já retorna uma sessão ativa — pode ir direto pro catálogo.
  redirect("/produtos");
}
