import { isListType, isNonNullType } from "graphql";
import type { GraphQLNamedType, GraphQLOutputType } from "graphql";
import type { NodeId, NodeQuery } from "./types.js";

/** @public */
export function encodeId({ source, typename, query }: NodeId): string {
  return `${typename}@${source}@${JSON.stringify(query ?? {})}`;
}

/** @public */
export function decodeId(id: string): NodeId {
  const [typename, source, ...query] = id.split("@");
  const parsedQuery: unknown = JSON.parse(query.join("@"));
  if (!isNodeQuery(parsedQuery)) {
    throw new Error(`Invalid NodeId: ${id}`);
  }
  return { typename, source, query: parsedQuery };
}

/** @public */
export function unboxNamedType(type: GraphQLOutputType): GraphQLNamedType {
  if (isNonNullType(type)) {
    return unboxNamedType(type.ofType);
  }
  if (isListType(type)) {
    return unboxNamedType(type.ofType);
  }
  return type;
}

function isNodeQuery(obj: unknown): obj is NodeQuery {
  return !!obj && typeof obj === "object";
}

export function id(x: unknown) {
  return x;
}
