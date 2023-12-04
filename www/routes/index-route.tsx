import type { JSXChild, JSXMiddleware } from "revolution";

import { useAppHtml } from "./app.html.tsx";

export function indexRoute(): JSXMiddleware {
  return function* () {
    let AppHtml = yield* useAppHtml({ title: `HydraphQL` });

    return (
      <AppHtml>
        <article class="p-4 md:px-12 mb-16">
          <section class="grid grid-cols-1 md:grid-cols-3 md:gap-4">
            <hgroup class="text-center col-span-1 md:col-span-3">
              <img
                class="inline min-w-[20%]"
                alt="HydraphQL Logo"
                src={"/assets/images/icon-effection.svg"}
                width="288px"
                height="288px"
              />
              <h1 class="text-4xl font-bold leading-7">HydraphQL</h1>
              <p class="text-sm py-4">
                Declarative resolvers for GraphQL schemas
              </p>
              <a
                class="inline-block mt-2 p-3 text-white w-full rounded bg-blue-900 md:w-48"
                href="/docs/introduction"
              >
                Get Started
              </a>
            </hgroup>
            <Feature summary="🧩 Modular GraphQL">
              HydraphQL supports GraphQL Modules, allowing you to compose your
              schema from smaller, easy to maintain pieces.
            </Feature>
            <Feature summary="💧 DRY Schemas">
              In raw GraphQL schemas you have to declare all fields from
              implementing interfaces. With HydraphQL you are able declare field
              once and all interface implementations will include it.
            </Feature>
            <Feature summary="⚡ Less Code">
              HydraphQL provides a way to define declarative type resolvers
              directly in your schema, which means you will have less JavaScript
              code to write and test.
            </Feature>
            <Feature summary="🔗 Connectivity">
              Imagine you have multiple internal APIs or one data source has
              fields refer to other source. You can easily connect them together
              into one single endpoint.
            </Feature>
            <Feature summary="🤝 Compatibility">
              HydraphQL is compatible with many popular GraphQL servers,
              including Apollo Server, GraphQL Yoga, Express GraphQL and more.
            </Feature>
          </section>
        </article>
      </AppHtml>
    );
  };
}

function Feature({
  summary,
  children,
}: {
  summary: string;
  children: JSXChild;
}) {
  return (
    <hgroup class="mt-6">
      <h2>{summary}</h2>
      <p class="mt-3 text-sm">{children}</p>
    </hgroup>
  );
}
