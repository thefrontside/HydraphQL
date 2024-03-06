import _ from "lodash";
import type { GraphQLFieldConfig } from "graphql";
import type { FieldResolver, ResolverContext } from "../types.js";
import { id } from "../helpers.js";
import { HYDRAPHQL_EXTENSION } from "src/constants.js";

export function fieldDirectiveMapper(
  fieldName: string,
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
  const resolve = (field.resolve ?? id) as FieldResolver<unknown>;

  const fieldResolver: FieldResolver = ({ entity }, args, context, info) => {
    const source =
      (_.get(
        entity,
        (directive.at as undefined | string | string[]) ?? fieldName,
      ) as unknown) ?? directive.default;
    return resolve(source, args, context, info);
  };

  field.extensions = {
    ...field.extensions,
    [HYDRAPHQL_EXTENSION]: {
      fieldResolver,
    },
  };
  field.resolve = async ({ id }, args, context, info) => {
    const { loader } = context;
    const entity = await loader.load(id);
    if (!entity) return null;
    return fieldResolver({ id, entity }, args, context, info);
  };
}
