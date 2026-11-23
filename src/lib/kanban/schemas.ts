import { z } from "zod";

const uuidSchema = z.string().uuid("Identificador inválido.");
const dataIsoSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida (AAAA-MM-DD).");
const corQuadroSchema = z.enum([
  "marinho",
  "petroleo",
  "roxo",
  "terracota",
  "azul",
  "vinho",
  "verde",
  "grafite",
  "indigo",
  "ciano",
  "ambar",
  "oliva",
]);
const corObservacaoSchema = z.enum([
  "amarelo",
  "azul",
  "verde",
  "vermelho",
  "roxo",
  "cinza",
]);

export const tituloSchema = z
  .string()
  .trim()
  .min(1, "Dê um título à tarefa.")
  .max(200, "Título deve ter no máximo 200 caracteres.");

export const envolvidosSchema = z
  .array(uuidSchema)
  .max(20, "Máximo de 20 pessoas envolvidas.");

export const TarefaSchema = z
  .object({
    titulo: tituloSchema,
    responsible_id: uuidSchema,
    data_limite: z.union([dataIsoSchema, z.literal("")]).optional(),
    criticidade: z.enum(["normal", "urgente", "critico"]).default("normal"),
    descricao: z.string().max(4000).optional(),
    coluna_id: uuidSchema.optional(),
    envolvidos: envolvidosSchema.optional(),
  })
  .strict();

export const TarefaEdicaoSchema = z
  .object({
    titulo: tituloSchema.optional(),
    responsible_id: uuidSchema.optional(),
    data_limite: z.union([dataIsoSchema, z.literal(""), z.null()]).optional(),
    criticidade: z.enum(["normal", "urgente", "critico"]).optional(),
    descricao: z.string().max(4000).nullable().optional(),
    coluna_id: uuidSchema.optional(),
    envolvidos: envolvidosSchema.optional(),
    cancelada: z.boolean().optional(),
    concluida_em: z.union([dataIsoSchema, z.string().datetime(), z.null()]).optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: "Nada para alterar.",
  });

export const OrdemTarefasSchema = z
  .object({
    coluna_id: uuidSchema,
    ids: z.array(uuidSchema).min(1).max(500),
  })
  .strict();

export const TarefaItemSchema = z
  .object({
    titulo: z.string().trim().min(1).max(200),
    parent_id: uuidSchema.optional(),
    responsavel_id: uuidSchema.nullable().optional(),
  })
  .strict();

export const TarefaItemEdicaoSchema = z
  .object({
    titulo: z.string().trim().min(1).max(200).optional(),
    concluido: z.boolean().optional(),
    responsavel_id: uuidSchema.nullable().optional(),
  })
  .strict()
  .refine(
    (d) =>
      d.titulo !== undefined || d.concluido !== undefined || d.responsavel_id !== undefined,
    { message: "Nada para alterar." }
  );

export const ObservacaoItemSchema = z
  .object({
    texto: z.string().trim().min(1).max(2000),
    cor: corObservacaoSchema.default("amarelo"),
  })
  .strict();

export const QuadroSchema = z
  .object({
    nome: z.string().trim().min(1).max(30),
    colunas: z
      .array(
        z
          .object({
            id: uuidSchema.optional(),
            nome: z.string().trim().min(1).max(25),
          })
          .strict()
      )
      .min(2)
      .max(10),
    pessoal: z.boolean().optional(),
  })
  .strict()
  .refine(
    (q) => {
      const ids = q.colunas.map((c) => c.id).filter(Boolean);
      return new Set(ids).size === ids.length;
    },
    { message: "Colunas com ID duplicado." }
  );

export const GrupoSchema = z
  .object({
    nome: z.string().trim().min(1).max(40),
    membros: z
      .array(
        z
          .object({
            profile_id: uuidSchema,
            pode_editar: z.boolean(),
            pode_excluir: z.boolean(),
          })
          .strict()
      )
      .max(50),
    quadro_id: uuidSchema.optional(),
    pessoal: z.boolean().optional(),
  })
  .strict();

export const QuadroOrganizacaoSchema = z
  .object({
    grupo_id: uuidSchema.nullable().optional(),
    arquivado: z.boolean().optional(),
    cor: corQuadroSchema.nullable().optional(),
  })
  .strict();

export const OrdemQuadrosSchema = z
  .object({
    ids: z.array(uuidSchema).min(1).max(200),
  })
  .strict();
