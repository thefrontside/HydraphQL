import DataLoader from "dataloader";
import { printType } from "graphql";
import type { DocumentNode } from "graphql";
import { createModule, gql } from "graphql-modules";
import { createGraphQLAPI } from "./__testUtils__/createApi.js";
import { transformSchema } from "./transformSchema.js";
import type { NodeId } from "./types.js";
import { decodeId, encodeId } from "./helpers.js";
import { createLoader } from "./createLoader.js";
import { describe, test } from "node:test";
import { expect } from "expect";

describe("mapDirectives", () => {
  const transform = (source: DocumentNode, generateOpaqueTypes?: boolean) =>
    transformSchema(
      [
        createModule({
          id: "mapDirectives",
          typeDefs: source,
        }),
      ],
      { generateOpaqueTypes },
    );

  void test("should add opaque object type if `generateOpaqueTypes` option is true", () => {
    const schema = transform(
      gql`
        interface Entity @discriminates @implements(interface: "Node") {
          totalCount: Int!
        }
      `,
      true,
    );
    expect(printType(schema.getType("OpaqueEntity")!).split("\n")).toEqual([
      "type OpaqueEntity implements Entity & Node {",
      "  id: ID!",
      "  totalCount: Int!",
      "}",
    ]);
  });

  void test("should add object with name from `opaqueType` argument of @discriminates directive", () => {
    const schema = transform(
      gql`
        interface Entity
          @discriminates(opaqueType: "NodeEntity")
          @implements(interface: "Node") {
          totalCount: Int!
        }
      `,
      true,
    );
    expect(printType(schema.getType("NodeEntity")!).split("\n")).toEqual([
      "type NodeEntity implements Entity & Node {",
      "  id: ID!",
      "  totalCount: Int!",
      "}",
    ]);
  });

  void test("should add missing discrimination alias types", () => {
    const schema = transform(gql`
      interface Entity
        @implements(interface: "Node")
        @discriminates(with: "kind")
        @discriminationAlias(value: "component", type: "Component")
        @discriminationAlias(value: "template", type: "Template")
        @discriminationAlias(value: "location", type: "Location") {
        totalCount: Int!
      }

      type Component @implements(interface: "Entity") {
        name: String!
      }
    `);
    expect(schema.getType("Component")).toBeDefined();
    expect(schema.getType("Template")).toBeDefined();
    expect(schema.getType("Location")).toBeDefined();
  });

  void test(`shouldn't generate opaque type if there is only one implementation with generateOpaqueTypes: true`, () => {
    const schema = transform(
      gql`
        interface Entity @discriminates @implements(interface: "Node") {
          totalCount: Int!
        }
        type Component @implements(interface: "Entity") {
          totalCount: Int!
        }
      `,
      true,
    );
    expect(schema.getType("OpaqueEntity")).toBeUndefined();
    expect(schema.getType("Component")).toBeDefined();
  });

  void test("should merge fields from interface in @implements directive type", () => {
    const schema = transform(gql`
      interface Entity @implements(interface: "Node") {
        name: String!
      }
    `);
    expect(printType(schema.getType("Entity")!).split("\n")).toEqual([
      "interface Entity implements Node {",
      "  id: ID!",
      "  name: String!",
      "}",
    ]);
  });

  void test("should add object type with merged fields from interfaces", () => {
    const schema = transform(
      gql`
        interface Entity @discriminates @implements(interface: "Node") {
          name: String!
        }
      `,
      true,
    );
    expect(printType(schema.getType("OpaqueEntity")!).split("\n")).toEqual([
      "type OpaqueEntity implements Entity & Node {",
      "  id: ID!",
      "  name: String!",
      "}",
    ]);
  });

  void test("should merge fields for basic types", () => {
    const schema = transform(gql`
      interface Connection {
        foobar: String!
      }
    `);
    expect(printType(schema.getType("Connection")!).split("\n")).toEqual([
      "interface Connection {",
      "  pageInfo: PageInfo!",
      "  edges: [Edge!]!",
      "  count: Int",
      "  foobar: String!",
      "}",
    ]);
  });

  void test("should merge union types", () => {
    const schema = transform(
      gql`
        extend interface Node @discriminates(with: "kind")

        interface Component @discriminates @implements(interface: "Node") {
          name: String!
        }
        interface Resource @discriminates @implements(interface: "Node") {
          name: String!
        }

        union Entity = Component

        extend union Entity = Resource
      `,
      true,
    );
    expect(printType(schema.getType("Entity")!).split("\n")).toEqual([
      "union Entity = OpaqueComponent | OpaqueResource",
    ]);
  });

  void test("should merge interface types", () => {
    const schema = transform(
      gql`
        interface Entity @implements(interface: "Node") {
          name: String!
        }

        interface Component @implements(interface: "Entity") {
          type: String!
        }

        extend interface Component {
          location: String!
        }
      `,
      true,
    );
    expect(printType(schema.getType("Component")!).split("\n")).toEqual([
      "interface Component implements Entity & Node {",
      "  id: ID!",
      "  name: String!",
      "  type: String!",
      "  location: String!",
      "}",
    ]);
  });

  void test("should implements a types sequence", () => {
    const schema = transform(gql`
      interface Entity
        @discriminates(with: "kind")
        @implements(interface: "Node") {
        name: String!
      }
      interface Resource
        @discriminates(with: "spec.type")
        @implements(interface: "Entity") {
        location: String!
      }
      interface Website
        @discriminates(with: "spec.url")
        @implements(interface: "Resource") {
        url: String!
      }
      type ExampleCom @implements(interface: "Website") {
        example: String!
      }
    `);
    expect(printType(schema.getType("ExampleCom")!).split("\n")).toEqual([
      "type ExampleCom implements Website & Resource & Entity & Node {",
      "  id: ID!",
      "  name: String!",
      "  location: String!",
      "  url: String!",
      "  example: String!",
      "}",
    ]);
  });

  void test("@discriminates directive is optional if there is only one implementation", () => {
    const schema = transform(gql`
      interface Entity @implements(interface: "Node") {
        name: String!
      }
      interface Component @implements(interface: "Entity") {
        type: String!
      }
      type WebComponent @implements(interface: "Component") {
        url: String!
      }
    `);
    expect(printType(schema.getType("WebComponent")!).split("\n")).toEqual([
      "type WebComponent implements Component & Entity & Node {",
      "  id: ID!",
      "  name: String!",
      "  type: String!",
      "  url: String!",
      "}",
    ]);
  });

  void test(`it's possible to use "implements" keyword to declare implementations of external interfaces`, () => {
    const schema = transform(gql`
      interface Entity @implements(interface: "Node") {
        name: String!
      }
      interface Foo {
        bar: String!
      }
      interface Component implements Foo @implements(interface: "Entity") {
        type: String!
      }
    `);
    expect(printType(schema.getType("Component")!).split("\n")).toEqual([
      "interface Component implements Entity & Node & Foo {",
      "  bar: String!",
      "  id: ID!",
      "  name: String!",
      "  type: String!",
      "}",
    ]);
  });

  void test("should resolve Connection type", () => {
    const schema = transform(gql`
      interface Entity @implements(interface: "Node") {
        parents(foo: String, bar: Int): Connection
          @resolve(at: "metadata.parents", nodeType: "Entity")
      }
    `);
    expect(printType(schema.getType("Entity")!).split("\n")).toEqual([
      "interface Entity implements Node {",
      "  id: ID!",
      "  parents(args: EntityParentsArgs, first: Int, after: String, last: Int, before: String): EntityConnection",
      "}",
    ]);
    expect(printType(schema.getType("EntityParentsArgs")!).split("\n")).toEqual(
      ["input EntityParentsArgs {", "  foo: String", "  bar: Int", "}"],
    );
  });

  void test("should fail if `at` argument of @field is not a valid type", () => {
    expect(() =>
      transform(gql`
        interface Entity {
          name: String! @field(at: 42)
        }
      `),
    ).toThrow(
      'The "at" argument of @field directive must be a string or an array of strings',
    );
  });

  void test("should fail if `with` argument of @discriminates is not a valid type", () => {
    expect(() =>
      transform(gql`
        interface Entity
          @discriminates(with: 42)
          @implements(interface: "Node") {
          name: String!
        }
        type Component @implements(interface: "Entity") {
          type: String!
        }
      `),
    ).toThrow(
      'The "with" argument in `interface Entity @discriminates(with: ...)` must be a string or an array of strings',
    );
  });

  void test("should fail if @implements interface doesn't exist", () => {
    expect(() =>
      transform(gql`
        interface Entity @implements(interface: "NonExistingInterface") {
          name: String!
        }
      `),
    ).toThrow(
      'The "NonExistingInterface" in `interface Entity @implements(interface: "NonExistingInterface")` is not defined in the schema',
    );
  });

  void test("should fail if @implements interface isn't an interface", () => {
    expect(() =>
      transform(gql`
        interface Entity @implements(interface: "String") {
          name: String!
        }
      `),
    ).toThrow(
      'The "String" in `interface Entity @implements(interface: "String")` is not an interface type',
    );
  });

  void test('should fail if @discriminates without "with" and without opaque types', () => {
    expect(() =>
      transform(gql`
        interface Entity @discriminates @implements(interface: "Node") {
          name: String!
        }
        type Component @implements(interface: "Entity") {
          type: String!
        }
      `),
    ).toThrow(
      'The "with" argument in `interface Entity @discriminates(with: ...)` must be specified if "generateOpaqueTypes" is false and "opaqueType" is not specified',
    );
  });

  void test(`should fail if "opaqueType" is declared`, () => {
    expect(() =>
      transform(gql`
        interface Entity
          @discriminates(opaqueType: "EntityImpl")
          @implements(interface: "Node") {
          name: String!
        }

        type EntityImpl @implements(interface: "Entity") {
          name: String!
        }
      `),
    ).toThrow(
      'The "EntityImpl" type in `interface Entity @discriminates(opaqueType: "...")` is already declared in the schema',
    );
  });

  void test(`should fail if type generated from "generateOpaqueTypes" is declared`, () => {
    expect(() =>
      transform(
        gql`
          interface Entity @discriminates @implements(interface: "Node") {
            name: String!
          }

          type OpaqueEntity @implements(interface: "Entity") {
            name: String!
          }
        `,
        true,
      ),
    ).toThrow(
      'The "OpaqueEntity" type is already declared in the schema. Please specify a different name for a opaque type (eg. `interface Entity @discriminates(opaqueType: "...")`)',
    );
  });

  void test(`should fail if @discriminationAlias has ambiguous types`, () => {
    expect(() =>
      transform(gql`
        interface Entity
          @implements(interface: "Node")
          @discriminates(with: "kind")
          @discriminationAlias(value: "component", type: "EntityComponent")
          @discriminationAlias(value: "component", type: "Component") {
          name: String!
        }

        type EntityComponent @implements(interface: "Entity") {
          name: String!
        }

        type Component @implements(interface: "Entity") {
          name: String!
        }
      `),
    ).toThrow(
      `The following discrimination aliases are ambiguous: "component" => "EntityComponent" | "Component"`,
    );
  });

  void test(`should fail if @discriminationAlias is used without @discriminates`, () => {
    expect(() =>
      transform(gql`
        interface Entity
          @implements(interface: "Node")
          @discriminationAlias(value: "component", type: "EntityComponent") {
          name: String!
        }
      `),
    ).toThrow(
      `The "Entity" interface has @discriminationAlias directive but doesn't have @discriminates directive`,
    );
  });

  void test(`should fail if interface has multiple implementations and @discriminates is not specified`, () => {
    expect(() =>
      transform(gql`
        interface Component @implements(interface: "Node") {
          name: String!
        }
        interface Resource @implements(interface: "Node") {
          name: String!
        }
      `),
    ).toThrow(
      `The "Node" interface has multiple implementations but doesn't have @discriminates directive`,
    );
  });

  void test("should fail if Node with empty @discriminates has multiple implementations", () => {
    expect(() =>
      transform(
        gql`
          extend interface Node @discriminates

          interface Component @discriminates @implements(interface: "Node") {
            name: String!
          }
          interface Resource @discriminates @implements(interface: "Node") {
            name: String!
          }
        `,
        true,
      ),
    ).toThrow(
      'The "with" argument in `interface Node @discriminates(with: ...)` must be specified if the interface has multiple implementations',
    );
  });

  void test("should fail if interface with empty @discriminates has multiple implementations", () => {
    expect(() =>
      transform(gql`
        interface Entity @discriminates @implements(interface: "Node") {
          name: String!
        }
        interface Component @discriminates @implements(interface: "Entity") {
          name: String!
        }
        interface Resource @discriminates @implements(interface: "Entity") {
          name: String!
        }
      `),
    ).toThrow(
      'The "with" argument in `interface Entity @discriminates(with: ...)` must be specified if the interface has multiple implementations',
    );
  });

  void test("should fail if an interface is not in @implements chai", () => {
    expect(() =>
      transform(gql`
        interface Entity @implements(interface: "Node") {
          name: String!
        }
        interface Component {
          name: String!
        }
        interface WebComponent @implements(interface: "Component") {
          name: String!
        }
      `),
    ).toThrow(
      'The following interfaces are not in @implements chain from "Node": WebComponent, Component',
    );
  });

  void test("should fail if a type implements some interfaces without @implements directive", () => {
    expect(() =>
      transform(gql`
        extend interface Node @discriminates(with: "kind")

        interface Entity @implements(interface: "Node") {
          name: String!
        }
        interface Component implements Entity @implements(interface: "Node") {
          name: String!
        }
      `),
    ).toThrow(
      'The "Component" interface implements some interface without @implements directive',
    );
  });

  void test("should fail if an interface with @discriminates doesn't implement any interface", () => {
    expect(() =>
      transform(gql`
        interface Entity @discriminates(with: "kind") {
          name: String!
        }
      `),
    ).toThrow(
      `The "Entity" interface has @discriminates directive but doesn't implement any interface`,
    );
  });

  void test("should fail if an interface with @discriminates doesn't have any implementations and `generateOpaqueType` is false", () => {
    expect(() =>
      transform(gql`
        interface Entity
          @discriminates(with: "kind")
          @implements(interface: "Node") {
          name: String!
        }
      `),
    ).toThrow(
      `The "Entity" interface has @discriminates directive but doesn't have any implementations`,
    );
  });

  void test("should fail if an interface with @discriminates has implementations without @implements directive", () => {
    expect(() =>
      transform(gql`
        interface Entity
          @discriminates(with: "kind")
          @implements(interface: "Node") {
          name: String!
        }
        type Component implements Entity {
          id: ID!
          name: String!
          type: String!
        }
      `),
    ).toThrow(
      'The following type(-s) "Component" must implement "Entity" interface by using @implements directive',
    );
  });

  void test("should fail if discrimination alias type does not implement the interface", () => {
    expect(() =>
      transform(gql`
        interface Entity
          @discriminates(with: "kind")
          @implements(interface: "Node")
          @discriminationAlias(value: "component", type: "Component") {
          name: String!
        }
        type Resource @implements(interface: "Entity") {
          type: String!
        }
        type Component {
          id: ID!
          name: String!
          type: String!
        }
      `),
    ).toThrow(
      'Type(-s) "Component" in `interface Entity @discriminationAlias(value: ..., type: ...)` must implement "Entity" interface by using @implements directive',
    );
  });

  void test("should add resolver for @field directive", async () => {
    const TestModule = createModule({
      id: "test",
      typeDefs: gql`
        type Entity @implements(interface: "Node") {
          first: String! @field(at: "metadata.name")
          second: String! @field(at: ["spec", "path.to.name"])
          third: String! @field(at: "nonexisting.path", default: "defaultValue")
        }
      `,
    });
    const entity = {
      metadata: { name: "hello" },
      spec: { "path.to.name": "world" },
    };
    const loader = () =>
      new DataLoader(async () => await Promise.resolve([entity]));
    const query = await createGraphQLAPI(TestModule, loader);
    const result = await query(/* GraphQL */ `
      node(id: ${JSON.stringify(
        encodeId({
          source: "Mock",
          typename: "Entity",
          query: { ref: "test" },
        }),
      )}) { ...on Entity { first, second, third } }
    `);
    expect(result).toEqual({
      node: {
        first: "hello",
        second: "world",
        third: "defaultValue",
      },
    });
  });

  void test("should add resolver for @field directive to a field of object type", async () => {
    const TestModule = createModule({
      id: "test",
      typeDefs: gql`
        type Component {
          name: String! @field(at: "metadata.name")
        }

        extend type Query {
          component(id: ID!): Component
        }
      `,
      resolvers: {
        Query: {
          component: (_: unknown, { id }: { id: string }) => ({ id }),
        },
      },
    });
    const entity = {
      metadata: { name: "hello world" },
    };
    const loader = () =>
      new DataLoader(async () => await Promise.resolve([entity]));
    const query = await createGraphQLAPI(TestModule, loader);
    const result = await query(/* GraphQL */ `
      component(id: ${JSON.stringify(
        encodeId({
          source: "Mock",
          typename: "Component",
          query: { ref: "test" },
        }),
      )}) { name }
    `);
    expect(result).toEqual({
      component: {
        name: "hello world",
      },
    });
  });

  void test("should add resolver for @resolve directive", async () => {
    const TestModule = createModule({
      id: "test",
      typeDefs: gql`
        type Entity @implements(interface: "Node") {
          node: Entity @resolve(at: "id")
          name: String! @field(at: "metadata.name")
        }
      `,
    });
    const entity = {
      kind: "Component",
      metadata: { name: "hello", namespace: "default" },
    };
    const ref = "component:default/hello";
    const id = encodeId({ source: "Mock", typename: "Entity", query: { ref } });
    const loader = () =>
      new DataLoader(
        async (ids) =>
          await Promise.resolve(
            ids.map((i) =>
              decodeId(i as string).query?.ref === ref ? entity : null,
            ),
          ),
      );
    const query = await createGraphQLAPI(TestModule, loader);
    const result = await query(/* GraphQL */ `
      node(id: ${JSON.stringify(id)}) {
        id, ...on Entity { name, node { name } }
      }
    `);
    expect(result).toEqual({
      node: {
        id,
        name: "hello",
        node: { name: "hello" },
      },
    });
  });

  void test("should resolve node using same loader", async () => {
    const TestModule = createModule({
      id: "test",
      typeDefs: gql`
        type Entity @implements(interface: "Node") {
          parent: Entity @resolve(at: "spec.parent")
          name: String! @field(at: "metadata.name")
        }
      `,
    });
    const entity = {
      kind: "Component",
      metadata: { name: "hello", namespace: "default" },
      spec: {
        parent: "component:default/world",
      },
    };
    const parent = {
      kind: "Component",
      metadata: { name: "world", namespace: "default" },
    };
    const loader = () =>
      new DataLoader(
        async (ids) =>
          await Promise.resolve(
            ids.map((id) => {
              const { query: { ref } = {} } = decodeId(id as string);
              if (ref === "component:default/hello") return entity;
              if (ref === "component:default/world") return parent;
              return null;
            }),
          ),
      );
    const query = await createGraphQLAPI(TestModule, loader);
    const result = await query(/* GraphQL */ `
      node(id: ${JSON.stringify(
        encodeId({
          source: "Mock",
          typename: "Entity",
          query: { ref: "component:default/hello" },
        }),
      )}) { ...on Entity { name, parent { name } } }
    `);
    expect(result).toEqual({
      node: {
        name: "hello",
        parent: {
          name: "world",
        },
      },
    });
  });

  void test("should resolve array of nodes", async () => {
    const TestModule = createModule({
      id: "test",
      typeDefs: gql`
        type Entity @implements(interface: "Node") {
          parents: [Entity] @resolve(at: "spec.parents")
          name: String! @field(at: "metadata.name")
        }
      `,
    });
    const entity = {
      kind: "Component",
      metadata: { name: "hello", namespace: "default" },
      spec: {
        parents: [
          "component:default/world",
          "component:default/john",
          "component:default/doe",
        ],
      },
    };
    const parent = {
      kind: "Component",
      metadata: { name: "world", namespace: "default" },
    };
    const john = {
      kind: "Component",
      metadata: { name: "john", namespace: "default" },
    };
    const doe = {
      kind: "Component",
      metadata: { name: "doe", namespace: "default" },
    };
    const loader = () =>
      new DataLoader(
        async (ids) =>
          await Promise.resolve(
            ids.map((id) => {
              const { query: { ref } = {} } = decodeId(id as string);
              if (ref === "component:default/hello") return entity;
              if (ref === "component:default/world") return parent;
              if (ref === "component:default/john") return john;
              if (ref === "component:default/doe") return doe;
              return null;
            }),
          ),
      );
    const query = await createGraphQLAPI(TestModule, loader);
    const result = await query(/* GraphQL */ `
      node(id: ${JSON.stringify(
        encodeId({
          source: "Mock",
          typename: "Entity",
          query: { ref: "component:default/hello" },
        }),
      )}) { ...on Entity { name, parents { name } } }
    `);
    expect(result).toEqual({
      node: {
        name: "hello",
        parents: [{ name: "world" }, { name: "john" }, { name: "doe" }],
      },
    });
  });

  void test("should resolve connection of nodes", async () => {
    const TestModule = createModule({
      id: "test",
      typeDefs: gql`
        type Entity @implements(interface: "Node") {
          parents: Connection @resolve(at: "spec.parents", nodeType: "Entity")
          name: String! @field(at: "metadata.name")
        }
      `,
    });
    const entity = {
      kind: "Component",
      metadata: { name: "hello", namespace: "default" },
      spec: {
        parents: [
          "component:default/world",
          "component:default/john",
          "component:default/doe",
        ],
      },
    };
    const parent = {
      kind: "Component",
      metadata: { name: "world", namespace: "default" },
    };
    const john = {
      kind: "Component",
      metadata: { name: "john", namespace: "default" },
    };
    const doe = {
      kind: "Component",
      metadata: { name: "doe", namespace: "default" },
    };
    const loader = () =>
      new DataLoader(
        async (ids) =>
          await Promise.resolve(
            ids.map((id) => {
              const { query: { ref } = {} } = decodeId(id as string);
              if (ref === "component:default/hello") return entity;
              if (ref === "component:default/world") return parent;
              if (ref === "component:default/john") return john;
              if (ref === "component:default/doe") return doe;
              return null;
            }),
          ),
      );
    const query = await createGraphQLAPI(TestModule, loader);
    const result = await query(/* GraphQL */ `
      node(id: ${JSON.stringify(
        encodeId({
          source: "Mock",
          typename: "Entity",
          query: { ref: "component:default/hello" },
        }),
      )}) { ...on Entity { name, parents { count, edges { node { name } } } } }
    `);
    expect(result).toEqual({
      node: {
        name: "hello",
        parents: {
          count: 3,
          edges: [
            { node: { name: "world" } },
            { node: { name: "john" } },
            { node: { name: "doe" } },
          ],
        },
      },
    });
  });

  void test("should resolve node using different loader", async () => {
    const TestModule = createModule({
      id: "test",
      typeDefs: gql`
        interface Node
          @discriminates(with: "__source")
          @discriminationAlias(value: "Mock", type: "Entity")
          @discriminationAlias(value: "GraphQL", type: "GraphQLEntity")

        type Entity @implements(interface: "Node") {
          parent: GraphQLEntity @resolve(at: "spec.parentId", from: "GraphQL")
          name: String! @field(at: "metadata.name")
        }

        type GraphQLEntity @implements(interface: "Node") {
          name: String! @field(at: "name")
        }
      `,
    });
    const entity = {
      kind: "Component",
      metadata: { name: "hello", namespace: "default" },
      spec: {
        parentId: 'Entity@Mock@{"ref":"component:default/world"}',
      },
    };
    const parent = {
      kind: "Component",
      metadata: { name: "world", namespace: "default" },
    };
    const loader = createLoader({
      Mock: async (queries) =>
        await Promise.resolve(
          queries.map(({ ref } = {}) => {
            if (ref === "component:default/hello") return entity;
            if (ref === "component:default/world") return parent;
            return null;
          }),
        ),
      GraphQL: async (queries) => {
        const result = await query(/* GraphQL */ `
          nodes(ids: ${JSON.stringify(queries.map(({ ref } = {}) => ref))}) {
            id, ...on Entity { name }
          }
        `);
        return result && "nodes" in result
          ? ((result.nodes ?? []) as unknown[])
          : [];
      },
    });
    const query = await createGraphQLAPI(TestModule, loader);
    const result = await query(/* GraphQL */ `
      node(id: ${JSON.stringify(
        encodeId({
          source: "Mock",
          typename: "Entity",
          query: { ref: "component:default/hello" },
        }),
      )}) { ...on Entity { name, parent { name } } }
    `);
    expect(result).toEqual({
      node: {
        name: "hello",
        parent: {
          name: "world",
        },
      },
    });
  });

  void test("should resolve node with arguments", async () => {
    const TestModule = createModule({
      id: "test",
      typeDefs: gql`
        interface Node
          @discriminates(with: "__source")
          @discriminationAlias(value: "Mock", type: "Entity")
          @discriminationAlias(value: "Tasks", type: "TaskProperty")

        type Entity @implements(interface: "Node") {
          property(name: String!): TaskProperty
            @resolve(at: "spec.taskId", from: "Tasks")
          name: String! @field(at: "metadata.name")
        }

        type TaskProperty @implements(interface: "Node") {
          name: String! @field(at: "name")
          value: String! @field(at: "value")
        }
      `,
    });
    const entity = {
      kind: "Component",
      metadata: { name: "hello", namespace: "default" },
      spec: {
        taskId: "0a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p",
      },
    };
    const task = {
      id: "0a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p",
      status: "running",
      author: "john",
      name: "world",
    };
    const loader = createLoader({
      Mock: async (queries) =>
        await Promise.resolve(
          queries.map((query) => {
            if (query?.ref === "component:default/hello") return entity;
            return null;
          }),
        ),
      Tasks: async (queries) =>
        await Promise.resolve(
          queries.map((query) => {
            const { ref, args } = query ?? {};
            if (ref !== "0a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p") return null;
            if (args?.name === "status")
              return { name: "status", value: task.status };
            if (args?.name === "author")
              return { name: "author", value: task.author };
            if (args?.name === "name")
              return { name: "name", value: task.name };
            return null;
          }),
        ),
    });
    const query = await createGraphQLAPI(TestModule, loader);
    const result = await query(/* GraphQL */ `
      node(id: ${JSON.stringify(
        encodeId({
          source: "Mock",
          typename: "Entity",
          query: {
            ref: "component:default/hello",
          },
        }),
      )}) {
        ...on Entity {
          name,
          status: property(name: "status") { value }
          author: property(name: "author") { value }
          taskName: property(name: "name") { value }
        }
      }
    `);
    expect(result).toEqual({
      node: {
        name: "hello",
        status: { value: "running" },
        author: { value: "john" },
        taskName: { value: "world" },
      },
    });
  });

  void test('should resolve node without "at" argument of @resolve directive', async () => {
    const TestModule = createModule({
      id: "test",
      typeDefs: gql`
        interface Node
          @discriminates(with: "__source")
          @discriminationAlias(value: "Mock", type: "Entity")
          @discriminationAlias(value: "Tasks", type: "Task")

        type Entity @implements(interface: "Node") {
          task(taskId: ID!): Task @resolve(from: "Tasks")
          name: String! @field(at: "metadata.name")
        }

        type Task @implements(interface: "Node") {
          taskId: ID! @field(at: "id")
          name: String! @field(at: "name")
          author: String! @field(at: "author")
          status: String! @field(at: "status")
        }
      `,
    });
    const entity = {
      kind: "Component",
      metadata: { name: "hello", namespace: "default" },
    };
    const task = {
      id: "0a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p",
      status: "running",
      author: "john",
      name: "world",
    };
    const loader = createLoader({
      Mock: async (queries) =>
        await Promise.resolve(
          queries.map((query) => {
            if (query?.ref === "component:default/hello") return entity;
            return null;
          }),
        ),
      Tasks: async (queries) =>
        await Promise.resolve(
          queries.map((query) => {
            const { args } = query ?? {};
            if (
              args &&
              "taskId" in args &&
              args.taskId === "0a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p"
            )
              return task;
            return null;
          }),
        ),
    });
    const query = await createGraphQLAPI(TestModule, loader);
    const result = await query(/* GraphQL */ `
      node(id: ${JSON.stringify(
        encodeId({
          source: "Mock",
          typename: "Entity",
          query: {
            ref: "component:default/hello",
          },
        }),
      )}) {
        ...on Entity {
          name,
          task(taskId: "0a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p") {
            id
            taskId
            name
            author
            status
          }
        }
      }
    `);
    expect(result).toEqual({
      node: {
        name: "hello",
        task: {
          id: 'Task@Tasks@{"args":{"taskId":"0a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p"}}',
          taskId: "0a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p",
          status: "running",
          author: "john",
          name: "world",
        },
      },
    });
  });

  void test('should throw error if "at" argument of @resolve directive is not a string', async () => {
    const TestModule = createModule({
      id: "test",
      typeDefs: gql`
        type Entity @implements(interface: "Node") {
          parent: Entity @resolve(at: "spec.parent")
          name: String! @field(at: "metadata.name")
        }
      `,
    });
    const entity = {
      kind: "Component",
      metadata: { name: "hello", namespace: "default" },
      spec: {
        parent: {
          name: "world",
          kind: "component",
          namespace: "default",
        },
      },
    };
    const parent = {
      kind: "Component",
      metadata: { name: "world", namespace: "default" },
    };
    const loader = () =>
      new DataLoader(
        async (ids) =>
          await Promise.resolve(
            ids.map((id) => {
              const { query: { ref } = {} } = decodeId(id as string);
              if (ref === "component:default/hello") return entity;
              if (ref === "component:default/world") return parent;
              return null;
            }),
          ),
      );
    const query = await createGraphQLAPI(TestModule, loader);
    let error: Error;
    try {
      await query(/* GraphQL */ `
      node(id: ${JSON.stringify(
        encodeId({
          source: "Mock",
          typename: "Entity",
          query: { ref: "component:default/hello" },
        }),
      )}) { ...on Entity { name, parent { name } } }
    `);
    } catch (e) {
      error = e as Error;
    }
    expect(() => {
      if (error) throw error;
    }).toThrow(
      `The "at" argument of @resolve directive for "parent" field must be resolved to a string, but got "object"`,
    );
  });

  void test("should resolve types by @discriminates directive", async () => {
    const TestModule = createModule({
      id: "test",
      typeDefs: gql`
        interface Entity
          @implements(interface: "Node")
          @discriminates(with: "kind")
          @discriminationAlias(value: "User", type: "Employee") {
          name: String! @field(at: "name")
        }

        interface Component
          @implements(interface: "Entity")
          @discriminates(opaqueType: "BaseComponent") {
          type: String! @field(at: "spec.type")
        }

        type Employee @implements(interface: "Entity") {
          jobTitle: String! @field(at: "spec.title")
        }

        type Location @implements(interface: "Entity") {
          address: String! @field(at: "spec.address")
        }
      `,
    });
    const component = {
      kind: "Component",
      name: "github-component",
      spec: { type: "github" },
    };
    const employee = {
      kind: "User",
      name: "john-user",
      spec: { title: "Developer" },
    };
    const location = {
      kind: "Location",
      name: "street-location",
      spec: { address: "123 Main St" },
    };
    const system = {
      kind: "System",
      name: "backend-system",
      spec: { type: "backend" },
    };
    const loader = () =>
      new DataLoader(
        async (ids) =>
          await Promise.resolve(
            ids.map((id) => {
              const { query: { ref } = {} } = decodeId(id as string);
              if (ref === "component:default/backend") return component;
              if (ref === "employee:default/john") return employee;
              if (ref === "location:default/home") return location;
              if (ref === "system:default/production") return system;
              return null;
            }),
          ),
      );
    const query = await createGraphQLAPI(TestModule, loader, {
      generateOpaqueTypes: true,
    });
    const queryNode = (id: NodeId) =>
      query(/* GraphQL */ `
        node(id: ${JSON.stringify(encodeId(id))}) {
          id
          ...on Entity {
            name
            ...on Employee { jobTitle }
            ...on Location { address }
            ...on Component { type }
          }
        }
      `);
    const componentResult = await queryNode({
      source: "Mock",
      typename: "Node",
      query: { ref: "component:default/backend" },
    });
    const employeeResult = await queryNode({
      source: "Mock",
      typename: "Node",
      query: { ref: "employee:default/john" },
    });
    const locationResult = await queryNode({
      source: "Mock",
      typename: "Node",
      query: { ref: "location:default/home" },
    });
    const systemResult = await queryNode({
      source: "Mock",
      typename: "Node",
      query: { ref: "system:default/production" },
    });
    expect(componentResult).toEqual({
      node: {
        id: 'Node@Mock@{"ref":"component:default/backend"}',
        name: "github-component",
        type: "github",
      },
    });
    expect(employeeResult).toEqual({
      node: {
        id: 'Node@Mock@{"ref":"employee:default/john"}',
        name: "john-user",
        jobTitle: "Developer",
      },
    });
    expect(locationResult).toEqual({
      node: {
        id: 'Node@Mock@{"ref":"location:default/home"}',
        name: "street-location",
        address: "123 Main St",
      },
    });
    expect(systemResult).toEqual({
      node: {
        id: 'Node@Mock@{"ref":"system:default/production"}',
        name: "backend-system",
      },
    });
  });

  void test("should fail if discriminated value is not a string", async () => {
    const TestModule = createModule({
      id: "test",
      typeDefs: gql`
        extend interface Node @discriminates(with: "kind")

        type Entity @implements(interface: "Node") {
          name: String! @field(at: "name")
        }
      `,
    });
    const entity = {
      kind: 42,
      name: "hello",
    };
    const loader = () =>
      new DataLoader(async () => await Promise.resolve([entity]));
    const query = await createGraphQLAPI(TestModule, loader);
    const id = encodeId({
      source: "Mock",
      typename: "Entity",
      query: { ref: "test" },
    });
    let error: Error;

    try {
      await query(/* GraphQL */ `
      node(id: ${JSON.stringify(id)}) { ...on Entity { name } }
    `);
    } catch (e) {
      error = e as Error;
    }
    expect(() => {
      if (error) throw error;
    }).toThrow(
      `Can't resolve type for node with "${id}" id. The \`42\` value which was discriminated by Node interface must be a string`,
    );
  });

  void test("should fail if discriminated type is not defined in the schema", async () => {
    const TestModule = createModule({
      id: "test",
      typeDefs: gql`
        extend interface Node @discriminates(with: "kind")

        type Entity @implements(interface: "Node") {
          name: String! @field(at: "name")
        }
      `,
    });
    const entity = {
      kind: "Unknown",
      name: "hello",
    };
    const loader = () =>
      new DataLoader(async () => await Promise.resolve([entity]));
    const query = await createGraphQLAPI(TestModule, loader);
    const id = encodeId({
      source: "Mock",
      typename: "Entity",
      query: { ref: "test" },
    });
    let error: Error;

    try {
      await query(/* GraphQL */ `
      node(id: ${JSON.stringify(id)}) { ...on Entity { name } }
    `);
    } catch (e) {
      error = e as Error;
    }
    expect(() => {
      if (error) throw error;
    }).toThrow(
      `Can't resolve type for node with "${id}" id. The "Unknown" type which was discriminated by Node interface is not defined in the schema`,
    );
  });

  void test("should fail if discriminated type is not an object or interface", async () => {
    const TestModule = createModule({
      id: "test",
      typeDefs: gql`
        extend interface Node @discriminates(with: "kind")

        type Component @implements(interface: "Node") {
          name: String! @field(at: "name")
        }

        union Entity = Component
      `,
    });
    const entity = {
      kind: "Entity",
      name: "hello",
    };
    const loader = () =>
      new DataLoader(async () => await Promise.resolve([entity]));
    const query = await createGraphQLAPI(TestModule, loader);
    const id = encodeId({
      source: "Mock",
      typename: "Entity",
      query: { ref: "test" },
    });
    let error: Error;

    try {
      await query(/* GraphQL */ `
      node(id: ${JSON.stringify(id)}) { ...on Component { name } }
    `);
    } catch (e) {
      error = e as Error;
    }
    expect(() => {
      if (error) throw error;
    }).toThrow(
      `Can't resolve type for node with "${id}" id. The "Entity" type which was discriminated by Node interface is not an object type or interface`,
    );
  });

  void test("should fail if discriminated type does not implement the interface", async () => {
    const TestModule = createModule({
      id: "test",
      typeDefs: gql`
        extend interface Node @discriminates(with: "kind") {
          name: String! @field(at: "name")
        }

        interface Entity
          @implements(interface: "Node")
          @discriminates(with: "type") {
          name: String! @field(at: "name")
        }

        type Resource @implements(interface: "Entity") {
          name: String! @field(at: "name")
        }

        type Component @implements(interface: "Node") {
          name: String! @field(at: "name")
        }
      `,
    });
    const entity = {
      kind: "Entity",
      type: "Component",
      name: "hello",
    };
    const loader = () =>
      new DataLoader(async () => await Promise.resolve([entity]));
    const query = await createGraphQLAPI(TestModule, loader);
    const id = encodeId({
      source: "Mock",
      typename: "Entity",
      query: { ref: "test" },
    });
    let error: Error;

    try {
      await query(/* GraphQL */ `
      node(id: ${JSON.stringify(id)}) { name }
    `);
    } catch (e) {
      error = e as Error;
    }
    expect(() => {
      if (error) throw error;
    }).toThrow(
      `Can't resolve type for node with "${id}" id. The "Component" type which was discriminated by Entity interface does not implement the "Entity" interface`,
    );
  });

  void test("should fail if discriminated type does not related to encoded type", async () => {
    const TestModule = createModule({
      id: "test",
      typeDefs: gql`
        extend interface Node @discriminates(with: "kind") {
          name: String! @field(at: "name")
        }

        type Resource @implements(interface: "Node") {
          name: String! @field(at: "name")
        }

        type Component @implements(interface: "Node") {
          name: String! @field(at: "name")
        }
      `,
    });
    const entity = {
      kind: "Component",
      name: "hello",
    };
    const loader = () =>
      new DataLoader(async () => await Promise.resolve([entity]));
    const query = await createGraphQLAPI(TestModule, loader);
    const id = encodeId({
      source: "Mock",
      typename: "Resource",
      query: { ref: "test" },
    });
    let error: Error;

    try {
      await query(/* GraphQL */ `
      node(id: ${JSON.stringify(id)}) { name }
    `);
    } catch (e) {
      error = e as Error;
    }
    expect(() => {
      if (error) throw error;
    }).toThrow(
      `Can't resolve type for node with "${id}" id. The "Component" type which was discriminated by Node interface does not equal to the encoded type "Resource" or implement it`,
    );
  });
});
