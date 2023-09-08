import { GraphQLInterfaceType, GraphQLObjectType } from "graphql";
import type {
  DirectiveMapperAPI,
  NamedType,
  ResolverContext,
} from "./types.js";

export function mapObjectType(
  objectName: string,
  api: DirectiveMapperAPI,
  { implementationsMap }: { implementationsMap: Map<string, NamedType> },
) {
  const implementsInterfaceName =
    implementationsMap.get(objectName)?.implements;

  if (!implementsInterfaceName) return;

  const objectType = api.typeMap[objectName] as GraphQLObjectType;
  const implementsInterface = api.typeMap[
    implementsInterfaceName
  ] as GraphQLInterfaceType;

  if (objectType.getInterfaces().some((i) => implementationsMap.has(i.name))) {
    throw new Error(
      `The "${objectName}" type implements some interface without @implements directive`,
    );
  }

  api.typeMap[objectName] = new GraphQLObjectType<
    { id: string },
    ResolverContext
  >({
    ...objectType.toConfig(),
    interfaces: [
      implementsInterface,
      ...implementsInterface.getInterfaces(),
      ...objectType.getInterfaces(),
    ],
    fields: {
      ...implementsInterface.toConfig().fields,
      ...objectType.toConfig().fields,
    },
  });
}
