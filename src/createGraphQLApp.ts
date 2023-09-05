import { createApplication, Module } from "graphql-modules";
import { transformSchema } from "./transformSchema";
import { loadSchema } from "./loadSchema";

/** @public */
export interface createGraphQLAppOptions {
  schema?: string | string[];
  modules?: Module[];
  generateOpaqueTypes?: boolean;
}

/** @public */
export async function createGraphQLApp(options: createGraphQLAppOptions) {
  const modules = options.modules ?? [];
  if (options.schema) {
    modules.push(...(await loadSchema(options.schema)));
  }
  const schema = transformSchema(modules, {
    generateOpaqueTypes: options.generateOpaqueTypes,
  });
  return createApplication({
    schemaBuilder: () => schema,
    modules,
  });
}
