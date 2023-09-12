import _ from "lodash";
import type { GraphQLFieldConfig } from "graphql";
import type { ResolverContext } from "../types.js";
import { id } from "../helpers.js";

export function fieldDirectiveMapper(
  _fieldName: string,
  field: GraphQLFieldConfig<
    { id: string },
    ResolverContext,
    Record<string, unknown> | undefined
  >,
  directive: Record<string, unknown>,
) {
  if (
    "at" in directive &&
    typeof directive.at !== "string" &&
    (!Array.isArray(directive.at) ||
      directive.at.some((a) => typeof a !== "string"))
  ) {
    throw new Error(
      `The "at" argument of @field directive must be a string or an array of strings`,
    );
  }
  const fieldResolve = (field.resolve ?? id) as NonNullable<
    GraphQLFieldConfig<
      unknown,
      ResolverContext,
      Record<string, unknown> | undefined
    >["resolve"]
  >;
  field.resolve = async ({ id }, args, context, info) => {
    const { loader } = context;
    const entity = await loader.load(id);
    if (!entity) return null;
    const source =
      (_.get(entity, directive.at as string | string[]) as unknown) ??
      directive.default;
    return fieldResolve(source, args, context, info);
  };
}
