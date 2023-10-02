import type { NodeQuery } from "@frontside/hydraphql";

const prefix = "https://swapi.dev/api/";

export async function StarWars(queries: readonly NodeQuery[]) {
  const result: Record<string, unknown>[] = [];
  for (const { ref } of queries) {
    const res = await fetch(ref!);
    const json = (await res.json()) as Record<string, unknown>;
    json.type = ref!.replace(prefix, "").split("/")[0];
    result.push(json);
  }
  return result;
}
