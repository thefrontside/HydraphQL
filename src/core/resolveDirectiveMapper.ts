import _ from "lodash";
import type { GraphQLFieldConfig } from "graphql";
import type { ResolverContext } from "../types.js";
import { decodeId, encodeId, unboxNamedType } from "../helpers.js";

export function resolveDirectiveMapper(
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

  field.resolve = async ({ id }, args, { loader }) => {
    if (directive.at === "id") return { id };

    const node = await loader.load(id);

    const source =
      (directive.from as string | undefined) ?? decodeId(id).source;
    const typename = unboxNamedType(field.type).name;
    const ref: unknown = _.get(node, directive.at as string | string[]);

    if (directive.at) {
      if (!ref) {
        return null;
      } else if (typeof ref !== "string") {
        throw new Error(
          `The "at" argument of @resolve directive for "${fieldName}" field must be resolved to a string, but got "${typeof ref}"`,
        );
      }
    }

    return {
      id: encodeId({
        source,
        typename,
        query: { ref: ref as string | undefined, args },
      }),
    };
  };
}
