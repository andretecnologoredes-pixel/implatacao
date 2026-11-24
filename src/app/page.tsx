import { KanbanBoard } from "@/components/kanban/KanbanBoard";
import { getSupabaseServer } from "@/lib/kanban/server";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
        <div className="max-w-md rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <h1 className="text-lg font-semibold text-slate-900">Acesso necessário</h1>
          <p className="mt-2 text-sm text-slate-600">
            Autentique-se no Supabase Auth para carregar seu escritório e quadros Kanban.
          </p>
        </div>
      </main>
    );
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, escritorio_id, nome")
    .eq("id", user.id)
    .single();

  if (!profile) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
        <div className="max-w-md rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <h1 className="text-lg font-semibold text-slate-900">Perfil não vinculado</h1>
          <p className="mt-2 text-sm text-slate-600">
            Crie o registro do seu usuário na tabela <code>profiles</code> do Supabase.
          </p>
        </div>
      </main>
    );
  }

  const [{ data: quadros }, { data: membros }] = await Promise.all([
    supabase
      .from("kanban_quadros")
      .select("id, nome")
      .eq("escritorio_id", profile.escritorio_id)
      .is("arquivado_em", null)
      .order("created_at", { ascending: true })
      .limit(1),
    supabase
      .from("profiles")
      .select("id, nome")
      .eq("escritorio_id", profile.escritorio_id)
      .eq("ativo", true)
      .order("nome", { ascending: true }),
  ]);

  const quadroAtivo = quadros?.[0];
  if (!quadroAtivo) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
        <div className="max-w-md rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <h1 className="text-lg font-semibold text-slate-900">Nenhum quadro criado</h1>
          <p className="mt-2 text-sm text-slate-600">
            Cadastre um quadro inicial em <code>kanban_quadros</code> e suas colunas em{" "}
            <code>kanban_colunas</code> no Supabase.
          </p>
        </div>
      </main>
    );
  }

  const { data: colunas } = await supabase
    .from("kanban_colunas")
    .select("id, nome, posicao")
    .eq("quadro_id", quadroAtivo.id)
    .order("posicao", { ascending: true });

  const colunaIds = (colunas ?? []).map((c) => c.id);
  const { data: tarefas } = colunaIds.length
    ? await supabase
        .from("internal_tasks")
        .select("*")
        .in("coluna_id", colunaIds)
        .order("ordem", { ascending: true })
    : { data: [] };

  const taskIds = (tarefas ?? []).map((t) => t.id);
  const { data: itens } = taskIds.length
    ? await supabase
        .from("tarefa_itens")
        .select("*")
        .in("task_id", taskIds)
        .order("ordem", { ascending: true })
    : { data: [] };

  return (
    <KanbanBoard
      quadroNome={quadroAtivo.nome}
      colunas={colunas ?? []}
      tarefasIniciais={tarefas ?? []}
      itensIniciais={itens ?? []}
      membros={membros ?? []}
      usuarioAtualId={profile.id}
    />
  );
}
