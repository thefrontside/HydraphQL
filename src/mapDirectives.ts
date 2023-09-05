import { getDirective, rewireTypes } from "@graphql-tools/utils";
import {
  GraphQLInterfaceType,
  GraphQLNamedType,
  GraphQLObjectType,
  GraphQLSchema,
  isInterfaceType,
  isObjectType,
  isUnionType,
} from "graphql";
import { FieldDirectiveMapper, DirectiveMapperAPI, NamedType } from "./types";
import { mapCompositeFields } from "./mapCompositeField";
import { mapInterfaceType } from "./mapInterfaceType";
import { mapUnionType } from "./mapUnionType";
import { implementsDirectiveMapper } from "./implementsDirectiveMapper";
import { mapObjectType } from "./mapObjectType";

export function getObjectTypeFromTypeMap(
  typeMap: Record<string, GraphQLNamedType>,
  type: GraphQLObjectType | undefined | null,
) {
  if (!type) return null;
  const maybeObjectType = typeMap[type.name];
  if (isObjectType(maybeObjectType)) return maybeObjectType;
  return null;
}

export function mapDirectives(
  sourceSchema: GraphQLSchema,
  {
    directiveMappers,
    generateOpaqueTypes = false,
  }: {
    directiveMappers?: Record<string, FieldDirectiveMapper>;
    generateOpaqueTypes?: boolean;
  } = {},
) {
  const implementationsMap = new Map<string, NamedType>();
  const newTypeMap = { ...sourceSchema.getTypeMap() };
  const directiveMapperAPI: DirectiveMapperAPI = {
    getDirective(node, directiveName, pathToDirectives) {
      return getDirective(sourceSchema, node, directiveName, pathToDirectives);
    },
    getImplementingTypes(interfaceName) {
      return Object.values(newTypeMap).filter(
        (type): type is GraphQLObjectType =>
          isObjectType(type) &&
          type
            .getInterfaces()
            .map((i) => i.name)
            .includes(interfaceName),
      );
    },
    typeMap: newTypeMap,
  };

  Object.values(newTypeMap).forEach((type) => {
    if (isInterfaceType(type) || isObjectType(type)) {
      implementsDirectiveMapper(type, directiveMapperAPI, implementationsMap);
    }
  });

  const interfaces = new Set(implementationsMap.keys());
  interfaces.delete("Node");
  const discriminates = [
    ...(implementationsMap.get("Node")?.discriminates ?? new Set()),
  ];
  while (discriminates.length > 0) {
    const value = discriminates.pop();
    if (value) {
      interfaces.delete(value);
      discriminates.push(
        ...(implementationsMap.get(value)?.discriminates ?? new Set()),
      );
    }
  }

  if (interfaces.size > 0) {
    throw new Error(
      `The following interfaces are not in @implements chain from "Node": ${[
        ...interfaces,
      ].join(", ")}`,
    );
  }

  Object.values(newTypeMap).forEach((type) => {
    if (isInterfaceType(type)) {
      const interfaceConfig = type.toConfig();
      mapCompositeFields(interfaceConfig, directiveMapperAPI, {
        directiveMappers,
      });
      newTypeMap[type.name] = new GraphQLInterfaceType({
        ...(newTypeMap[type.name] as GraphQLInterfaceType).toConfig(),
        fields: interfaceConfig.fields,
      });
    } else if (isObjectType(type)) {
      const objectConfig = type.toConfig();
      mapCompositeFields(objectConfig, directiveMapperAPI, {
        directiveMappers,
      });
      newTypeMap[type.name] = new GraphQLObjectType({
        ...(newTypeMap[type.name] as GraphQLObjectType).toConfig(),
        fields: objectConfig.fields,
      });
    }
  });

  Object.values(newTypeMap).forEach((type) => {
    if (isInterfaceType(type))
      mapInterfaceType(type.name, directiveMapperAPI, {
        implementationsMap,
        generateOpaqueTypes,
      });
  });

  Object.values(newTypeMap).forEach((type) => {
    if (isObjectType(type))
      mapObjectType(type.name, directiveMapperAPI, { implementationsMap });
  });

  Object.values(newTypeMap).forEach((type) => {
    if (isUnionType(type))
      mapUnionType(type, directiveMapperAPI, { implementationsMap });
  });

  const { typeMap, directives } = rewireTypes(
    newTypeMap,
    sourceSchema.getDirectives(),
  );

  return new GraphQLSchema({
    ...sourceSchema.toConfig(),
    directives,
    types: Object.values(typeMap),
    query: getObjectTypeFromTypeMap(
      typeMap,
      getObjectTypeFromTypeMap(newTypeMap, sourceSchema.getQueryType()),
    ),
    mutation: getObjectTypeFromTypeMap(
      typeMap,
      getObjectTypeFromTypeMap(newTypeMap, sourceSchema.getMutationType()),
    ),
    subscription: getObjectTypeFromTypeMap(
      typeMap,
      getObjectTypeFromTypeMap(newTypeMap, sourceSchema.getSubscriptionType()),
    ),
  });
}
