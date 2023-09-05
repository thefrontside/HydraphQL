import {
  GraphQLInterfaceType,
  GraphQLUnionType,
  isInterfaceType,
} from "graphql";
import { DirectiveMapperAPI, NamedType } from "./types";

export function mapUnionType(
  unionType: GraphQLUnionType,
  api: DirectiveMapperAPI,
  { implementationsMap }: { implementationsMap: Map<string, NamedType> },
) {
  const typeConfig = unionType.toConfig();

  if (typeConfig.types.every((type) => !implementationsMap.has(type.name)))
    return;

  typeConfig.types = typeConfig.types.flatMap((type) =>
    isInterfaceType(type)
      ? api.getImplementingTypes((type as GraphQLInterfaceType).name)
      : [type],
  );

  const resolveType = typeConfig.resolveType;
  if (resolveType)
    throw new Error(
      `The "resolveType" function has already been implemented for "${unionType.name}" union which may lead to undefined behavior`,
    );
  typeConfig.resolveType = (...args) =>
    (api.typeMap.Node as GraphQLInterfaceType).resolveType?.(...args);

  api.typeMap[unionType.name] = new GraphQLUnionType(typeConfig);
}
