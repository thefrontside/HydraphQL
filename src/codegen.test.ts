import { generate } from "@graphql-codegen/cli";
import type { Types } from "@graphql-codegen/plugin-helpers";
import { describe, test } from "node:test";
import { expect } from "expect";
import { readFile } from "node:fs/promises";
import { default as config } from "../codegen.js";

describe("graphql-common codegen", () => {
  void test("should generate the correct code", async () => {
    const [graphqlFile, tsFile] = (
      await (generate(config, false) as Promise<Types.FileOutput[]>)
    ).map((file: Types.FileOutput) => file.content);

    const [expectedTsFile, expectedGraphqlFile] = await Promise.all([
      readFile(
        new URL("./__snapshots__/types.ts.snap", import.meta.url).pathname,
        "utf-8",
      ),
      readFile(
        new URL("./__snapshots__/schema.graphql.snap", import.meta.url)
          .pathname,
        "utf-8",
      ),
    ]);

    expect(tsFile).toEqual(expectedTsFile);
    expect(graphqlFile).toEqual(expectedGraphqlFile);
  });
});
