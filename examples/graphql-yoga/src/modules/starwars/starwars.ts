import { loadFilesSync } from "@graphql-tools/load-files";
import { createModule } from "graphql-modules";
import { encodeId } from "@frontside/hydraphql";

const STARWARS_API = "https://swapi.dev/api";

export const StarWars = createModule({
  id: "starwars",
  dirname: import.meta.url,
  typeDefs: loadFilesSync(
    new URL("./starwars.graphql", import.meta.url).pathname,
  ),
  resolvers: {
    Query: {
      people: async (
        _: unknown,
        { search }: { search: string },
      ): Promise<{ id: string }[]> => {
        const response = await fetch(
          `${STARWARS_API}/people/?search=${search}`,
        );
        const people = (
          (await response.json()) as { results: { url: string }[] }
        ).results;
        return people.map((person: { url: string }) => ({
          id: encodeId({
            source: "StarWars",
            typename: "Person",
            query: { ref: person.url },
          }),
        }));
      },
      films: async (
        _: unknown,
        { search }: { search: string },
      ): Promise<{ id: string }[]> => {
        const response = await fetch(`${STARWARS_API}/films/?search=${search}`);
        const films = (
          (await response.json()) as { results: { url: string }[] }
        ).results;
        return films.map((film: { url: string }) => ({
          id: encodeId({
            source: "StarWars",
            typename: "Film",
            query: { ref: film.url },
          }),
        }));
      },
      starships: async (
        _: unknown,
        { search }: { search: string },
      ): Promise<{ id: string }[]> => {
        const response = await fetch(
          `${STARWARS_API}/starships/?search=${search}`,
        );
        const starships = (
          (await response.json()) as { results: { url: string }[] }
        ).results;
        return starships.map((starship: { url: string }) => ({
          id: encodeId({
            source: "StarWars",
            typename: "Starship",
            query: { ref: starship.url },
          }),
        }));
      },
      vehicles: async (
        _: unknown,
        { search }: { search: string },
      ): Promise<{ id: string }[]> => {
        const response = await fetch(
          `${STARWARS_API}/vehicles/?search=${search}`,
        );
        const vehicles = (
          (await response.json()) as { results: { url: string }[] }
        ).results;
        return vehicles.map((vehicle: { url: string }) => ({
          id: encodeId({
            source: "StarWars",
            typename: "Vehicle",
            query: { ref: vehicle.url },
          }),
        }));
      },
      species: async (
        _: unknown,
        { search }: { search: string },
      ): Promise<{ id: string }[]> => {
        const response = await fetch(
          `${STARWARS_API}/species/?search=${search}`,
        );
        const species = (
          (await response.json()) as { results: { url: string }[] }
        ).results;
        return species.map(({ url }: { url: string }) => ({
          id: encodeId({
            source: "StarWars",
            typename: "Species",
            query: { ref: url },
          }),
        }));
      },
      planets: async (
        _: unknown,
        { search }: { search: string },
      ): Promise<{ id: string }[]> => {
        const response = await fetch(
          `${STARWARS_API}/planets/?search=${search}`,
        );
        const planets = (
          (await response.json()) as { results: { url: string }[] }
        ).results;
        return planets.map((planet: { url: string }) => ({
          id: encodeId({
            source: "StarWars",
            typename: "Planet",
            query: { ref: planet.url },
          }),
        }));
      },
    },
  },
});
