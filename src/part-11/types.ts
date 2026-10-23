// Type-check only. Each @ts-expect-error marks a line that must not compile.
import { Effect, Layer } from "effect"
import { HttpApi, HttpApiBuilder, HttpApiClient, HttpApiEndpoint, HttpApiGroup } from "effect/http-api"
import { Api } from "../Api.ts"
import { Authorization, CurrentUser } from "../Auth.ts"
import { NewUser, User } from "../User.ts"
import { Users } from "../Users.ts"

// 1. create without the middleware. The handler still calls users.create, which needs a CurrentUser,
//    and nothing on this endpoint provides one.
const Open = HttpApi.make("open").add(
  HttpApiGroup.make("users").add(HttpApiEndpoint.post("create", "/users", { payload: NewUser, success: User })),
)
// @ts-expect-error Type 'Request<"Requires", CurrentUser>' is not assignable to type 'never'
export const OpenLive: Layer.Layer<HttpApiGroup.Service<"open", "users">> = HttpApiBuilder.group(
  Open,
  "users",
  Effect.fn(function* (handlers) {
    const users = yield* Users
    return handlers.handle("create", ({ payload }) => users.create(payload))
  }),
).pipe(Layer.provide(Users.layerMemory))

// 2. Outside a request there's no middleware, so a script that creates a user has to say who it is.
const script = Users.use((users) => users.create({ name: "Grace", email: "grace@example.com" }))
// @ts-expect-error Type 'CurrentUser | Users' is not assignable to type 'Users'
export const Anonymous: Effect.Effect<User, never, Users> = script
export const AsAda: Effect.Effect<User, never, Users> = script.pipe(
  Effect.provideService(CurrentUser, { id: "1", name: "Ada" }),
)

// 3. A middleware that checks the token but forgets to provide the user.
export const Forgetful = Authorization.of({
  // @ts-expect-error Type 'CurrentUser' is not assignable to type 'Provided'
  bearer: (httpEffect) => httpEffect,
})

// 4. The client knows create can fail with Unauthorized, and get can't.
export const client = Effect.gen(function* () {
  const client = yield* HttpApiClient.make(Api)
  yield* client.users
    .create({ payload: { name: "Grace", email: "grace@example.com" } })
    .pipe(Effect.catchTag("Unauthorized", () => Effect.succeed(null)))
  // @ts-expect-error Argument of type '"Unauthorized"' is not assignable
  yield* client.users.get({ params: { id: "1" as never } }).pipe(Effect.catchTag("Unauthorized", () => Effect.succeed(null)))
})
