"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setCarregando(true);

    try {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (authError) {
        throw new Error(authError.message || "Credenciais inválidas.");
      }

      router.push("/");
      router.refresh();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Falha ao autenticar.");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-lg font-semibold text-slate-900">Acesso — Kanban Implantação</h1>
        <p className="mt-1 text-xs text-slate-500">
          Entre com sua conta para acessar os quadros do escritório.
        </p>

        {erro && (
          <div className="mt-4 rounded border border-rose-300 bg-rose-50 px-3 py-2 text-xs text-rose-800">
            {erro}
          </div>
        )}

        <form onSubmit={handleLogin} className="mt-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-700">E-mail</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nome@empresa.com"
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm text-slate-900"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700">Senha</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm text-slate-900"
            />
          </div>

          <button
            type="submit"
            disabled={carregando}
            className="w-full rounded bg-slate-900 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {carregando ? "Entrando..." : "Entrar"}
          </button>
        </form>
      </div>
    </main>
  );
}
