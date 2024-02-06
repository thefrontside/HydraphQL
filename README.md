# HydraphQL

HydraphQL provides functionality to organize your Schema by reducing
repetition and augmenting it with [GraphQL modules][graphql-modules] defining new
types and how to resolve them.

- [Directives API](#directives-api)
  - [`@field`](#field)
  - [`@implements`](#implements)
  - [`@discriminates`](#discriminates)
  - [`@discriminationAlias`](#discriminationalias)
  - [`@resolve`](#resolve)
- [Getting started](#getting-started)
  - [GraphQL Application](#graphql-application)
  - [Extending Schema](#extending-your-schema-with-a-custom-module)
  - [@graphql-codegen/TypeScript](#graphql-codegentypescript)

## Directives API

With GraphQL modules you can structure your graphql code base,
but you still have to write resolvers using TypeScript code. However,
one of the most important advantages of HydraphQL is that most of the
time you don't need to write any TypeScript at all. Instead, you can tell
GraphQL what it should do just by adding hints directly to the Schema about
which fields map to what. These hints are called `directives`.

The following directives will tell GraphQL how to write resolvers
automatically, so that you don't have to.

### `@field`

The @field directive allows you to access properties on an object
using a given path. It allows you to specify a resolver for a field
from the schema without actually writing a real resolver at all. Under
the hood, it's creating the resolver for you. To see this in action,
check out the
[`catalog.graphql`](https://github.com/thefrontside/playhouse/blob/main/plugins/graphql-backend-module-catalog/src/catalog/catalog.graphql)
which uses the `@field` directive extensively module to retrieve
properties like `namespace`, `title` and others.

1. Mapping `namespace.name` field from source data to `Entity#name` field:

```graphql
type Entity {
  name: String! @field(at: "namespace.name")
}
```

2. If source path's fields contain dots `{ spec: { "data.label": "..." } }`, you can use an array:

```graphql
type Entity {
  label: String @field(at: ["spec", "data.label"])
}
```

3. You can specify a default value as a fallback if the field is not found:

```graphql
type Entity {
  tag: String! @field(at: "spec.tag", default: "N/A")
}
```

### `@implements`

The `@implements` directive allows you to inherit fields from another
interface. We created this directive to make it easier to implement
interfaces that inherit from other interfaces. It makes GraphQL types
similar to extending types in TypeScript. In TypeScript, when a class
inherits another class, the child class automatically inherits
properties and methods of the parent class. This functionality doesn't
have an equivalent in GraphQL. Without this directive, the `Service`
interface in GraphQL would need to re-implement many fields that are
defined on implemented interfaces which leads to lots of duplication.

1. Use this directive to define a new type that
   includes all of the properties of the parent interface.

```graphql
type Service @implements(interface: "Component") {
  endpoint: String! @field(at: "spec.endpoint")
}
```

In the output schema it is transformed into:

```graphql
type Service implements Component & Entity & Node {
  id: ID!
  name: String!
  kind: String!
  namespace: String!
  # ... rest `Entity` and `Component` fields ...

  endpoint: String!
}
```

### `@discriminates`

The `@discriminates` directive tells the GraphQL App that an interface
be discriminated by a given value to another interface or a type.
The value by path from `with` argument is used to determine to which
type the interface should be resolved.

```graphql
interface Entity
  @implements(interface: "Node")
  @discriminates(with: "kind") {
    # ...
  }

type Component @implements(interface: "Entity") {
  # ...
}
type Service @implements(interface: "Entity") {
  # ...
}
```

_NOTE: In this example if we have data of `Entity` type and it has `kind` field_
_with `Component` value, that means data will be resolved to `Component` type_

There is a special case when your runtime data doesn't have a value
that can be used to discriminate the interface or there is no type
that matches the value. In this case, you can define `opaqueType` argument

```graphql
interface Entity
  @implements(interface: "Node")
  @discriminates(with: "kind", opaqueType: "OpaqueEntity") {
    # ...
  }
```

In this case, if the value of `kind` field doesn't match with any schema type,
the `OpaqueEntity` type will be used. You don't need to define this type, the GraphQL
plugin will generate it for you.

There is another way to define opaque types for all interfaces by using `generateOpaqueTypes`
option for GraphQL plugin.

### `@discriminationAlias`

By default value from `with` argument is used to find a type as-is or converted to PascalCase. 
Sometimes you need to match the value with a type that has a different name. 
In this case, you can use `@discriminationAlias` directive.

```graphql
interface API
  @implements(interface: "Node")
  @discriminates(with: "spec.type")
  @discriminationAlias(value: "openapi", type: "OpenAPI") {
    # ...
  }

type OpenAPI @implements(interface: "API") {
  # ...
}
```

This means, when `spec.type` equals to `openapi`, the `API` interface will be resolved to `OpenAPI` type.

### `@resolve`

The `@resolve` directive is similar to the `@field` directive, but instead of
resolving a field from the source data, it resolves a field from a 3rd party
API. This is useful when you want to add fields to your schema that are not
available in the source data, but are available from another API.

1. To achieve that first of all you need to create a DataLoader with `createLoader` function

```ts
import querystring from "querystring";
import { createLoader, NodeQuery } from "@frontside/hydraphql";

export const loader = createLoader({
  async ExampleCom(queries: NodeQuery[]) {
    return Promise.all(
      queries.map(async ({ ref, args }) => {
        const response = await fetch(
          `https://example.com/api/${ref}?${querystring.stringify(args)}`,
        );
        return response.json();
      }),
    );
  },
});
```

2. Then you can use the `@resolve` directive with specifying the loader name of your API:

```graphql
type Project {
  tasks: [Task!] @resolve(at: "spec.projectId", from: "ExampleCom")
}
```

## Getting started

### GraphQL Application

Since HydraphQL uses GraphQL Modules `createGraphQLApp` returns a GraphQL Application
which can be used with all popular GraphQL servers like `apollo-server`, `express-graphql`, `graphql-yoga` and others.

1. Create an application by using `createGraphQLApp` function

```ts
import {
  createGraphQLApp,
  createLoader,
  NodeQuery,
} from "@frontside/hydraphql";
import modules from "./modules";

export async function main() {
  const application = await createGraphQLApp({ modules });
  const loader = createLoader({
    async MyAPI(queries: NodeQuery[]) {
      // ...
    },
  });

  //...
}
```

2. [Use the application with your GraphQL server](https://the-guild.dev/graphql/modules/docs/get-started#use-your-application)

_NOTE_ You can find a simple example of how to use HydraphQL with `graphql-yoga` in [`examples/graphql-yoga`](./examples/graphql-yoga) directory.

### Extending your schema with a custom module

To extend your schema, you will define it using the GraphQL Schema Definition
Language, and then (optionally) write resolvers to handle the various types
which you defined.

1. Create modules directory where you'll store all your GraphQL modules, for example in `./src/modules`
2. Create a module directory `my-module` there
3. Create a GraphQL schema file `my-module.graphql` in the module directory

```graphql
extend type Query {
  hello: String!
}
```

This code adds a `hello` field to the global `Query` type. Next, we are going to
write a module containing this schema and its resolvers.

4. Create a GraphQL module file `my-module.ts` in the module directory

```ts
import { loadFilesSync } from "@graphql-tools/load-files";
import { createModule } from "graphql-modules";

export const myModule = createModule({
  id: "my-module",
  dirname: __dirname,
  typeDefs: loadFilesSync(require.resolve("./my-module.graphql")),
  resolvers: {
    Query: {
      hello: () => "world",
    },
  },
});
```

## `@graphql-codegen`/TypeScript

If you use `@graphql-codegen` to generate an output schema to use it for
validating frontend queries and/or TypeScript to have type checking in
GraphQL modules resolvers, you'll need modify your `@graphql-codegen` config.

1. First of all create a `schema.ts` file with `transformSchema`
   function and pass all your GraphQL files

```ts
// ./src/schema.ts
import { transformSchema } from "@frontside/hydraphql";
import { printSchemaWithDirectives } from "@graphql-tools/utils";
import { MyModule } from "./modules/my-module/my-module";

export const schema = printSchemaWithDirectives(transformSchema([MyModule]));
```

2. Then you need to update `schema` option in your `codegen.ts`

```ts
import { CodegenConfig } from "@graphql-codegen/cli";
import { schema } from "./src/schema";

const config: CodegenConfig = {
  schema,
  generates: {
    /* ... */
  },
};

export default config;
```

[graphql-modules]: https://the-guild.dev/graphql/modules
