// Type-check only. Each @ts-expect-error marks a line that must not compile.
import { Effect, Layer } from "effect"
import { HttpServer } from "effect/http"
import { HttpApiTest } from "effect/http-api"
import { Api } from "../Api.ts"
import { CurrentUser } from "../Auth.ts"
import { AuthorizationLive, UsersHttp, ValidationLive } from "../Http.ts"
import { Mailer } from "../Mailer.ts"
import { Tokens } from "../Tokens.ts"
import { Users } from "../Users.ts"

const ada = { id: "1", name: "Ada" }
const TokensStub = Layer.succeed(Tokens, Tokens.of({ issue: () => Effect.die("unused"), verify: () => Effect.succeed(ada) }))
// Part 13 gave the handlers a Mailer. This stub keeps the errors below the same as in part 12.
const MailerStub = Layer.succeed(Mailer, Mailer.of({ welcome: () => Effect.void }))
const makeClient = HttpApiTest.groups(Api, ["users"])
const getAda = Effect.flatMap(makeClient, (client) => client.users.get({ params: { id: "1" as never } }))
type Runnable = Effect.Effect<unknown, unknown, never>

// Layer.provide hides the middleware services, and HttpApiTest.groups asks for them.
const Hidden = UsersHttp.pipe(
  Layer.provide([ValidationLive, AuthorizationLive]),
  Layer.provide([Users.layerMemory, TokensStub, MailerStub]),
)
// @ts-expect-error Type 'Authorization' is not assignable to type 'never'
export const WithProvide: Runnable = getAda.pipe(Effect.scoped, Effect.provide(Layer.mergeAll(Hidden, HttpServer.layerServices)))

// Without HttpServer.layerServices, the platform services are missing.
const Merged = UsersHttp.pipe(
  Layer.provideMerge([ValidationLive, AuthorizationLive]),
  Layer.provide([Users.layerMemory, TokensStub, MailerStub]),
)
// @ts-expect-error Type 'FileSystem' is not assignable to type 'never'
export const NoServices: Runnable = getAda.pipe(Effect.scoped, Effect.provide(Merged))

// Both fixed.
export const Fixed: Runnable = getAda.pipe(Effect.scoped, Effect.provide(Layer.mergeAll(Merged, HttpServer.layerServices)))

// Users.create still needs a CurrentUser in a test. The in-memory version doesn't read it, but the type does.
// @ts-expect-error Type 'CurrentUser' is not assignable to type 'never'
export const NoActor: Runnable = Users.use((users) => users.create({ name: "Grace", email: "grace@example.com" })).pipe(
  Effect.provide(Users.layerMemory),
)
export const WithActor: Runnable = Users.use((users) => users.create({ name: "Grace", email: "grace@example.com" })).pipe(
  Effect.provide(Users.layerMemory),
  Effect.provideService(CurrentUser, ada),
)
