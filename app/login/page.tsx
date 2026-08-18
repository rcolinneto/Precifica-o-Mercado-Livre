"use client";

import { useActionState } from "react";
import Link from "next/link";
import { entrar, type EstadoAuth } from "./actions";

export default function LoginPage() {
  const [estado, formAction, pendente] = useActionState<EstadoAuth | undefined, FormData>(entrar, undefined);

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <form action={formAction} className="w-full max-w-sm space-y-4 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Precificador Dipil</h1>
          <p className="text-sm text-gray-500">Entre com sua conta</p>
        </div>

        <div className="space-y-1">
          <label htmlFor="email" className="block text-sm font-medium text-gray-700">
            E-mail
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="senha" className="block text-sm font-medium text-gray-700">
            Senha
          </label>
          <input
            id="senha"
            name="senha"
            type="password"
            required
            minLength={6}
            autoComplete="current-password"
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
          />
        </div>

        {estado?.erro && <p className="text-sm text-red-600">{estado.erro}</p>}

        <button
          type="submit"
          disabled={pendente}
          className="w-full rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {pendente ? "Entrando..." : "Entrar"}
        </button>

        <p className="text-center text-sm text-gray-600">
          Não tem conta?{" "}
          <Link href="/cadastro" className="font-medium underline">
            Cadastre-se
          </Link>
        </p>
      </form>
    </main>
  );
}
