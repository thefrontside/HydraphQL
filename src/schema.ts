import { printSchemaWithDirectives } from "@graphql-tools/utils";
import { transformSchema } from "./transformSchema.js";

export const schema = printSchemaWithDirectives(transformSchema());
