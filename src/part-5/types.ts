// Type-check only. Each @ts-expect-error marks a line that must not compile.
import { Effect } from "effect"
import { HttpApiBuilder, HttpApiClient } from "effect/http-api"
import { Api } from "../Api.ts"
import { getUser } from "../getUser.ts"
import { Users } from "../Users.ts"

// Forget an endpoint.
export const Missing = HttpApiBuilder.group(Api, "users", (handlers) =>
  // @ts-expect-error Endpoint not handled: create
  handlers.handle("get", ({ params }) => getUser(params.id).pipe(Effect.orDie)),
)

// Return a different shape than the contract says.
export const WrongShape = HttpApiBuilder.group(Api, "users", (handlers) =>
  handlers
    // @ts-expect-error Property 'name' is missing
    .handle("get", ({ params }) => Effect.succeed({ id: params.id, fullName: "Ada" }))
    .handle("create", ({ payload }) => Users.use((users) => users.create(payload))),
)

// Call the client with a plain string, or an endpoint that doesn't exist.
export const Calls = Effect.gen(function* () {
  const client = yield* HttpApiClient.make(Api)
  // @ts-expect-error Type 'string' is not assignable to type 'string & Brand<"UserId">'
  yield* client.users.get({ params: { id: "1" } })
  // @ts-expect-error Property 'remove' does not exist
  yield* client.users.remove({})
})

// Fail with an error the contract doesn't declare (main.ts uses Effect.orDie).
export const Undeclared = HttpApiBuilder.group(Api, "users", (handlers) =>
  handlers
    // @ts-expect-error Type 'UserNotFound' is not assignable to type 'never'
    .handle("get", ({ params }) => getUser(params.id))
    .handle("create", ({ payload }) => Users.use((users) => users.create(payload))),
)
