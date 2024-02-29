import _ from "lodash";
import { connectionFromArray, ConnectionArguments } from "graphql-relay";
import {
  GraphQLInputObjectType,
  type GraphQLFieldConfig,
  type GraphQLInterfaceType,
  GraphQLInt,
  GraphQLString,
} from "graphql";
import type {
  DirectiveMapperAPI,
  FieldResolver,
  ResolverContext,
} from "../types.js";
import {
  createConnectionType,
  decodeId,
  encodeId,
  getNodeTypeForConnection,
  isConnectionType,
  isNamedListType,
  unboxNamedType,
} from "../helpers.js";
import { HYDRAPHQL_EXTENSION } from "src/constants.js";

export function resolveDirectiveMapper(
  fieldName: string,
  field: GraphQLFieldConfig<
    { id: string },
    ResolverContext,
    Record<string, unknown> | undefined
  >,
  directive: Record<string, unknown>,
  api: DirectiveMapperAPI & { typeName: string },
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

  if (isConnectionType(field.type)) {
    if (directive.nodeType && typeof directive.nodeType === "string") {
      const nodeType = getNodeTypeForConnection(
        directive.nodeType,
        (name) => api.typeMap[name],
        (name, type) => (api.typeMap[name] = type),
      );

      if (nodeType) field.type = createConnectionType(nodeType, field.type);
    } else {
      field.type = createConnectionType(
        api.typeMap.Node as GraphQLInterfaceType,
        field.type,
      );
    }

    if (field.args && Object.keys(field.args).length > 0) {
      const argsType = new GraphQLInputObjectType({
        name: `${api.typeName}${fieldName[0].toUpperCase()}${fieldName.slice(
          1,
        )}Args`,
        fields: { ...field.args },
      });
      field.args = { args: { type: argsType } };
    }

    field.args = {
      ...field.args,
      first: { type: GraphQLInt },
      after: { type: GraphQLString },
      last: { type: GraphQLInt },
      before: { type: GraphQLString },
    };

    const fieldResolver: FieldResolver = ({ id, entity }, args) => {
      const source =
        (directive.from as string | undefined) ?? decodeId(id).source;
      const typename = unboxNamedType(field.type).name;
      const ref: unknown = _.get(entity, directive.at as string | string[]);

      if (directive.at) {
        if (!ref) {
          return null;
        } else if (
          !Array.isArray(ref) ||
          ref.some((r) => typeof r !== "string")
        ) {
          throw new Error(
            `The "at" argument of @resolve directive for "${fieldName}" field must be resolved to an array of strings`,
          );
        }
      }

      const ids = ((ref ?? []) as string[]).map((r) => ({
        id: encodeId({
          source,
          typename,
          query: {
            ref: r as string | undefined,
            args: (args as { args: Record<string, unknown> }).args,
          },
        }),
      }));

      return {
        ...connectionFromArray(ids, args as ConnectionArguments),
        count: ids.length,
      };
    };

    field.extensions = {
      ...field.extensions,
      [HYDRAPHQL_EXTENSION]: {
        fieldResolver,
      },
    };
    field.resolve = async ({ id }, args, context, info) => {
      if (directive.at === "id") return { id };

      const { loader } = context;
      const entity = await loader.load(id);

      return fieldResolver({ id, entity }, args, context, info);
    };
  } else {
    const fieldResolver: FieldResolver = ({ id, entity }, args) => {
      const source =
        (directive.from as string | undefined) ?? decodeId(id).source;
      const typename = unboxNamedType(field.type).name;
      const isListType = isNamedListType(field.type);
      const ref: unknown = _.get(entity, directive.at as string | string[]);

      if (directive.at) {
        if (!ref) {
          return null;
        } else if (
          isListType &&
          (!Array.isArray(ref) || ref.some((r) => typeof r !== "string"))
        ) {
          throw new Error(
            `The "at" argument of @resolve directive for "${fieldName}" field must be resolved to an array of strings`,
          );
        } else if (!isListType && typeof ref !== "string") {
          throw new Error(
            `The "at" argument of @resolve directive for "${fieldName}" field must be resolved to a string, but got "${typeof ref}"`,
          );
        }
      }

      return isListType
        ? ((ref ?? []) as string[]).map((r) => ({
            id: encodeId({
              source,
              typename,
              query: { ref: r as string | undefined, args },
            }),
          }))
        : {
            id: encodeId({
              source,
              typename,
              query: { ref: ref as string | undefined, args },
            }),
          };
    };

    field.extensions = {
      ...field.extensions,
      [HYDRAPHQL_EXTENSION]: {
        fieldResolver,
      },
    };
    field.resolve = async ({ id }, args, context, info) => {
      if (directive.at === "id") return { id };

      const { loader } = context;
      const entity = await loader.load(id);

      return fieldResolver({ id, entity }, args, context, info);
    };
  }
}
