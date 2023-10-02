import { createGraphQLApp, createLoader } from "@frontside/hydraphql";
// @ts-expect-error Typescript can't find type definitions for graphql-yoga
import { createYoga } from "graphql-yoga";
import { createServer } from "node:http";
import { useDataLoader } from "@envelop/dataloader";
import { useGraphQLModules } from "@envelop/graphql-modules";
import { modules } from "./modules/index.js";
import { StarWars } from "./api.js";

export async function main() {
  const application = await createGraphQLApp({ modules });
  const loader = createLoader({ StarWars });

  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
  const yoga = createYoga({
    plugins: [useGraphQLModules(application), useDataLoader("loader", loader)],
  });
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  const server = createServer(yoga);

  server.listen(4000, () => {
    console.info("Server is running on http://localhost:4000/graphql");
  });
}
