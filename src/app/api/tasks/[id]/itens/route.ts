import { NextResponse } from "next/server";
import { MAX_NIVEIS_SUBITEM } from "@/lib/kanban/pure";
import { TarefaItemSchema } from "@/lib/kanban/schemas";
import { erroApi, exigirSessao, UUID_REGEX } from "@/lib/kanban/server";

export async function POST(
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

  const parsed = TarefaItemSchema.safeParse(body);
  if (!parsed.success) {
    return erroApi(parsed.error.issues[0]?.message ?? "Dados inválidos.", 400);
  }

  const { titulo, parent_id, responsavel_id } = parsed.data;

  const { data: tarefa } = await supabase
    .from("internal_tasks")
    .select("id, responsible_id, envolvidos")
    .eq("id", params.id)
    .eq("escritorio_id", profile.escritorio_id)
    .single();

  if (!tarefa) {
    return erroApi("Cartão não encontrado.", 404);
  }

  if (responsavel_id) {
    const pessoasCartao = new Set([tarefa.responsible_id, ...(tarefa.envolvidos ?? [])]);
    if (!pessoasCartao.has(responsavel_id)) {
      return erroApi("O responsável pelo sub-item deve estar vinculado ao cartão.", 400);
    }
  }

  const { data: itensCartao } = await supabase
    .from("tarefa_itens")
    .select("id, parent_id, ordem")
    .eq("task_id", params.id);

  const listaItens = itensCartao ?? [];
  if (parent_id) {
    const mapa = new Map(listaItens.map((i) => [i.id, i]));
    let nivelPai = 0;
    let atual: string | null = parent_id;
    while (atual) {
      const no = mapa.get(atual);
      if (!no) return erroApi("Sub-item pai inválido.", 400);
      nivelPai += 1;
      atual = no.parent_id;
    }
    if (nivelPai >= MAX_NIVEIS_SUBITEM) {
      return erroApi("Limite máximo de 3 níveis de sub-itens atingido.", 400);
    }
  }

  const irmaos = listaItens.filter((i) => (i.parent_id ?? null) === (parent_id ?? null));
  const proximaOrdem = irmaos.reduce((max, i) => Math.max(max, i.ordem), -1) + 1;

  const { data: criado, error } = await supabase
    .from("tarefa_itens")
    .insert({
      task_id: params.id,
      parent_id: parent_id ?? null,
      responsavel_id: responsavel_id ?? null,
      titulo,
      ordem: proximaOrdem,
    })
    .select("*")
    .single();

  if (error || !criado) {
    return erroApi("Não foi possível criar o sub-item.", 403, error);
  }

  return NextResponse.json({ data: criado }, { status: 201 });
}
