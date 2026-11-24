import { NextResponse } from "next/server";
import { TarefaEdicaoSchema } from "@/lib/kanban/schemas";
import { erroApi, exigirSessao, UUID_REGEX } from "@/lib/kanban/server";

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  if (!UUID_REGEX.test(params.id)) {
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

  const parsed = TarefaEdicaoSchema.safeParse(body);
  if (!parsed.success) {
    return erroApi(parsed.error.issues[0]?.message ?? "Dados inválidos.", 400);
  }

  const input = parsed.data;
  const updatePayload: Record<string, unknown> = {};

  if (input.titulo !== undefined) updatePayload.titulo = input.titulo;
  if (input.criticidade !== undefined) updatePayload.criticidade = input.criticidade;
  if (input.descricao !== undefined) updatePayload.descricao = input.descricao;

  if (input.data_limite !== undefined) {
    updatePayload.data_limite = input.data_limite ? input.data_limite : null;
  }

  if (input.cancelada !== undefined) {
    updatePayload.cancelada_em = input.cancelada ? new Date().toISOString() : null;
  }

  if (input.concluida_em !== undefined) {
    if (input.concluida_em === null) {
      updatePayload.concluida_em = null;
    } else if (/^\d{4}-\d{2}-\d{2}$/.test(input.concluida_em)) {
      updatePayload.concluida_em = `${input.concluida_em}T12:00:00-03:00`;
    } else {
      updatePayload.concluida_em = input.concluida_em;
    }
  }

  if (input.coluna_id !== undefined) {
    const { data: col } = await supabase
      .from("kanban_colunas")
      .select("id")
      .eq("id", input.coluna_id)
      .eq("escritorio_id", profile.escritorio_id)
      .single();

    if (!col) return erroApi("Coluna inválida.", 400);
    updatePayload.coluna_id = input.coluna_id;
  }

  const pessoasParaValidar: string[] = [];
  if (input.responsible_id !== undefined) {
    updatePayload.responsible_id = input.responsible_id;
    pessoasParaValidar.push(input.responsible_id);
  }
  if (input.envolvidos !== undefined) {
    const unicos = Array.from(new Set(input.envolvidos));
    updatePayload.envolvidos = unicos;
    pessoasParaValidar.push(...unicos);
  }

  if (pessoasParaValidar.length > 0) {
    const unicos = Array.from(new Set(pessoasParaValidar));
    const { data: validos } = await supabase
      .from("profiles")
      .select("id")
      .eq("escritorio_id", profile.escritorio_id)
      .eq("ativo", true)
      .in("id", unicos);

    if ((validos?.length ?? 0) !== unicos.length) {
      return erroApi("Pessoa inválida para este escritório.", 400);
    }
  }

  const { data: atualizada, error } = await supabase
    .from("internal_tasks")
    .update(updatePayload)
    .eq("id", params.id)
    .eq("escritorio_id", profile.escritorio_id)
    .select("*")
    .single();

  if (error || !atualizada) {
    return erroApi("Não foi possível atualizar o cartão.", 403, error);
  }

  return NextResponse.json({ data: atualizada });
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  if (!UUID_REGEX.test(params.id)) {
    return erroApi("Identificador inválido.", 400);
  }

  const sessao = await exigirSessao();
  if (sessao.erro) return sessao.erro;
  const { supabase, profile } = sessao;

  const { error } = await supabase
    .from("internal_tasks")
    .delete()
    .eq("id", params.id)
    .eq("escritorio_id", profile.escritorio_id);

  if (error) {
    return erroApi("Não foi possível excluir o cartão.", 403, error);
  }

  return NextResponse.json({ ok: true });
}
