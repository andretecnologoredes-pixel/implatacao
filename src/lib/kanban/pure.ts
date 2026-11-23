export type StatusTarefa = "pendente" | "em_andamento" | "concluida";
export type CriticidadeTarefa = "normal" | "urgente" | "critico";
export type CorObservacao = "amarelo" | "azul" | "verde" | "vermelho" | "roxo" | "cinza";
export type VisaoCartoes = "detalhada" | "compacta";

export interface ColunaPosicao {
  id: string;
  posicao: number;
}

export interface TarefaOrdenavel {
  id: string;
  coluna_id: string | null;
  ordem: number;
  status: StatusTarefa;
  concluida_em: string | null;
  cancelada_em?: string | null;
  data_limite?: string | null;
  responsible_id?: string;
  created_by?: string | null;
  envolvidos?: string[];
  titulo?: string;
  criticidade?: CriticidadeTarefa;
}

export function statusDaPosicao(
  posicao: number,
  colunas: ColunaPosicao[]
): StatusTarefa {
  if (!colunas.length) return "pendente";
  const posicoes = colunas.map((c) => c.posicao);
  const min = Math.min(...posicoes);
  const max = Math.max(...posicoes);
  if (posicao === max) return "concluida";
  if (posicao === min) return "pendente";
  return "em_andamento";
}

export function reordenar<T extends TarefaOrdenavel>(
  lista: T[],
  id: string,
  coluna: string,
  antesDe: string | null,
  colunasDoQuadro?: ColunaPosicao[],
  agoraIso: string = new Date().toISOString()
): { lista: T[]; coluna: string[] } {
  const tarefa = lista.find((t) => t.id === id);
  if (!tarefa || id === antesDe) {
    return {
      lista,
      coluna: lista.filter((t) => t.coluna_id === coluna).map((t) => t.id),
    };
  }

  const colInfo = colunasDoQuadro?.find((c) => c.id === coluna);
  const novoStatus = colInfo
    ? statusDaPosicao(colInfo.posicao, colunasDoQuadro!)
    : tarefa.status;

  const movida: T = {
    ...tarefa,
    coluna_id: coluna,
    status: novoStatus,
    concluida_em:
      novoStatus === "concluida"
        ? tarefa.concluida_em ?? agoraIso
        : null,
  };

  const resto = lista.filter((t) => t.id !== id);
  const destino = resto.filter((t) => t.coluna_id === coluna);
  const pos = antesDe ? destino.findIndex((t) => t.id === antesDe) : -1;
  destino.splice(pos === -1 ? destino.length : pos, 0, movida);

  const destinoReindexado = destino.map((item, idx) => ({
    ...item,
    ordem: idx,
  }));

  const outrasColunas = resto
    .filter((t) => t.coluna_id !== coluna)
    .map((item) => {
      if (item.coluna_id !== tarefa.coluna_id) return item;
      const irmaos = resto
        .filter((r) => r.coluna_id === tarefa.coluna_id)
        .map((r) => r.id);
      const novaOrdem = irmaos.indexOf(item.id);
      return novaOrdem >= 0 ? { ...item, ordem: novaOrdem } : item;
    });

  return {
    lista: [...outrasColunas, ...destinoReindexado],
    coluna: destinoReindexado.map((t) => t.id),
  };
}

// Árvore de sub-itens (máximo 3 níveis; órfão vira raiz; mantém ordem)
export const MAX_NIVEIS_SUBITEM = 3;

export interface SubItemBase {
  id: string;
  task_id: string;
  parent_id: string | null;
  responsavel_id: string | null;
  titulo: string;
  concluido: boolean;
  ordem: number;
}

export interface SubItemNo<T extends SubItemBase = SubItemBase> {
  item: T;
  nivel: number; // 1 a 3
  filhos: SubItemNo<T>[];
}

