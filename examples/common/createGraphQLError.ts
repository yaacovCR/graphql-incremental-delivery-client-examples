import type { GraphQLFormattedError } from "graphql";

export function createGraphQLError(
  errors: ReadonlyArray<GraphQLFormattedError>,
): AggregateError {
  const message =
    errors.map((error) => error.message).join("\n") ||
    "GraphQL incremental delivery failed.";
  return new AggregateError(errors, message);
}
