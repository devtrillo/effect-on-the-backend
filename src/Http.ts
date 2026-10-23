import { Effect, Layer, SchemaIssue } from "effect"
import { HttpApiBuilder, HttpApiMiddleware } from "effect/http-api"
import { Api, BadRequest, Validation } from "./Api.ts"
import { Authorization, CurrentUser } from "./Auth.ts"
import { Tokens } from "./Tokens.ts"
import { Users } from "./Users.ts"

// Moved out of main.ts in part 12, so the tests can import the handlers without starting a server.

const format = SchemaIssue.makeFormatterStandardSchemaV1()

export const ValidationLive = HttpApiMiddleware.layerSchemaErrorTransform(Validation, (error) => {
  const issues = format(error.cause.issue).issues.map((issue) => ({
    message: issue.message,
    path: (issue.path ?? []).map(String),
  }))
  return Effect.fail(new BadRequest({ issues }))
})

// Look the token up, then run the endpoint with its user provided as CurrentUser.
// Needs Tokens: main.ts provides the Postgres one, the tests a fake.
export const AuthorizationLive = Layer.effect(
  Authorization,
  Effect.gen(function* () {
    const tokens = yield* Tokens
    return Authorization.of({
      bearer: Effect.fn("Authorization.bearer")(function* (httpEffect, { credential }) {
        const user = yield* tokens.verify(credential)
        return yield* Effect.provideService(httpEffect, CurrentUser, user)
      }),
    })
  }),
)

// The handlers with nothing provided. They need Users, and the two middleware layers above.
export const UsersHttp = HttpApiBuilder.group(
  Api,
  "users",
  Effect.fn(function* (handlers) {
    const users = yield* Users
    return handlers
      .handle("get", ({ params }) => users.find(params.id))
      .handle("create", ({ payload }) => users.create(payload))
  }),
)