export function montarArvoreSubitens<T extends SubItemBase>(
  itens: T[]
): SubItemNo<T>[] {
  const ordenados = [...itens].sort((a, b) => a.ordem - b.ordem);
  const mapa = new Map<string, T>();
  for (const it of ordenados) mapa.set(it.id, it);

  const filhosPorPai = new Map<string | null, T[]>();
  for (const it of ordenados) {
    const paiValido = it.parent_id && mapa.has(it.parent_id) ? it.parent_id : null;
    const chave = paiValido;
    const arr = filhosPorPai.get(chave) ?? [];
    arr.push(it);
    filhosPorPai.set(chave, arr);
  }

  function construir(parentId: string | null, nivel: number): SubItemNo<T>[] {
    if (nivel > MAX_NIVEIS_SUBITEM) return [];
    const filhos = filhosPorPai.get(parentId) ?? [];
    return filhos.map((item) => ({
      item,
      nivel,
      filhos: construir(item.id, nivel + 1),
    }));
  }

  return construir(null, 1);
}

// Filtros (Seção 7)
export type PeriodoFiltro =
  | "todos"
  | "hoje"
  | "amanha"
  | "esta_semana"
  | "este_mes"
  | "proximos_3"
  | "proxima_semana"
  | "proximo_mes"
  | "ontem"
  | "ultimos_7"
  | "ultimos_30"
  | "personalizado";

export type AtribuicaoFiltro = "todas" | "responsavel" | "criador" | "envolvido";
export type StatusFiltro = "todos" | "canceladas";

export interface FiltrosKanban {
  quadro?: string;
  periodo: PeriodoFiltro;
  de?: string;
  ate?: string;
  pessoa?: string;
  atrib: AtribuicaoFiltro;
  status: StatusFiltro;
  minhas?: boolean;
}

const PERIODOS_VALIDOS = new Set<PeriodoFiltro>([
  "todos",
  "hoje",
  "amanha",
  "esta_semana",
  "este_mes",
  "proximos_3",
  "proxima_semana",
  "proximo_mes",
  "ontem",
  "ultimos_7",
  "ultimos_30",
  "personalizado",
]);

function isDataIso(valor?: string): valor is string {
  return typeof valor === "string" && /^\d{4}-\d{2}-\d{2}$/.test(valor);
}

export function normalizarFiltros(
  raw: Record<string, string | undefined>,
  euId?: string
): FiltrosKanban {
  let periodo: PeriodoFiltro = PERIODOS_VALIDOS.has(raw.periodo as PeriodoFiltro)
    ? (raw.periodo as PeriodoFiltro)
    : "todos";

  let de = isDataIso(raw.de) ? raw.de : undefined;
  let ate = isDataIso(raw.ate) ? raw.ate : undefined;

  if (periodo === "personalizado") {
    if (!de || !ate || de > ate) {
      periodo = "todos";
      de = undefined;
      ate = undefined;
    }
  } else {
    de = undefined;
    ate = undefined;
  }

  const minhas = raw.minhas === "1" && Boolean(euId);
  const pessoa = minhas ? euId : raw.pessoa || undefined;
  const atrib: AtribuicaoFiltro = minhas
    ? "responsavel"
    : pessoa && ["todas", "responsavel", "criador", "envolvido"].includes(raw.atrib ?? "")
    ? (raw.atrib as AtribuicaoFiltro)
    : "todas";

  const status: StatusFiltro = raw.status === "canceladas" ? "canceladas" : "todos";

  return {
    quadro: raw.quadro || undefined,
    periodo,
    de,
    ate,
    pessoa,
    atrib,
    status,
    minhas,
  };
}

