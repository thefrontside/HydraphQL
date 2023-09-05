/* eslint-env node */
/** @type {{ types: string; schema: string }} */
module.exports = {
  types: require.resolve("./__snapshots__/types.ts.snap"),
  schema: require.resolve("./__snapshots__/schema.graphql.snap"),
};
