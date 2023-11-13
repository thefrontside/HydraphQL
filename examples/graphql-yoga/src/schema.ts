import { printSchemaWithDirectives } from "@graphql-tools/utils";
import { transformSchema } from "@frontside/hydraphql";
import { modules } from "./modules";

export const schema = printSchemaWithDirectives(transformSchema(modules));
