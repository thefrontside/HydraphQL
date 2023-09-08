import DataLoader from "dataloader";
import type { Options } from "dataloader";
import { GraphQLError } from "graphql";
import type { BatchLoadFn, NodeQuery, GraphQLContext } from "./types.js";
import { decodeId } from "./helpers.js";

/** @public */
export const createLoader = <TContext extends Record<string, unknown>>(
  loaders: Record<string, BatchLoadFn<TContext & GraphQLContext>>,
  options?: Options<string, unknown>,
) => {
  return (context: TContext & GraphQLContext): DataLoader<string, unknown> => {
    async function fetch(ids: readonly string[]) {
      const idsBySources = ids.map(decodeId).reduce(
        (
          s: Record<string, Map<number, NodeQuery | undefined>>,
          { source, query },
          index,
        ) => ({
          ...s,
          [source]: (s[source] ?? new Map()).set(index, query),
        }),
        {},
      );
      const result: unknown[] = [];
      await Promise.all(
        Object.entries(idsBySources).map(async ([source, queries]) => {
          const loader = loaders[source];
          if (!loader) {
            return queries.forEach(
              (_, key) =>
                (result[key] = new GraphQLError(
                  `There is no loader for the source: '${source}'`,
                )),
            );
          }
          const queryEntries = [...queries.entries()];
          const values = await loader(
            queryEntries.map(([, query]) => query),
            context,
          );
          return queryEntries.forEach(
            ([key], index) =>
              (result[key] = {
                __source: source,
                ...(values[index] as Record<string, unknown>),
              }),
          );
        }),
      );
      return result;
    }

    return new DataLoader(fetch, options);
  };
};
