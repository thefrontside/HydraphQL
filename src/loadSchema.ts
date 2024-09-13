import { CodeFileLoader } from "@graphql-tools/code-file-loader";
import { GraphQLFileLoader } from "@graphql-tools/graphql-file-loader";
import { loadTypedefs, loadTypedefsSync } from "@graphql-tools/load";
import {
  getResolversFromSchema,
  printSchemaWithDirectives,
  Source,
} from "@graphql-tools/utils";
import { createModule, gql } from "graphql-modules";

const loadTypeDefsOptions = {
  sort: true,
  loaders: [new CodeFileLoader(), new GraphQLFileLoader()],
};

function sources2modules(sources: Source[]) {
  return sources.map((source, index) =>
    createModule({
      id: source.location ?? `unknown_${index}`,
      typeDefs: source.schema
        ? gql(printSchemaWithDirectives(source.schema))
        : source.document ?? gql(source.rawSDL ?? ""),
      resolvers: source.schema
        ? getResolversFromSchema(source.schema)
        : undefined,
    }),
  );
}

export async function loadSchema(schema: string | string[]) {
  return sources2modules(await loadTypedefs(schema, loadTypeDefsOptions));
}

export function loadSchemaSync(schema: string | string[]) {
  return sources2modules(loadTypedefsSync(schema, loadTypeDefsOptions));
}
