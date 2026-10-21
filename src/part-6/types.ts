// Type-check only. Each @ts-expect-error marks a line that must not compile.
import { Data, Effect } from "effect"
import { HttpApiBuilder, HttpApiClient, HttpApiEndpoint } from "effect/http-api"
import { Api } from "../Api.ts"
import { getUser } from "../getUser.ts"

// `create` doesn't declare UserNotFound. Its handler may fail only with BadRequest, from the middleware.
export const Undeclared = HttpApiBuilder.group(Api, "users", (handlers) =>
  handlers
    .handle("get", ({ params }) => getUser(params.id))
    // @ts-expect-error Property 'issues' is missing in type 'UserNotFound' but required in type 'BadRequest'
    .handle("create", () => getUser("1")),
)

// A Data.TaggedError has no schema, so it can't be declared.
class Gone extends Data.TaggedError("Gone")<{ readonly id: string }> {}
// @ts-expect-error Type 'typeof Gone' is not assignable to type 'Top | readonly Top[] | undefined'
export const NoSchema = HttpApiEndpoint.get("gone", "/gone", { error: Gone })

// The client knows which errors each endpoint declares.
export const Calls = Effect.gen(function* () {
  const client = yield* HttpApiClient.make(Api)
  yield* client.users.create({ payload: { name: "Ada", email: "ada@example.com" } }).pipe(
    // @ts-expect-error Argument of type '"UserNotFound"' is not assignable
    Effect.catchTag("UserNotFound", () => Effect.void),
  )
})

