import { printSchemaWithDirectives } from "@graphql-tools/utils";
import { transformSchema } from "./transformSchema.js";
import { CoreSync } from "./core/core.js";

export const schema = printSchemaWithDirectives(transformSchema([CoreSync()]));
