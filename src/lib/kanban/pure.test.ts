import { describe, expect, it } from "vitest";
import {
  filtrarTarefas,
  isCartaoCompacto,
  lerPreferenciaRecolhidos,
  montarArvoreSubitens,
  normalizarFiltros,
  permissoesNoGrupo,
  permissoesNoQuadro,
  reordenar,
  situacaoDoPrazo,
  statusDaPosicao,
  type TarefaOrdenavel,
} from "./pure";
import { TarefaEdicaoSchema, TarefaSchema } from "./schemas";

const colunas = [
  { id: "c1", posicao: 1 },
  { id: "c2", posicao: 2 },
  { id: "c3", posicao: 3 },
];

const baseTarefas: TarefaOrdenavel[] = [
  {
    id: "t1",
    coluna_id: "c1",
    ordem: 0,
    status: "pendente",
    concluida_em: null,
    data_limite: "2026-11-23",
    responsible_id: "u1",
    created_by: "u1",
    envolvidos: ["u2"],
  },
  {
    id: "t2",
    coluna_id: "c1",
    ordem: 1,
    status: "pendente",
    concluida_em: null,
    data_limite: "2026-11-25",
    responsible_id: "u2",
    created_by: "u1",
    envolvidos: [],
  },
  {
    id: "t3",
    coluna_id: "c2",
    ordem: 0,
    status: "em_andamento",
    concluida_em: null,
    data_limite: null,
    responsible_id: "u1",
    created_by: "u2",
    envolvidos: [],
  },
];

describe("Kanban - funções puras e validações", () => {
  it("calcula status pela posição da coluna", () => {
    expect(statusDaPosicao(1, colunas)).toBe("pendente");
    expect(statusDaPosicao(2, colunas)).toBe("em_andamento");
    expect(statusDaPosicao(3, colunas)).toBe("concluida");
  });

  it("reordena antes de um cartão, no fim, na mesma coluna, em outra e ignora id == antesDe", () => {
    const mesmoId = reordenar(baseTarefas, "t1", "c1", "t1", colunas);
    expect(mesmoId.coluna).toEqual(["t1", "t2"]);

    const antesDeT2 = reordenar(baseTarefas, "t2", "c1", "t1", colunas);
    expect(antesDeT2.coluna).toEqual(["t2", "t1"]);

    const paraUltimaColuna = reordenar(
      baseTarefas,
      "t1",
      "c3",
      null,
      colunas,
      "2026-11-23T10:00:00.000Z"
    );
    expect(paraUltimaColuna.coluna).toEqual(["t1"]);
    const movida = paraUltimaColuna.lista.find((t) => t.id === "t1");
    expect(movida?.status).toBe("concluida");
    expect(movida?.concluida_em).toBe("2026-11-23T10:00:00.000Z");

    const voltaParaPrimeira = reordenar([movida!], "t1", "c1", null, colunas);
    expect(voltaParaPrimeira.lista[0].status).toBe("pendente");
    expect(voltaParaPrimeira.lista[0].concluida_em).toBeNull();
  });

  it("monta árvore de sub-itens respeitando 3 níveis e órfãos", () => {
    const arvore = montarArvoreSubitens([
      { id: "i1", task_id: "t1", parent_id: null, responsavel_id: null, titulo: "N1", concluido: false, ordem: 0 },
      { id: "i2", task_id: "t1", parent_id: "i1", responsavel_id: null, titulo: "N2", concluido: false, ordem: 0 },
      { id: "i3", task_id: "t1", parent_id: "i2", responsavel_id: null, titulo: "N3", concluido: false, ordem: 0 },
      { id: "i4", task_id: "t1", parent_id: "i3", responsavel_id: null, titulo: "N4", concluido: false, ordem: 0 },
      { id: "i5", task_id: "t1", parent_id: "inexistente", responsavel_id: null, titulo: "Orfao", concluido: false, ordem: 1 },
    ]);

    expect(arvore.map((n) => n.item.id)).toEqual(["i1", "i5"]);
    expect(arvore[0].filhos[0].filhos[0].item.id).toBe("i3");
    expect(arvore[0].filhos[0].filhos[0].filhos).toEqual([]);
  });

  it("normaliza filtros e volta personalizado inválido para todos", () => {
    const invalido = normalizarFiltros({ periodo: "personalizado", de: "2026-11-30", ate: "2026-11-10" });
    expect(invalido.periodo).toBe("todos");
    expect(invalido.de).toBeUndefined();

    const valido = normalizarFiltros({ periodo: "personalizado", de: "2026-11-20", ate: "2026-11-25" });
    expect(valido.periodo).toBe("personalizado");

    const filtradas = filtrarTarefas(baseTarefas, valido, "2026-11-23");
    expect(filtradas.map((t) => t.id)).toEqual(["t1", "t2"]);
  });

  it("aplica permissões em grupo, quadro compartilhado e quadro pessoal", () => {
    const admin = { id: "a1", cargo: "administrador", ativo: true };
    const comum = { id: "u2", cargo: "membro", ativo: true };

    const pessoal = {
      id: "q-pessoal",
      pessoal: true,
      compartilhado: false,
      created_by: "u2",
      grupo_id: null,
    };

    expect(permissoesNoQuadro(pessoal, admin, permissoesNoGrupo(null, admin)).ver).toBe(false);
    expect(permissoesNoQuadro(pessoal, comum, permissoesNoGrupo(null, comum)).ver).toBe(true);

    const compartilhadoSoVer = {
      id: "q-comp",
      pessoal: false,
      compartilhado: true,
      created_by: "u1",
      grupo_id: null,
      membro: { pode_editar: false },
    };
    const permsVer = permissoesNoQuadro(compartilhadoSoVer, comum, permissoesNoGrupo(null, comum));
    expect(permsVer).toEqual({ ver: true, editar: false, excluir: false, gerenciar: false });
  });

  it("calcula preferência de visão e prazo do quadro", () => {
    const pref = lerPreferenciaRecolhidos('{"visao":"compacta","excecoes":["t1"]}');
    expect(isCartaoCompacto("t1", pref)).toBe(false);
    expect(isCartaoCompacto("t2", pref)).toBe(true);

    expect(situacaoDoPrazo(null, 2, new Date("2026-11-23T12:00:00Z"))).toBeNull();
    expect(situacaoDoPrazo("2026-11-20T12:00:00Z", 0, new Date("2026-11-23T12:00:00Z"))).toBe("concluido");
    expect(situacaoDoPrazo("2026-11-20T12:00:00Z", 1, new Date("2026-11-23T12:00:00Z"))).toBe("atrasado");
    expect(situacaoDoPrazo("2026-11-30T12:00:00Z", 1, new Date("2026-11-23T12:00:00Z"))).toBe("em_dia");
  });

  it("valida schemas Zod estritos", () => {
    expect(TarefaEdicaoSchema.safeParse({}).success).toBe(false);
    expect(
      TarefaSchema.safeParse({
        titulo: "Passagem de cabos CCO",
        responsible_id: "550e8400-e29b-41d4-a716-446655440000",
        extra_invalido: 123,
      }).success
    ).toBe(false);
  });
});