export function calcularIntervaloPeriodo(
  periodo: PeriodoFiltro,
  hojeIso: string,
  dePersonalizado?: string,
  atePersonalizado?: string
): { inicio: string; fim: string } | null {
  if (periodo === "todos") return null;
  if (periodo === "personalizado") {
    if (!dePersonalizado || !atePersonalizado) return null;
    return { inicio: dePersonalizado, fim: atePersonalizado };
  }

  const base = new Date(`${hojeIso}T12:00:00Z`);
  const addDias = (d: Date, dias: number) => {
    const copia = new Date(d);
    copia.setUTCDate(copia.getUTCDate() + dias);
    return copia.toISOString().slice(0, 10);
  };

  if (periodo === "hoje") return { inicio: hojeIso, fim: hojeIso };
  if (periodo === "amanha") {
    const d = addDias(base, 1);
    return { inicio: d, fim: d };
  }
  if (periodo === "ontem") {
    const d = addDias(base, -1);
    return { inicio: d, fim: d };
  }
  if (periodo === "proximos_3") {
    return { inicio: hojeIso, fim: addDias(base, 3) };
  }
  if (periodo === "ultimos_7") {
    return { inicio: addDias(base, -6), fim: hojeIso };
  }
  if (periodo === "ultimos_30") {
    return { inicio: addDias(base, -29), fim: hojeIso };
  }

  const diaSemana = base.getUTCDay(); // 0 = domingo, 6 = sábado
  if (periodo === "esta_semana") {
    return { inicio: addDias(base, -diaSemana), fim: addDias(base, 6 - diaSemana) };
  }
  if (periodo === "proxima_semana") {
    const inicioProx = addDias(base, 7 - diaSemana);
    return { inicio: inicioProx, fim: addDias(new Date(`${inicioProx}T12:00:00Z`), 6) };
  }

  const ano = base.getUTCFullYear();
  const mes = periodo === "proximo_mes" ? base.getUTCMonth() + 1 : base.getUTCMonth();
  const inicioMes = new Date(Date.UTC(ano, mes, 1)).toISOString().slice(0, 10);
  const fimMes = new Date(Date.UTC(ano, mes + 1, 0)).toISOString().slice(0, 10);
  return { inicio: inicioMes, fim: fimMes };
}

export function filtrarTarefas(
  tarefas: TarefaOrdenavel[],
  filtros: FiltrosKanban,
  hojeIso: string
): TarefaOrdenavel[] {
  const intervalo = calcularIntervaloPeriodo(
    filtros.periodo,
    hojeIso,
    filtros.de,
    filtros.ate
  );

  return tarefas.filter((t) => {
    const cancelada = Boolean(t.cancelada_em);
    if (filtros.status === "canceladas") {
      if (!cancelada) return false;
    } else if (cancelada) {
      return false;
    }

    if (filtros.pessoa) {
      const p = filtros.pessoa;
      const ehResp = t.responsible_id === p;
      const ehCriador = t.created_by === p;
      const ehEnvolvido = Array.isArray(t.envolvidos) && t.envolvidos.includes(p);
      if (filtros.atrib === "responsavel" && !ehResp) return false;
      if (filtros.atrib === "criador" && !ehCriador) return false;
      if (filtros.atrib === "envolvido" && !ehEnvolvido) return false;
      if (filtros.atrib === "todas" && !ehResp && !ehCriador && !ehEnvolvido) {
        return false;
      }
    }

    if (intervalo) {
      if (!t.data_limite) return false;
      if (t.data_limite < intervalo.inicio || t.data_limite > intervalo.fim) {
        return false;
      }
    }

    return true;
  });
}

// Permissões calculadas (Seção 4.2)
export interface UsuarioSessao {
  id: string;
  cargo: string;
  ativo: boolean;
  podeEditarTarefasGeral?: boolean;
}

export interface GrupoInfo {
  id: string;
  pessoal: boolean;
  created_by: string | null;
  membro?: {
    pode_editar: boolean;
    pode_excluir: boolean;
  } | null;
}

export interface QuadroInfo {
  id: string;
  pessoal: boolean;
  compartilhado: boolean;
  created_by: string | null;
  grupo_id: string | null;
  membro?: {
    pode_editar: boolean;
  } | null;
}

export interface Permissoes {
  ver: boolean;
  editar: boolean;
  excluir: boolean;
  gerenciar: boolean;
}

const NENHUMA: Permissoes = { ver: false, editar: false, excluir: false, gerenciar: false };
const TUDO_SEM_GERENCIAR: Permissoes = {
  ver: true,
  editar: true,
  excluir: true,
  gerenciar: false,
};
const TUDO: Permissoes = { ver: true, editar: true, excluir: true, gerenciar: true };

