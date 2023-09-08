import { get } from "lodash-es";
import { pascalCase } from "pascal-case";
import {
  GraphQLInterfaceType,
  GraphQLObjectType,
  isInterfaceType,
  isObjectType,
  isUnionType,
} from "graphql";
import type {
  GraphQLFieldConfigMap,
  GraphQLNamedType,
  GraphQLTypeResolver,
} from "graphql";
import type {
  DirectiveMapperAPI,
  NamedType,
  ResolverContext,
} from "./types.js";
import { decodeId } from "./helpers.js";

function isRelatedType(
  resolvedType: GraphQLObjectType,
  sourceType: GraphQLNamedType,
) {
  return (
    resolvedType.name === sourceType.name ||
    !!resolvedType.getInterfaces().find((i) => i.name === sourceType.name) ||
    (isUnionType(sourceType) &&
      sourceType.getTypes().find((t) => t.name === resolvedType.name))
  );
}

function validateDiscriminatesDirective(
  interfaceName: string,
  directive: Record<string, unknown> | undefined,
  aliases: { value: string; type: string }[],
  api: DirectiveMapperAPI,
  {
    implementationsMap,
    generateOpaqueTypes,
  }: {
    implementationsMap: Map<string, NamedType>;
    generateOpaqueTypes: boolean;
  },
) {
  const { implements: implementsInterface, discriminates } =
    implementationsMap.get(interfaceName) ?? {};
  if (
    (api.typeMap[interfaceName] as GraphQLInterfaceType)
      .getInterfaces()
      .some((i) => implementationsMap.has(i.name))
  ) {
    throw new Error(
      `The "${interfaceName}" interface implements some interface without @implements directive`,
    );
  }
  if (!directive) {
    if (aliases.length > 0) {
      throw new Error(
        `The "${interfaceName}" interface has @discriminationAlias directive but doesn't have @discriminates directive`,
      );
    }
    if (discriminates && discriminates.size > 1) {
      throw new Error(
        `The "${interfaceName}" interface has multiple implementations but doesn't have @discriminates directive`,
      );
    }
  }
  if (directive) {
    if (typeof implementsInterface !== "string" && interfaceName !== "Node") {
      throw new Error(
        `The "${interfaceName}" interface has @discriminates directive but doesn't implement any interface`,
      );
    }

    const opaqueType = directive.opaqueType as string | undefined;
    const opaqueTypename =
      opaqueType ??
      (generateOpaqueTypes ? `Opaque${interfaceName}` : undefined);
    const resolvedOpaqueType = opaqueTypename && api.typeMap[opaqueTypename];
    const implementingTypes = api.getImplementingTypes(interfaceName);
    if (implementingTypes.length > 0) {
      throw new Error(
        `The following type(-s) "${implementingTypes.join(
          '", "',
        )}" must implement "${interfaceName}" interface by using @implements directive`,
      );
    }
    if (!opaqueTypename && discriminates && discriminates.size === 0) {
      throw new Error(
        `The "${interfaceName}" interface has @discriminates directive but doesn't have any implementations`,
      );
    }
    if (resolvedOpaqueType) {
      if (opaqueType) {
        throw new Error(
          `The "${opaqueType}" type in \`interface ${interfaceName} @discriminates(opaqueType: "...")\` is already declared in the schema`,
        );
      } else if (generateOpaqueTypes) {
        throw new Error(
          `The "Opaque${interfaceName}" type is already declared in the schema. Please specify a different name for a opaque type (eg. \`interface ${interfaceName} @discriminates(opaqueType: "...")\`)`,
        );
      }
    }

    if (!directive.with) {
      if (discriminates && discriminates.size > 1) {
        throw new Error(
          `The "with" argument in \`interface ${interfaceName} @discriminates(with: ...)\` must be specified if the interface has multiple implementations`,
        );
      }
      if (!opaqueType && !generateOpaqueTypes) {
        throw new Error(
          `The "with" argument in \`interface ${interfaceName} @discriminates(with: ...)\` must be specified if "generateOpaqueTypes" is false and "opaqueType" is not specified`,
        );
      }
    }

    if ("with" in directive) {
      if (
        typeof directive.with !== "string" ||
        (Array.isArray(directive.with) &&
          directive.with.some((a) => typeof a !== "string"))
      ) {
        throw new Error(
          `The "with" argument in \`interface ${interfaceName} @discriminates(with: ...)\` must be a string or an array of strings`,
        );
      }
    }
  }

  const aliasesMap = aliases.reduce(
    (map, alias) => ({
      ...map,
      [alias.value]: [...(map[alias.value] ?? []), alias.type],
    }),
    {} as Record<string, string[]>,
  );
  const ambiguousAliases = Object.entries(aliasesMap).filter(
    ([, types]) => types.length > 1,
  );
  if (ambiguousAliases.length) {
    throw new Error(
      `The following discrimination aliases are ambiguous: ${ambiguousAliases
        .map(([alias, types]) => `"${alias}" => "${types.join('" | "')}"`)
        .join(", ")}`,
    );
  }

  const types = Object.values(aliasesMap).map(
    ([type]) => [type, api.typeMap[type]] as const,
  );
  const invalidTypes = types
    .filter(([, type]) => type && !isObjectType(type) && !isInterfaceType(type))
    .map(([name]) => name);
  const typesWithWrongInterfaces = types.filter(
    ([, type]) =>
      type && implementationsMap.get(type.name)?.implements !== interfaceName,
  );
  if (invalidTypes.length) {
    throw new Error(
      `Type(-s) "${invalidTypes.join(
        '", "',
      )}" in \`interface ${interfaceName} @discriminationAlias(value: ..., type: ...)\` are not object types or interfaces`,
    );
  }
  if (typesWithWrongInterfaces.length) {
    throw new Error(
      `Type(-s) "${typesWithWrongInterfaces
        .map(([name]) => name)
        .join(
          '", "',
        )}" in \`interface ${interfaceName} @discriminationAlias(value: ..., type: ...)\` must implement "${interfaceName}" interface by using @implements directive`,
    );
  }
}

