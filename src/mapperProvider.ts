import "reflect-metadata";
import { Injectable } from "graphql-modules";
import type { TypeProvider } from "graphql-modules";
import type { FieldDirectiveMapper } from "./types.js";

export function toPrivateProp(name: string) {
  return `__${name}_directive_mapper__`;
}

/** @public */
export function createDirectiveMapperProvider(
  name: string,
  mapper: FieldDirectiveMapper,
): TypeProvider<unknown> {
  return Injectable()(
    class {
      // @ts-expect-error a computed property mast be a simple literal type or a unique symbol
      static readonly [toPrivateProp(name)]: typeof mapper = mapper;
    },
  ) as TypeProvider<unknown>;
}