export function permissoesNoGrupo(
  grupo: GrupoInfo | null,
  eu: UsuarioSessao
): Permissoes {
  if (!eu.ativo) return NENHUMA;
  if (!grupo) return TUDO_SEM_GERENCIAR;
  if (grupo.pessoal) {
    return grupo.created_by === eu.id ? TUDO : NENHUMA;
  }
  const ehAdminOuCriador = eu.cargo === "administrador" || grupo.created_by === eu.id;
  if (ehAdminOuCriador) return TUDO;
  if (!grupo.membro) return NENHUMA;
  const excluir = Boolean(grupo.membro.pode_excluir);
  const editar = Boolean(grupo.membro.pode_editar) || excluir;
  return { ver: true, editar, excluir, gerenciar: false };
}

export function permissoesNoQuadro(
  quadro: QuadroInfo,
  eu: UsuarioSessao,
  doGrupo: Permissoes
): Permissoes {
  if (!eu.ativo) return NENHUMA;
  if (quadro.pessoal) {
    return quadro.created_by === eu.id ? TUDO : NENHUMA;
  }

  const ehAdminOuCriador = eu.cargo === "administrador" || quadro.created_by === eu.id;
  let base: Permissoes;

  if (!quadro.compartilhado) {
    base = doGrupo;
  } else if (ehAdminOuCriador) {
    base = { ver: true, editar: true, excluir: true, gerenciar: doGrupo.gerenciar };
  } else if (doGrupo.gerenciar) {
    base = doGrupo;
  } else if (quadro.membro) {
    base = {
      ver: true,
      editar: Boolean(quadro.membro.pode_editar),
      excluir: false,
      gerenciar: false,
    };
  } else {
    base = NENHUMA;
  }

  if (eu.podeEditarTarefasGeral === false && !quadro.pessoal) {
    return { ...base, editar: false, excluir: false };
  }

  return base;
}

// Preferência de visão e recolhidos (Seção 5.8)
export interface PreferenciaRecolhidos {
  visao: VisaoCartoes;
  colunas: string[];
  excecoes: string[];
}

export function lerPreferenciaRecolhidos(rawJson: string | null): PreferenciaRecolhidos {
  const padrao: PreferenciaRecolhidos = { visao: "detalhada", colunas: [], excecoes: [] };
  if (!rawJson) return padrao;
  try {
    const parsed = JSON.parse(rawJson);
    const visao: VisaoCartoes = parsed?.visao === "compacta" ? "compacta" : "detalhada";
    const colunas = Array.isArray(parsed?.colunas)
      ? parsed.colunas.filter((x: unknown): x is string => typeof x === "string").slice(0, 500)
      : [];
    const excecoes = Array.isArray(parsed?.excecoes)
      ? parsed.excecoes.filter((x: unknown): x is string => typeof x === "string").slice(0, 500)
      : [];
    return { visao, colunas, excecoes };
  } catch {
    return padrao;
  }
}

export function isCartaoCompacto(
  cartaoId: string,
  pref: PreferenciaRecolhidos
): boolean {
  const baseCompacta = pref.visao === "compacta";
  const temExcecao = pref.excecoes.includes(cartaoId);
  return temExcecao ? !baseCompacta : baseCompacta;
}

// Prazo do quadro (Seção 10)
export type SituacaoPrazoQuadro = "concluido" | "atrasado" | "em_dia" | null;

export function situacaoDoPrazo(
  concluirAte: string | Date | null | undefined,
  cartoesAbertos: number,
  agora: Date = new Date()
): SituacaoPrazoQuadro {
  if (!concluirAte) return null;
  if (cartoesAbertos <= 0) return "concluido";
  const limite = typeof concluirAte === "string" ? new Date(concluirAte) : concluirAte;
  if (agora.getTime() > limite.getTime()) return "atrasado";
  return "em_dia";
}
