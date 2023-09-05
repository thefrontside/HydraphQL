import {
  GraphQLFieldConfig,
  GraphQLInterfaceType,
  GraphQLObjectType,
} from "graphql";
import {
  DirectiveMapperAPI,
  FieldDirectiveMapper,
  ResolverContext,
} from "./types";

export function mapCompositeFields<
  T extends GraphQLInterfaceType | GraphQLObjectType,
>(
  typeConfig: ReturnType<T["toConfig"]>,
  api: DirectiveMapperAPI,
  {
    directiveMappers = {},
  }: {
    directiveMappers?: Record<string, FieldDirectiveMapper>;
  } = {},
) {
  Object.entries(typeConfig.fields).forEach(([fieldName, fieldConfig]) => {
    const directives = Object.entries(directiveMappers).flatMap<{
      directiveName: string;
      directive: Record<string, unknown>;
      mapper: FieldDirectiveMapper;
    }>(([directiveName, mapper]) => {
      const [directive] = api.getDirective(fieldConfig, directiveName) ?? [];
      return directive ? [{ directiveName, directive, mapper }] : [];
    });
    if (directives.length > 1) {
      throw new Error(
        `It's ambiguous how to resolve the field "${fieldName}" of "${typeConfig.name}" type with more than one directives on it`,
      );
    }
    if (directives.length === 0) return;

    const [{ directiveName, directive, mapper }] = directives;
    try {
      const config = fieldConfig as GraphQLFieldConfig<
        { id: string },
        ResolverContext,
        Record<string, unknown> | undefined
      >;
      mapper(fieldName, config, directive, api);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : error;
      throw new Error(
        `Error while processing ${directiveName} directive on the field "${fieldName}" of "${
          typeConfig.name
        }":\n${errorMessage as string}`,
      );
    }
  });
}