function defineResolver(
  interfaceName: string,
  directive: Record<string, unknown> | undefined,
  aliases: { value: string; type: string }[],
  {
    implementationsMap,
    generateOpaqueTypes,
  }: {
    implementationsMap: Map<string, NamedType>;
    generateOpaqueTypes: boolean;
  },
): GraphQLTypeResolver<{ id: string }, ResolverContext> {
  const { discriminates } = implementationsMap.get(interfaceName) ?? {};
  const [implementationType] = [...(discriminates ?? [])];
  const generatedOpaqueType = generateOpaqueTypes
    ? `Opaque${interfaceName}`
    : undefined;
  const opaqueTypeName = directive
    ? (directive.opaqueType as string | undefined) ?? generatedOpaqueType
    : implementationType;

  return async (source, context, info) => {
    const { schema } = info;
    const { id } = source;
    const { loader } = context;
    const { typename: sourceTypename } = decodeId(id);
    const sourceType = schema.getType(sourceTypename);

    if (directive && "with" in directive) {
      const node = await loader.load(id);

      if (!node) return undefined;

      const withArg = directive.with;
      const value: unknown =
        typeof withArg === "string" || Array.isArray(withArg)
          ? get(node, withArg)
          : undefined;
      if (value !== undefined) {
        if (typeof value !== "string") {
          throw new Error(
            `Can't resolve type for node with "${id}" id. The \`${JSON.stringify(
              value,
            )}\` value which was discriminated by ${interfaceName} interface must be a string`,
          );
        }
        const typename =
          aliases.find((alias) => alias.value === value)?.type ?? value;
        const type =
          schema.getType(typename) ?? schema.getType(pascalCase(typename));

        if (type) {
          if (!isObjectType(type) && !isInterfaceType(type)) {
            throw new Error(
              `Can't resolve type for node with "${id}" id. The "${type.name}" type which was discriminated by ${interfaceName} interface is not an object type or interface`,
            );
          }

          if (
            !type
              .getInterfaces()
              .find(({ name: ifaceName }) => ifaceName === interfaceName)
          ) {
            throw new Error(
              `Can't resolve type for node with "${id}" id. The "${type.name}" type which was discriminated by ${interfaceName} interface does not implement the "${interfaceName}" interface`,
            );
          }

          if (isInterfaceType(type)) {
            return type.resolveType?.(source, context, info, type);
          }

          if (sourceType && isRelatedType(type, sourceType)) {
            return type.name;
          }
          throw new Error(
            `Can't resolve type for node with "${id}" id. The "${type.name}" type which was discriminated by ${interfaceName} interface does not equal to the encoded type "${sourceTypename}" or implement it`,
          );
        } else if (!opaqueTypeName) {
          throw new Error(
            `Can't resolve type for node with "${id}" id. The "${typename}" type which was discriminated by ${interfaceName} interface is not defined in the schema`,
          );
        }
      }
    }
    const opaqueType = opaqueTypeName && schema.getType(opaqueTypeName);
    if (isInterfaceType(opaqueType)) {
      return opaqueType.resolveType?.(source, context, info, opaqueType);
    }
    if (
      sourceType &&
      isObjectType(opaqueType) &&
      isRelatedType(opaqueType, sourceType)
    ) {
      return opaqueTypeName;
    }
    return undefined;
  };
}

