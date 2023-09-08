import { createApplication } from "graphql-modules";
import type { Module } from "graphql-modules";
import { transformSchema } from "./transformSchema.js";
import { loadSchema } from "./loadSchema.js";

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
