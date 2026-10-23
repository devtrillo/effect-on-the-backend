import { Effect, Layer, SchemaIssue } from "effect"
import { HttpApiBuilder, HttpApiMiddleware } from "effect/http-api"
import { Api, BadRequest, Validation } from "./Api.ts"
import { Authorization, CurrentUser } from "./Auth.ts"
import { Mailer } from "./Mailer.ts"
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

// The handlers with nothing provided. They need Users, Mailer, and the two middleware layers above.
export const UsersHttp = HttpApiBuilder.group(
  Api,
  "users",
  Effect.fn(function* (handlers) {
    const users = yield* Users
    const mailer = yield* Mailer
    return handlers
      .handle("get", ({ params }) => users.find(params.id))
      .handle("create", ({ payload }) =>
        users.create(payload).pipe(
          // After the commit, not inside the transaction. The user exists either way,
          // so a mail that never arrives is a warning, not a failed request.
          Effect.tap((user) =>
            mailer.welcome({ id: user.id, name: user.name, email: payload.email }).pipe(
              Effect.catchTag("MailError", (error) => Effect.logWarning("welcome mail not sent", error.message)),
            ),
          ),
        ),
      )
  }),
)
