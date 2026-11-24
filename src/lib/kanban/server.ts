import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function getSupabaseServer() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Chamado em Server Component
          }
        },
      },
    }
  );
}

export async function exigirSessao() {
  const supabase = await getSupabaseServer();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { erro: NextResponse.json({ error: "Sessão inválida." }, { status: 401 }) };
  }

  const { data: profile, error: profError } = await supabase
    .from("profiles")
    .select("id, escritorio_id, cargo, ativo")
    .eq("id", user.id)
    .single();

  if (profError || !profile || !profile.ativo) {
    return { erro: NextResponse.json({ error: "Perfil sem acesso ativo." }, { status: 403 }) };
  }

  return { supabase, user, profile };
}

export function erroApi(mensagem: string, status = 400, detalheLog?: unknown) {
  if (detalheLog) {
    console.error("[KANBAN_API]", mensagem, detalheLog);
  }
  return NextResponse.json({ error: mensagem }, { status });
}

export const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
