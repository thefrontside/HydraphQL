import { getDirective } from "@graphql-tools/utils";
import type DataLoader from "dataloader";
import type {
  GraphQLFieldConfig,
  GraphQLNamedType,
  GraphQLObjectType,
  GraphQLSchema,
} from "graphql";
import type { Application, Module } from "graphql-modules";

export interface NodeQuery {
  ref?: string;
  args?: Record<string, unknown>;
}

export interface NodeId {
  source: string;
  typename: string;
  query: NodeQuery;
}

export type BatchLoadFn<Context extends GraphQLContext> = (
  keys: readonly NodeQuery[],
  context: Context,
) => PromiseLike<ArrayLike<unknown>>;

export interface GraphQLContext {
  application: Application;
}

export interface ResolverContext extends GraphQLContext {
  loader: DataLoader<string, unknown>;
}

export type OmitFirst<T extends unknown[]> = T extends [
  x: unknown,
  ...args: infer R,
]
  ? R
  : [];

export interface DirectiveMapperAPI {
  getImplementingTypes: (interfaceName: string) => GraphQLObjectType[];
  getDirective: (
    ...args: OmitFirst<Parameters<typeof getDirective>>
  ) => ReturnType<typeof getDirective>;
  typeMap: Partial<Record<string, GraphQLNamedType>>;
}

export type FieldDirectiveMapper = (
  fieldName: string,
  field: GraphQLFieldConfig<
    { id: string },
    ResolverContext,
    Record<string, unknown> | undefined
  >,
  directive: Record<string, unknown>,
  api: DirectiveMapperAPI & { typeName: string },
) => void;

export interface NamedType {
  implements: string | null;
  discriminates: Set<string>;
}

export interface GraphQLModule {
  mappers?: Record<string, FieldDirectiveMapper>;
  postTransform?: (schema: GraphQLSchema) => GraphQLSchema;
  module: Module;
}
