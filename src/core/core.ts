import { loadFiles, loadFilesSync } from "@graphql-tools/load-files";
import { createModule } from "graphql-modules";
import type { TypeDefs } from "graphql-modules";
import type { ResolverContext } from "../types.js";
import { fieldDirectiveMapper } from "./fieldDirectiveMapper.js";
import { resolveDirectiveMapper } from "./resolveDirectiveMapper.js";
import { coreSchemaPath } from "./coreSchemaPath.cjs";

export const CoreSync = (
  typeDefs: TypeDefs = loadFilesSync(coreSchemaPath),
) => ({
  mappers: {
    field: fieldDirectiveMapper,
    resolve: resolveDirectiveMapper,
  },
  module: createModule({
    id: "core",
    typeDefs,
    resolvers: {
      Node: {
        id: async (
          { id }: { id: string },
          _: never,
          { loader }: ResolverContext,
        ): Promise<string | null> => {
          const node = await loader.load(id);
          if (!node) return null;
          return id;
        },
      },
      Query: {
        node: (_: unknown, { id }: { id: string }): { id: string } => ({ id }),
        nodes: (_: unknown, { ids }: { ids: string[] }): { id: string }[] =>
          ids.map((id) => ({ id })),
      },
    },
  }),
});

export const Core = async () => CoreSync(await loadFiles(coreSchemaPath));
