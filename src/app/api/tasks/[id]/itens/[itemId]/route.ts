import { NextResponse } from "next/server";
import { TarefaItemEdicaoSchema } from "@/lib/kanban/schemas";
import { erroApi, exigirSessao, UUID_REGEX } from "@/lib/kanban/server";

function coletarDescendentes(
  raizId: string,
  itens: { id: string; parent_id: string | null }[]
): string[] {
  const resultado: string[] = [];
  const fila = [raizId];
  while (fila.length > 0) {
    const atual = fila.shift()!;
    for (const item of itens) {
      if (item.parent_id === atual) {
        resultado.push(item.id);
        fila.push(item.id);
      }
    }
  }
  return resultado;
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string; itemId: string } }
) {
  if (!UUID_REGEX.test(params.id) || !UUID_REGEX.test(params.itemId)) {
    return erroApi("Identificador inválido.", 400);
  }

  const sessao = await exigirSessao();
  if (sessao.erro) return sessao.erro;
  const { supabase, profile } = sessao;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return erroApi("Corpo da requisição inválido.", 400);
  }

  const parsed = TarefaItemEdicaoSchema.safeParse(body);
  if (!parsed.success) {
    return erroApi(parsed.error.issues[0]?.message ?? "Dados inválidos.", 400);
  }

  const input = parsed.data;
  const { data: tarefa } = await supabase
    .from("internal_tasks")
    .select("id, responsible_id, envolvidos")
    .eq("id", params.id)
    .eq("escritorio_id", profile.escritorio_id)
    .single();

  if (!tarefa) return erroApi("Cartão não encontrado.", 404);

  if (input.responsavel_id) {
    const pessoas = new Set([tarefa.responsible_id, ...(tarefa.envolvidos ?? [])]);
    if (!pessoas.has(input.responsavel_id)) {
      return erroApi("Responsável inválido para este cartão.", 400);
    }
  }

  const payload: Record<string, unknown> = {};
  if (input.titulo !== undefined) payload.titulo = input.titulo;
  if (input.concluido !== undefined) payload.concluido = input.concluido;
  if (input.responsavel_id !== undefined) payload.responsavel_id = input.responsavel_id;

  const { data: atualizado, error } = await supabase
    .from("tarefa_itens")
    .update(payload)
    .eq("id", params.itemId)
    .eq("task_id", params.id)
    .select("*")
    .single();

  if (error || !atualizado) {
    return erroApi("Não foi possível atualizar o sub-item.", 403, error);
  }

  if (input.concluido === true) {
    const { data: todosItens } = await supabase
      .from("tarefa_itens")
      .select("id, parent_id")
      .eq("task_id", params.id);

    const descendentes = coletarDescendentes(params.itemId, todosItens ?? []);
    if (descendentes.length > 0) {
      await supabase
        .from("tarefa_itens")
        .update({ concluido: true })
        .eq("task_id", params.id)
        .in("id", descendentes);
    }
  }

  return NextResponse.json({ data: atualizado });
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string; itemId: string } }
) {
  if (!UUID_REGEX.test(params.id) || !UUID_REGEX.test(params.itemId)) {
    return erroApi("Identificador inválido.", 400);
  }

  const sessao = await exigirSessao();
  if (sessao.erro) return sessao.erro;
  const { supabase } = sessao;

  const { error } = await supabase
    .from("tarefa_itens")
    .delete()
    .eq("id", params.itemId)
    .eq("task_id", params.id);

  if (error) {
    return erroApi("Não foi possível excluir o sub-item.", 403, error);
  }

  return NextResponse.json({ ok: true });
}
