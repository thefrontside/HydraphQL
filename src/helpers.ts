import {
  GraphQLNamedType,
  GraphQLOutputType,
  isListType,
  isNonNullType,
} from "graphql";
import { NodeId, NodeQuery } from "./types";

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
  return !!obj && typeof obj === "object" && "ref" in obj && "args" in obj;
}

export function id(x: unknown) {
  return x;
}
