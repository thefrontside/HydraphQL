import { isInterfaceType } from "graphql";
import type { GraphQLInterfaceType, GraphQLObjectType } from "graphql";
import type { DirectiveMapperAPI, NamedType } from "./types.js";

export function implementsDirectiveMapper(
  type: GraphQLInterfaceType | GraphQLObjectType,
  api: DirectiveMapperAPI,
  implementationsMap: Map<string, NamedType>,
) {
  if (type.getInterfaces().find((i) => i.name === "Node")) {
    throw new Error(
      `Interface "${type.name}" cannot implement "Node" interface directly. Please use @implements directive instead`,
    );
  }
  const [implementsDirective] = api.getDirective(type, "implements") ?? [];
  if (implementsDirective) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const implementingInterface = api.typeMap[implementsDirective.interface];
    if (!implementingInterface) {
      throw new Error(
        `The "${implementsDirective.interface}" in \`interface ${type.name} @implements(interface: "${implementsDirective.interface}")\` is not defined in the schema`,
      );
    }
    if (!isInterfaceType(implementingInterface)) {
      throw new Error(
        `The "${implementsDirective.interface}" in \`interface ${type.name} @implements(interface: "${implementsDirective.interface}")\` is not an interface type`,
      );
    }
    implementationsMap.set(type.name, {
      implements: implementingInterface.name,
      discriminates:
        implementationsMap.get(type.name)?.discriminates ?? new Set(),
    });
    implementationsMap.set(implementingInterface.name, {
      implements:
        implementationsMap.get(implementingInterface.name)?.implements ?? null,
      discriminates: (
        implementationsMap.get(implementingInterface.name)?.discriminates ??
        new Set()
      ).add(type.name),
    });
  }
}
