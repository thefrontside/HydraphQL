import { generate } from "@graphql-codegen/cli";
import { default as config } from "../codegen";
import { Types } from "@graphql-codegen/plugin-helpers";
import { describe, test } from "node:test";
import { expect } from "expect";
import { readFile } from "node:fs/promises";
import snapshots from "./snapshotFiles.cjs";

describe("graphql-common codegen", () => {
  void test("should generate the correct code", async () => {
    const [graphqlFile, tsFile] = (
      await (generate(config, false) as Promise<Types.FileOutput[]>)
    ).map((file: Types.FileOutput) => file.content);

    const [expectedTsFile, expectedGraphqlFile] = await Promise.all([
      readFile(snapshots.types, "utf-8"),
      readFile(snapshots.schema, "utf-8"),
    ]);

    expect(tsFile).toEqual(expectedTsFile);
    expect(graphqlFile).toEqual(expectedGraphqlFile);
  });
});
