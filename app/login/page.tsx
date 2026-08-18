"use client";

import { useActionState } from "react";
import Link from "next/link";
import { entrar, type EstadoAuth } from "./actions";

export default function LoginPage() {
  const [estado, formAction, pendente] = useActionState<EstadoAuth | undefined, FormData>(entrar, undefined);

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-600 text-lg font-semibold text-white shadow-sm">
            P
          </div>
          <h1 className="text-xl font-semibold text-slate-900">Precificador Mercado Livre</h1>
          <p className="mt-1 text-sm text-slate-500">Entre com sua conta</p>
        </div>

        <form
          action={formAction}
          className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/50"
        >
          <div className="space-y-1.5">
            <label htmlFor="email" className="block text-sm font-medium text-slate-700">
              E-mail
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="senha" className="block text-sm font-medium text-slate-700">
              Senha
            </label>
            <input
              id="senha"
              name="senha"
              type="password"
              required
              minLength={6}
              autoComplete="current-password"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
            />
          </div>

          {estado?.erro && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{estado.erro}</p>
          )}

          <button
            type="submit"
            disabled={pendente}
            className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo-700 disabled:opacity-50"
          >
            {pendente ? "Entrando..." : "Entrar"}
          </button>

          <p className="text-center text-sm text-slate-500">
            Não tem conta?{" "}
            <Link href="/cadastro" className="font-medium text-indigo-600 hover:text-indigo-700">
              Cadastre-se
            </Link>
          </p>
        </form>
      </div>
    </main>
  );
}
