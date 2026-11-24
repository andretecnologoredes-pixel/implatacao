"use client";

import React, { useMemo, useState } from "react";
import {
  montarArvoreSubitens,
  reordenar,
  type CriticidadeTarefa,
  type StatusTarefa,
  type SubItemBase,
  type SubItemNo,
} from "@/lib/kanban/pure";

export interface ColunaKanban {
  id: string;
  nome: string;
  posicao: number;
}

export interface PerfilMembro {
  id: string;
  nome: string;
}

export interface TarefaKanban {
  id: string;
  titulo: string;
  responsible_id: string;
  status: StatusTarefa;
  data_limite: string | null;
  criticidade: CriticidadeTarefa;
  ordem: number;
  descricao: string | null;
  concluida_em: string | null;
  cancelada_em: string | null;
  created_by: string | null;
  envolvidos: string[];
  coluna_id: string | null;
}

interface KanbanBoardProps {
  quadroNome: string;
  colunas: ColunaKanban[];
  tarefasIniciais: TarefaKanban[];
  itensIniciais: SubItemBase[];
  membros: PerfilMembro[];
  usuarioAtualId: string;
}

const COR_CRITICIDADE: Record<CriticidadeTarefa, string> = {
  normal: "bg-slate-100 text-slate-700",
  urgente: "bg-amber-100 text-amber-800",
  critico: "bg-rose-100 text-rose-800",
};

