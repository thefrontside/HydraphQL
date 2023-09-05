import { DocumentNode, Kind } from "graphql";
import { makeExecutableSchema } from "@graphql-tools/schema";
import { validateSchema } from "graphql";
import { Module, Resolvers } from "graphql-modules";
import { mapDirectives } from "./mapDirectives";
import { FieldDirectiveMapper } from "./types";
import { toPrivateProp } from "./mapperProvider";

/** @public */
export function transformSchema(
  modules: Module[] = [],
  { generateOpaqueTypes }: { generateOpaqueTypes?: boolean } = {},
) {
  const directiveMappers: Record<string, FieldDirectiveMapper> = {};
  const typeDefs: DocumentNode[] = modules.flatMap((gqlModule) => {
    const documents = gqlModule.typeDefs;
    documents.forEach((document) => {
      document.definitions.forEach((definition) => {
        if (definition.kind !== Kind.DIRECTIVE_DEFINITION) return;
        const directiveName = definition.name.value;
        const provider = gqlModule.providers?.find(
          (p) => toPrivateProp(directiveName) in p,
        );
        if (provider)
          directiveMappers[directiveName] = (
            provider as unknown as Record<string, FieldDirectiveMapper>
          )[toPrivateProp(directiveName)];
      });
    });
    return documents;
  });
  const resolvers: Resolvers = modules.flatMap(
    ({ config }) => config.resolvers ?? [],
  );

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
