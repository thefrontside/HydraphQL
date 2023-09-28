import {
  isInterfaceType,
  isListType,
  isNonNullType,
  GraphQLObjectType,
  GraphQLNonNull,
  GraphQLList,
  isInputType,
  isUnionType,
  GraphQLID,
  GraphQLInterfaceType,
  isObjectType,
} from "graphql";
import type { GraphQLNamedType, GraphQLOutputType } from "graphql";
import type { NodeId, NodeQuery } from "./types.js";

export function encodeId({ source, typename, query }: NodeId): string {
  return `${typename}@${source}@${JSON.stringify(query ?? {})}`;
}

export function decodeId(id: string): NodeId {
  const [typename, source, ...query] = id.split("@");
  const parsedQuery: unknown = JSON.parse(query.join("@"));
  if (!isNodeQuery(parsedQuery)) {
    throw new Error(`Invalid NodeId: ${id}`);
  }
  return { typename, source, query: parsedQuery };
}

export function unboxNamedType(type: GraphQLOutputType): GraphQLNamedType {
  if (isNonNullType(type)) {
    return unboxNamedType(type.ofType);
  }
  if (isListType(type)) {
    return unboxNamedType(type.ofType);
  }
  return type;
}

export function isNamedListType(type: GraphQLOutputType): boolean {
  if (isNonNullType(type)) {
    return isListType(type.ofType);
  }
  return isListType(type);
}

export function isConnectionType(type: unknown): type is GraphQLInterfaceType {
  return (
    (isInterfaceType(type) && type.name === "Connection") ||
    (isNonNullType(type) && isConnectionType(type.ofType))
  );
}

export function createConnectionType(
  nodeType: GraphQLInterfaceType | GraphQLObjectType,
  fieldType: GraphQLInterfaceType,
): GraphQLObjectType {
  const wrappedEdgeType = fieldType.getFields().edges.type as GraphQLNonNull<
    GraphQLList<GraphQLNonNull<GraphQLInterfaceType>>
  >;
  const edgeType = wrappedEdgeType.ofType.ofType.ofType;

  return new GraphQLObjectType({
    name: `${nodeType.name}Connection`,
    fields: {
      ...fieldType.toConfig().fields,
      edges: {
        type: new GraphQLNonNull(
          new GraphQLList(
            new GraphQLNonNull(
              new GraphQLObjectType({
                name: `${nodeType.name}Edge`,
                fields: {
                  ...edgeType.toConfig().fields,
                  node: {
                    type: new GraphQLNonNull(nodeType),
                  },
                },
                interfaces: [edgeType],
              }),
            ),
          ),
        ),
      },
    },
    interfaces: [fieldType],
  });
}

export function getNoteTypeForConnection(
  typeName: string,
  getType: (name: string) => GraphQLNamedType | undefined,
  setType: (name: string, type: GraphQLNamedType) => void,
): GraphQLInterfaceType | GraphQLObjectType {
  const nodeType = getType(typeName);

  if (!nodeType) {
    throw new Error(`The interface "${typeName}" is not defined in the schema`);
  }
  if (isInputType(nodeType)) {
    throw new Error(
      `The interface "${typeName}" is an input type and can't be used in a Connection`,
    );
  }
  if (isUnionType(nodeType)) {
    const resolveType = nodeType.resolveType;
    if (resolveType)
      throw new Error(
        `The "resolveType" function has already been implemented for "${nodeType.name}" union which may lead to undefined behavior`,
      );
    const iface = new GraphQLInterfaceType({
      name: typeName,
      interfaces: [getType("Node") as GraphQLInterfaceType],
      fields: { id: { type: new GraphQLNonNull(GraphQLID) } },
      resolveType: (...args) =>
        (getType("Node") as GraphQLInterfaceType).resolveType?.(...args),
    });
    setType(typeName, iface);
    nodeType
      .getTypes()
      .map((type) => getType(type.name))
      .forEach((type) => {
        if (isInterfaceType(type)) {
          setType(
            type.name,
            new GraphQLInterfaceType({
              ...type.toConfig(),
              interfaces: [...type.getInterfaces(), iface],
            }),
          );
        }
        if (isObjectType(type)) {
          setType(
            type.name,
            new GraphQLObjectType({
              ...type.toConfig(),
              interfaces: [...type.getInterfaces(), iface],
            }),
          );
        }
      });
    return iface;
  } else {
    return nodeType;
  }
}

function isNodeQuery(obj: unknown): obj is NodeQuery {
  return !!obj && typeof obj === "object";
}

export function id(x: unknown) {
  return x;
}
