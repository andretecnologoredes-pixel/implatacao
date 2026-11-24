import { NextResponse } from "next/server";
import { TarefaSchema } from "@/lib/kanban/schemas";
import { erroApi, exigirSessao } from "@/lib/kanban/server";

export async function POST(request: Request) {
  const sessao = await exigirSessao();
  if (sessao.erro) return sessao.erro;
  const { supabase, profile } = sessao;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return erroApi("Corpo da requisição inválido.", 400);
  }

  const parsed = TarefaSchema.safeParse(body);
  if (!parsed.success) {
    return erroApi(parsed.error.issues[0]?.message ?? "Dados inválidos.", 400);
  }

  const input = parsed.data;
  const envolvidos = Array.from(new Set(input.envolvidos ?? []));

  const idsPessoas = Array.from(new Set([input.responsible_id, ...envolvidos]));
  const { data: pessoasValidas, error: errPessoas } = await supabase
    .from("profiles")
    .select("id")
    .eq("escritorio_id", profile.escritorio_id)
    .eq("ativo", true)
    .in("id", idsPessoas);

  if (errPessoas || (pessoasValidas?.length ?? 0) !== idsPessoas.length) {
    return erroApi("Responsável ou envolvido inválido para este escritório.", 400, errPessoas);
  }

  let colunaId = input.coluna_id;
  if (!colunaId) {
    const { data: quadroPadrao } = await supabase
      .from("kanban_quadros")
      .select("id")
      .eq("escritorio_id", profile.escritorio_id)
      .eq("pessoal", false)
      .is("grupo_id", null)
      .is("arquivado_em", null)
      .order("created_at", { ascending: true })
      .limit(1)
      .single();

    if (!quadroPadrao) {
      return erroApi("Nenhum quadro padrão encontrado.", 404);
    }

    const { data: primeiraColuna } = await supabase
      .from("kanban_colunas")
      .select("id")
      .eq("quadro_id", quadroPadrao.id)
      .eq("escritorio_id", profile.escritorio_id)
      .order("posicao", { ascending: true })
      .limit(1)
      .single();

    if (!primeiraColuna) {
      return erroApi("Quadro padrão sem colunas.", 400);
    }
    colunaId = primeiraColuna.id;
  } else {
    const { data: col } = await supabase
      .from("kanban_colunas")
      .select("id")
      .eq("id", colunaId)
      .eq("escritorio_id", profile.escritorio_id)
      .single();

    if (!col) {
      return erroApi("Coluna inválida para este escritório.", 400);
    }
  }

  const { data: ultimaTarefa } = await supabase
    .from("internal_tasks")
    .select("ordem")
    .eq("coluna_id", colunaId)
    .eq("escritorio_id", profile.escritorio_id)
    .order("ordem", { ascending: false })
    .limit(1)
    .maybeSingle();

  const proximaOrdem = (ultimaTarefa?.ordem ?? -1) + 1;

  const { data: criada, error: errInsert } = await supabase
    .from("internal_tasks")
    .insert({
      escritorio_id: profile.escritorio_id,
      titulo: input.titulo,
      responsible_id: input.responsible_id,
      data_limite: input.data_limite ? input.data_limite : null,
      criticidade: input.criticidade,
      descricao: input.descricao ?? null,
      coluna_id: colunaId,
      envolvidos,
      ordem: proximaOrdem,
      created_by: profile.id,
    })
    .select("*")
    .single();

  if (errInsert || !criada) {
    return erroApi("Não foi possível criar a tarefa.", 403, errInsert);
  }

  return NextResponse.json({ data: criada }, { status: 201 });
}
