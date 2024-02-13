import { createApplication } from "graphql-modules";
import type { Module } from "graphql-modules";
import { TransformSchemaOptions, transformSchema } from "./transformSchema.js";
import { loadSchema } from "./loadSchema.js";
import { GraphQLModule } from "./types.js";

export interface createGraphQLAppOptions extends TransformSchemaOptions {
  schema?: string | string[];
  modules?: (GraphQLModule | Module)[];
}

export async function createGraphQLApp(options: createGraphQLAppOptions) {
  const modules = options.modules ?? [];
  if (options.schema) {
    modules.push(...(await loadSchema(options.schema)));
  }
  const schema = transformSchema(modules, {
    generateOpaqueTypes: options.generateOpaqueTypes,
    postTransform: options.postTransform,
  });
  return createApplication({
    schemaBuilder: () => schema,
    modules: modules.map((m) => ("id" in m ? m : m.module)),
  });
}
