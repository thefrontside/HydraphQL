import { getDirective } from "@graphql-tools/utils";
import type DataLoader from "dataloader";
import type {
  GraphQLFieldConfig,
  GraphQLNamedType,
  GraphQLObjectType,
} from "graphql";
import type { Application } from "graphql-modules";

/** @public */
export interface NodeQuery {
  ref?: string;
  args?: Record<string, unknown>;
}

/** @public */
export interface NodeId {
  source: string;
  typename: string;
  query?: NodeQuery;
}

/** @public */
export type BatchLoadFn<Context extends GraphQLContext> = (
  keys: readonly (NodeQuery | undefined)[],
  context: Context,
) => PromiseLike<ArrayLike<unknown>>;

/** @public */
export interface GraphQLContext {
  application: Application;
}

/** @public */
export interface ResolverContext extends GraphQLContext {
  loader: DataLoader<string, unknown>;
}

/** @public */
export type OmitFirst<T extends unknown[]> = T extends [
  x: unknown,
  ...args: infer R,
]
  ? R
  : [];

/** @public */
export interface DirectiveMapperAPI {
  getImplementingTypes: (interfaceName: string) => GraphQLObjectType[];
  getDirective: (
    ...args: OmitFirst<Parameters<typeof getDirective>>
  ) => ReturnType<typeof getDirective>;
  typeMap: Partial<Record<string, GraphQLNamedType>>;
}

/** @public */
export type FieldDirectiveMapper = (
  fieldName: string,
  field: GraphQLFieldConfig<
    { id: string },
    ResolverContext,
    Record<string, unknown> | undefined
  >,
  directive: Record<string, unknown>,
  api: DirectiveMapperAPI,
) => void;

export interface NamedType {
  implements: string | null;
  discriminates: Set<string>;
}
