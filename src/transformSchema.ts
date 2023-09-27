import { Kind } from "graphql";
import type { DocumentNode } from "graphql";
import { makeExecutableSchema } from "@graphql-tools/schema";
import { validateSchema } from "graphql";
import type { Module, Resolvers } from "graphql-modules";
import { mapDirectives } from "./mapDirectives.js";
import type { FieldDirectiveMapper, GraphQLModule } from "./types.js";
import { CoreSync } from "./index.js";

export function transformSchema(
  additionalModules: (GraphQLModule | Module)[] = [],
  { generateOpaqueTypes }: { generateOpaqueTypes?: boolean } = {},
) {
  const modules = [CoreSync(), ...additionalModules];
  const directiveMappers: Record<string, FieldDirectiveMapper> = {};
  const typeDefs: DocumentNode[] = modules.flatMap((m) => {
    const { module: gqlModule, mappers = {} } = "id" in m ? { module: m } : m;
    const documents = gqlModule.typeDefs;
    documents.forEach((document) => {
      document.definitions.forEach((definition) => {
        if (definition.kind !== Kind.DIRECTIVE_DEFINITION) return;
        const directiveName = definition.name.value;
        const mapper = mappers?.[directiveName];
        if (mapper) directiveMappers[directiveName] = mapper;
      });
    });
    return documents;
  });
  const resolvers: Resolvers = modules.flatMap((m) => {
    const { config } = "id" in m ? m : m.module;
    return config.resolvers ?? [];
  });

  const schema = mapDirectives(makeExecutableSchema({ typeDefs, resolvers }), {
    directiveMappers,
    generateOpaqueTypes,
  });

  const errors = validateSchema(schema);

  if (errors.length > 0) {
    throw new Error(errors.map((e) => e.message).join("\n"));
  }
  return schema;
}
