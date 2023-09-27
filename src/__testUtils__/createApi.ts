import * as graphql from "graphql";
import DataLoader from "dataloader";
import type { Module } from "graphql-modules";
import { envelop, useEngine } from "@envelop/core";
import { useDataLoader } from "@envelop/dataloader";
import { useGraphQLModules } from "@envelop/graphql-modules";
import { createGraphQLApp } from "../createGraphQLApp.js";
import type { GraphQLContext, GraphQLModule } from "../types.js";

export async function createGraphQLAPI(
  TestModule: GraphQLModule | Module,
  loader: (
    context: Record<string, unknown> & GraphQLContext,
  ) => DataLoader<string, unknown>,
  generateOpaqueTypes?: boolean,
) {
  const application = await createGraphQLApp({
    modules: [TestModule],
    generateOpaqueTypes,
  });

  const run = envelop({
    plugins: [
      useEngine(graphql),
      useGraphQLModules(application),
      useDataLoader("loader", loader),
    ],
  });

  return async (query: string) => {
    const { parse, validate, contextFactory, execute } = run();
    const document = parse(`{ ${query} }`) as graphql.DocumentNode;
    const errors = validate(application.schema, document) as Error[];
    if (errors.length) {
      throw errors[0];
    }
    const contextValue = await contextFactory();

    const result = (await execute({
      schema: application.schema,
      document,
      contextValue,
    })) as graphql.ExecutionResult;
    if (result.errors) {
      throw result.errors[0];
    } else {
      return result.data;
    }
  };
}