export function KanbanBoard({
  quadroNome,
  colunas,
  tarefasIniciais,
  itensIniciais,
  membros,
  usuarioAtualId,
}: KanbanBoardProps) {
  const [tarefas, setTarefas] = useState<TarefaKanban[]>(tarefasIniciais);
  const [itens, setItens] = useState<SubItemBase[]>(itensIniciais);
  const [arrastandoId, setArrastandoId] = useState<string | null>(null);
  const [alvoColunaId, setAlvoColunaId] = useState<string | null>(null);
  const [erroBanner, setErroBanner] = useState<string | null>(null);

  // Estado de criação rápida
  const [colunaNovaTarefa, setColunaNovaTarefa] = useState<string | null>(null);
  const [novoTitulo, setNovoTitulo] = useState("");
  const [novoResponsavel, setNovoResponsavel] = useState(usuarioAtualId);
  const [novaCriticidade, setNovaCriticidade] = useState<CriticidadeTarefa>("normal");
  const [salvandoNovo, setSalvandoNovo] = useState(false);

  // Modal de detalhes / sub-itens
  const [tarefaAbertaId, setTarefaAbertaId] = useState<string | null>(null);
  const [novoSubitemTitulo, setNovoSubitemTitulo] = useState("");
  const [subitemPaiId, setSubitemPaiId] = useState<string | null>(null);

  const colunasOrdenadas = useMemo(
    () => [...colunas].sort((a, b) => a.posicao - b.posicao),
    [colunas]
  );

  const mapaMembros = useMemo(
    () => new Map(membros.map((m) => [m.id, m.nome])),
    [membros]
  );

  const tarefaAberta = useMemo(
    () => tarefas.find((t) => t.id === tarefaAbertaId) ?? null,
    [tarefas, tarefaAbertaId]
  );

  const arvoreSubitensAberta = useMemo(() => {
    if (!tarefaAberta) return [];
    const doCartao = itens.filter((i) => i.task_id === tarefaAberta.id);
    return montarArvoreSubitens(doCartao);
  }, [itens, tarefaAberta]);

  async function persistirOrdem(colunaId: string, idsOrdenados: string[], snapshotAnterior: TarefaKanban[]) {
    try {
      const resp = await fetch("/api/tasks/ordem", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ coluna_id: colunaId, ids: idsOrdenados }),
      });
      if (!resp.ok) {
        const json = await resp.json().catch(() => ({}));
        throw new Error(json.error ?? "Falha ao mover cartão.");
      }
    } catch (err) {
      setTarefas(snapshotAnterior);
      setErroBanner(err instanceof Error ? err.message : "Erro ao salvar posição.");
    }
  }

  function handleDrop(colunaDestinoId: string, antesDeId: string | null) {
    if (!arrastandoId) return;
    const snapshot = tarefas;
    const resultado = reordenar(
      tarefas,
      arrastandoId,
      colunaDestinoId,
      antesDeId,
      colunasOrdenadas
    );
    setTarefas(resultado.lista);
    setArrastandoId(null);
    setAlvoColunaId(null);
    setErroBanner(null);
    void persistirOrdem(colunaDestinoId, resultado.coluna, snapshot);
  }

  async function handleCriarCartao(e: React.FormEvent) {
    e.preventDefault();
    if (!colunaNovaTarefa || !novoTitulo.trim() || salvandoNovo) return;
    setSalvandoNovo(true);
    setErroBanner(null);

    try {
      const resp = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          titulo: novoTitulo.trim(),
          responsible_id: novoResponsavel || usuarioAtualId,
          criticidade: novaCriticidade,
          coluna_id: colunaNovaTarefa,
        }),
      });
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error ?? "Erro ao criar cartão.");

      setTarefas((prev) => [...prev, json.data]);
      setNovoTitulo("");
      setColunaNovaTarefa(null);
    } catch (err) {
      setErroBanner(err instanceof Error ? err.message : "Erro ao criar cartão.");
    } finally {
      setSalvandoNovo(false);
    }
  }

  async function handleCriarSubitem(e: React.FormEvent) {
    e.preventDefault();
    if (!tarefaAberta || !novoSubitemTitulo.trim()) return;

    try {
      const resp = await fetch(`/api/tasks/${tarefaAberta.id}/itens`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          titulo: novoSubitemTitulo.trim(),
          parent_id: subitemPaiId ?? undefined,
        }),
      });
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error ?? "Erro ao adicionar sub-item.");

      setItens((prev) => [...prev, json.data]);
      setNovoSubitemTitulo("");
      setSubitemPaiId(null);
    } catch (err) {
      setErroBanner(err instanceof Error ? err.message : "Erro ao adicionar sub-item.");
    }
  }

  async function handleAlternarSubitem(item: SubItemBase) {
    if (!tarefaAberta) return;
    const proximoValor = !item.concluido;
    const snapshot = itens;

    setItens((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, concluido: proximoValor } : i))
    );

    try {
      const resp = await fetch(`/api/tasks/${tarefaAberta.id}/itens/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ concluido: proximoValor }),
      });
      if (!resp.ok) {
        const json = await resp.json().catch(() => ({}));
        throw new Error(json.error ?? "Erro ao atualizar sub-item.");
      }
    } catch (err) {
      setItens(snapshot);
      setErroBanner(err instanceof Error ? err.message : "Erro ao atualizar sub-item.");
    }
  }

  async function handleExcluirCartao(taskId: string) {
    const snapshot = tarefas;
    setTarefas((prev) => prev.filter((t) => t.id !== taskId));
    setTarefaAbertaId(null);

    try {
      const resp = await fetch(`/api/tasks/${taskId}`, { method: "DELETE" });
      if (!resp.ok) {
        const json = await resp.json().catch(() => ({}));
        throw new Error(json.error ?? "Sem permissão para excluir.");
      }
    } catch (err) {
      setTarefas(snapshot);
      setErroBanner(err instanceof Error ? err.message : "Erro ao excluir cartão.");
    }
  }

  function renderizarNosSubitens(nos: SubItemNo<SubItemBase>[]) {
    return nos.map((no) => (
      <div key={no.item.id} className="space-y-1">
        <div
          className="flex items-center justify-between rounded border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-sm"
          style={{ marginLeft: `${(no.nivel - 1) * 16}px` }}
        >
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={no.item.concluido}
              onChange={() => void handleAlternarSubitem(no.item)}
              className="h-4 w-4 rounded border-slate-300"
            />
            <span className={no.item.concluido ? "text-slate-400 line-through" : "text-slate-800"}>
              {no.item.titulo}
            </span>
          </label>
          {no.nivel < 3 && (
            <button
              type="button"
              onClick={() => setSubitemPaiId(no.item.id)}
              className="text-xs text-sky-700 hover:underline"
            >
              + sub-item
            </button>
          )}
        </div>
        {no.filhos.length > 0 && renderizarNosSubitens(no.filhos)}
      </div>
    ));
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-100 text-slate-900">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4 shadow-sm">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">{quadroNome}</h1>
          <p className="text-xs text-slate-500">
            Arraste os cartões entre colunas para atualizar o status automaticamente
          </p>
        </div>
      </header>

      {erroBanner && (
        <div className="mx-6 mt-4 flex items-center justify-between rounded-md border border-rose-300 bg-rose-50 px-4 py-2.5 text-sm text-rose-800">
          <span>{erroBanner}</span>
          <button
            type="button"
            onClick={() => setErroBanner(null)}
            className="font-medium underline"
          >
            Fechar
          </button>
        </div>
      )}

      <main className="flex flex-1 gap-4 overflow-x-auto p-6">
        {colunasOrdenadas.map((coluna) => {
          const cartoesColuna = tarefas
            .filter((t) => t.coluna_id === coluna.id && !t.cancelada_em)
            .sort((a, b) => a.ordem - b.ordem);

          return (
            <section
              key={coluna.id}
              onDragOver={(e) => {
                e.preventDefault();
                setAlvoColunaId(coluna.id);
              }}
              onDragLeave={() => setAlvoColunaId(null)}
              onDrop={(e) => {
                e.preventDefault();
                handleDrop(coluna.id, null);
              }}
              className={`flex w-80 shrink-0 flex-col rounded-xl border bg-slate-50 p-3 transition ${
                alvoColunaId === coluna.id ? "border-sky-500 bg-sky-50/40" : "border-slate-200"
              }`}
            >
              <div className="mb-3 flex items-center justify-between px-1">
                <h2 className="text-sm font-semibold text-slate-800">{coluna.nome}</h2>
                <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-700">
                  {cartoesColuna.length}
                </span>
              </div>

              <div className="flex flex-1 flex-col gap-2.5">
                {cartoesColuna.map((cartao) => {
                  const totalItens = itens.filter((i) => i.task_id === cartao.id);
                  const concluidos = totalItens.filter((i) => i.concluido).length;

                  return (
                    <article
                      key={cartao.id}
                      draggable
                      onDragStart={() => setArrastandoId(cartao.id)}
                      onDragEnd={() => {
                        setArrastandoId(null);
                        setAlvoColunaId(null);
                      }}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleDrop(coluna.id, cartao.id);
                      }}
                      onClick={() => setTarefaAbertaId(cartao.id)}
                      className="cursor-pointer rounded-lg border border-slate-200 bg-white p-3 shadow-sm transition hover:border-slate-300 hover:shadow"
                    >
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <span
                          className={`rounded px-2 py-0.5 text-[11px] font-medium ${
                            COR_CRITICIDADE[cartao.criticidade]
                          }`}
                        >
                          {cartao.criticidade}
                        </span>
                        {cartao.data_limite && (
                          <span className="text-[11px] text-slate-500">
                            Prazo: {cartao.data_limite}
                          </span>
                        )}
                      </div>

                      <h3 className="text-sm font-medium text-slate-900">{cartao.titulo}</h3>

                      <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                        <span>{mapaMembros.get(cartao.responsible_id) ?? "Responsável"}</span>
                        {totalItens.length > 0 && (
                          <span>
                            Checklist: {concluidos}/{totalItens.length}
                          </span>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>

              {colunaNovaTarefa === coluna.id ? (
                <form onSubmit={handleCriarCartao} className="mt-3 space-y-2 rounded-lg border border-slate-200 bg-white p-2.5">
                  <input
                    type="text"
                    placeholder="Título do cartão..."
                    value={novoTitulo}
                    onChange={(e) => setNovoTitulo(e.target.value)}
                    className="w-full rounded border border-slate-300 px-2.5 py-1.5 text-sm"
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <select
                      value={novoResponsavel}
                      onChange={(e) => setNovoResponsavel(e.target.value)}
                      className="flex-1 rounded border border-slate-300 px-2 py-1 text-xs"
                    >
                      {membros.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.nome}
                        </option>
                      ))}
                    </select>
                    <select
                      value={novaCriticidade}
                      onChange={(e) => setNovaCriticidade(e.target.value as CriticidadeTarefa)}
                      className="rounded border border-slate-300 px-2 py-1 text-xs"
                    >
                      <option value="normal">Normal</option>
                      <option value="urgente">Urgente</option>
                      <option value="critico">Crítico</option>
                    </select>
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setColunaNovaTarefa(null)}
                      className="rounded px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-100"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={salvandoNovo}
                      className="rounded bg-slate-900 px-3 py-1 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                    >
                      {salvandoNovo ? "Salvando..." : "Adicionar"}
                    </button>
                  </div>
                </form>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setColunaNovaTarefa(coluna.id);
                    setNovoResponsavel(usuarioAtualId);
                  }}
                  className="mt-3 rounded-lg border border-dashed border-slate-300 py-2 text-xs font-medium text-slate-600 hover:border-slate-400 hover:bg-white"
                >
                  + Novo cartão
                </button>
              )}
            </section>
          );
        })}
      </main>

      {tarefaAberta && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => {
            setTarefaAbertaId(null);
            setSubitemPaiId(null);
          }}
        >
          <div
            className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <span className="text-xs uppercase tracking-wide text-slate-400">
                  Status: {tarefaAberta.status}
                </span>
                <h2 className="text-lg font-semibold text-slate-900">{tarefaAberta.titulo}</h2>
              </div>
              <button
                type="button"
                onClick={() => setTarefaAbertaId(null)}
                className="rounded px-2 py-1 text-sm text-slate-500 hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            {tarefaAberta.descricao && (
              <p className="mb-4 rounded bg-slate-50 p-3 text-sm text-slate-700">
                {tarefaAberta.descricao}
              </p>
            )}

            <div className="mb-4">
              <h3 className="mb-2 text-sm font-semibold text-slate-800">Checklist / Sub-itens</h3>
              <div className="space-y-1.5">
                {arvoreSubitensAberta.length > 0 ? (
                  renderizarNosSubitens(arvoreSubitensAberta)
                ) : (
                  <p className="text-xs text-slate-400">Nenhum sub-item cadastrado.</p>
                )}
              </div>

              <form onSubmit={handleCriarSubitem} className="mt-3 flex gap-2">
                <input
                  type="text"
                  placeholder={
                    subitemPaiId ? "Título do sub-item filho..." : "Adicionar item ao checklist..."
                  }
                  value={novoSubitemTitulo}
                  onChange={(e) => setNovoSubitemTitulo(e.target.value)}
                  className="flex-1 rounded border border-slate-300 px-3 py-1.5 text-sm"
                />
                <button
                  type="submit"
                  className="rounded bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800"
                >
                  Incluir
                </button>
              </form>
            </div>

            <div className="flex justify-between border-t border-slate-200 pt-4">
              <button
                type="button"
                onClick={() => void handleExcluirCartao(tarefaAberta.id)}
                className="rounded px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50"
              >
                Excluir cartão
              </button>
              <button
                type="button"
                onClick={() => setTarefaAbertaId(null)}
                className="rounded bg-slate-100 px-4 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200"
              >
                Concluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
