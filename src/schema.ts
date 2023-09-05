import { printSchemaWithDirectives } from "@graphql-tools/utils";
import { transformSchema } from "./transformSchema";
import { CoreSync } from "./core/core";

export const schema = printSchemaWithDirectives(transformSchema([CoreSync()]));
