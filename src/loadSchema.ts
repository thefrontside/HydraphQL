import { CodeFileLoader } from "@graphql-tools/code-file-loader";
import { GraphQLFileLoader } from "@graphql-tools/graphql-file-loader";
import { loadTypedefs } from "@graphql-tools/load";
import {
  getResolversFromSchema,
  printSchemaWithDirectives,
} from "@graphql-tools/utils";
import { createModule, gql } from "graphql-modules";

export async function loadSchema(schema: string | string[]) {
  const sources = await loadTypedefs(schema, {
    sort: true,
    loaders: [new CodeFileLoader(), new GraphQLFileLoader()],
  });
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
