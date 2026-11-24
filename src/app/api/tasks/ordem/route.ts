import { NextResponse } from "next/server";
import { OrdemTarefasSchema } from "@/lib/kanban/schemas";
import { erroApi, exigirSessao } from "@/lib/kanban/server";

export async function PUT(request: Request) {
  const sessao = await exigirSessao();
  if (sessao.erro) return sessao.erro;
  const { supabase, profile } = sessao;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return erroApi("Corpo da requisição inválido.", 400);
  }

  const parsed = OrdemTarefasSchema.safeParse(body);
  if (!parsed.success) {
    return erroApi("Dados de ordenação inválidos.", 400);
  }

  const { coluna_id, ids } = parsed.data;

  if (new Set(ids).size !== ids.length) {
    return erroApi("Lista contém cartões duplicados.", 400);
  }

  const { data: coluna } = await supabase
    .from("kanban_colunas")
    .select("id")
    .eq("id", coluna_id)
    .eq("escritorio_id", profile.escritorio_id)
    .single();

  if (!coluna) {
    return erroApi("Coluna inválida para este escritório.", 400);
  }

  const { data: tarefasExistentes, error: errBusca } = await supabase
    .from("internal_tasks")
    .select("id")
    .eq("escritorio_id", profile.escritorio_id)
    .in("id", ids);

  if (errBusca || (tarefasExistentes?.length ?? 0) !== ids.length) {
    return erroApi("Um ou mais cartões são inválidos ou de outro escritório.", 400, errBusca);
  }

  const resultados = await Promise.all(
    ids.map((taskId, index) =>
      supabase
        .from("internal_tasks")
        .update({ coluna_id, ordem: index })
        .eq("id", taskId)
        .eq("escritorio_id", profile.escritorio_id)
    )
  );

  const falha = resultados.find((r) => r.error);
  if (falha?.error) {
    return erroApi("Não foi possível salvar a nova ordem.", 403, falha.error);
  }

  return NextResponse.json({ ok: true });
}