function traverseImplements(
  interfaceName: string,
  implementationsMap: Map<string, NamedType>,
  api: DirectiveMapperAPI,
): string[] {
  const implementedInterface =
    implementationsMap.get(interfaceName)?.implements;
  return [
    ...(implementedInterface
      ? [
          implementedInterface,
          ...traverseImplements(implementedInterface, implementationsMap, api),
        ]
      : []),
    ...(api.typeMap[interfaceName] as GraphQLInterfaceType)
      .getInterfaces()
      .map((iface) => iface.name),
  ];
}

export function mapInterfaceType(
  interfaceName: string,
  api: DirectiveMapperAPI,
  options: {
    implementationsMap: Map<string, NamedType>;
    generateOpaqueTypes: boolean;
  },
) {
  const interfaceType = api.typeMap[interfaceName] as GraphQLInterfaceType;

  const [discriminatesDirective] = (api.getDirective(
    interfaceType,
    "discriminates",
  ) ?? []) as (Record<string, unknown> | undefined)[];
  const discriminationAliases = (api.getDirective(
    interfaceType,
    "discriminationAlias",
  ) ?? []) as { value: string; type: string }[];

  if (!discriminatesDirective && !options.implementationsMap.has(interfaceName))
    return;

  if (interfaceType.resolveType) {
    throw new Error(
      `The "resolveType" function has already been implemented for "${interfaceName}" interface which may lead to undefined behavior`,
    );
  }
  validateDiscriminatesDirective(
    interfaceName,
    discriminatesDirective,
    discriminationAliases,
    api,
    options,
  );
  const resolver = defineResolver(
    interfaceName,
    discriminatesDirective,
    discriminationAliases,
    options,
  );

  const interfaces = [
    ...new Set(
      traverseImplements(interfaceName, options.implementationsMap, api),
    ),
  ];
  const fields = [...interfaces].reverse().reduce(
    (acc, name) => ({
      ...acc,
      ...(api.typeMap[name] as GraphQLInterfaceType).toConfig().fields,
    }),
    {} as GraphQLFieldConfigMap<unknown, unknown>,
  );

  const { astNode, extensionASTNodes, ...interfaceConfig } = (
    api.typeMap[interfaceName] as GraphQLInterfaceType
  ).toConfig();

  interfaceConfig.resolveType = resolver;
  interfaceConfig.interfaces = interfaces.map(
    (name) => api.typeMap[name] as GraphQLInterfaceType,
  );
  interfaceConfig.fields = {
    ...fields,
    ...interfaceConfig.fields,
  };

  api.typeMap[interfaceName] = new GraphQLInterfaceType({
    ...interfaceConfig,
    astNode,
    extensionASTNodes,
  });

  discriminationAliases
    .map((alias) => alias.type)
    .filter((typename) => !(typename in api.typeMap))
    .forEach((typename) => {
      api.typeMap[typename] = new GraphQLObjectType({
        ...interfaceConfig,
        name: typename,
        interfaces: [
          api.typeMap[interfaceName] as GraphQLInterfaceType,
          ...interfaceConfig.interfaces,
        ],
      });
    });

  const opaqueTypeName =
    (discriminatesDirective?.opaqueType as string | undefined) ??
    (options.generateOpaqueTypes ? `Opaque${interfaceName}` : undefined);
  const { discriminates } = options.implementationsMap.get(interfaceName) ?? {};
  if (
    discriminatesDirective &&
    opaqueTypeName &&
    (discriminates?.size !== 1 || "with" in discriminatesDirective)
  ) {
    api.typeMap[opaqueTypeName] = new GraphQLObjectType({
      ...interfaceConfig,
      name: opaqueTypeName,
      interfaces: [
        api.typeMap[interfaceName] as GraphQLInterfaceType,
        ...interfaceConfig.interfaces,
      ],
    });
  }
}
