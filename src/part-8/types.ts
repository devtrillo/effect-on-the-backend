// Type-check only. Each @ts-expect-error marks a line that must not compile.
import { NodeHttpServer } from "@effect/platform-node"
import { Effect, Layer } from "effect"
import { HttpRouter, HttpServerError } from "effect/http"
import { HttpApiBuilder, HttpApiMiddleware } from "effect/http-api"
import { createServer } from "node:http"
import { Api, BadRequest, Validation } from "../Api.ts"
import { Ids } from "../Ids.ts"
import { makeMemory, Users } from "../Users.ts"

// Users needs Ids now. Build it without Ids and the third type parameter says so.
// @ts-expect-error Type 'Ids' is not assignable to type 'never'
export const NoIds: Layer.Layer<Users> = Layer.effect(Users, makeMemory)

// Layer.provide hides Ids: the layer's output is Users only.
// @ts-expect-error Type 'Ids' is not assignable to type 'never'
export const Hidden: Effect.Effect<string> = Effect.gen(function* () {
  yield* Users.use((users) => users.create({ name: "Grace", email: "grace@example.com" }))
  return yield* Ids.use((ids) => ids.next)
}).pipe(Effect.provide(Users.layerMemory))

// A handler that yields Users per request. Providing Users to the group doesn't
// remove the requirement from the type: it stays a per-request requirement, and
// the type wants it from outside HttpRouter.serve.
const ValidationLive = HttpApiMiddleware.layerSchemaErrorTransform(Validation, () =>
  Effect.fail(new BadRequest({ issues: [] })),
)
const PerRequest = HttpApiBuilder.group(Api, "users", (handlers) =>
  handlers
    .handle("get", ({ params }) => Users.use((users) => users.find(params.id)))
    .handle("create", ({ payload }) => Users.use((users) => users.create(payload))),
).pipe(Layer.provide([Users.layerMemory, ValidationLive]))

// @ts-expect-error Type 'Users' is not assignable to type 'never'
export const Served: Effect.Effect<never, HttpServerError.ServeError> = Layer.launch(
  HttpRouter.serve(HttpApiBuilder.layer(Api).pipe(Layer.provide(PerRequest))).pipe(
    Layer.provide(NodeHttpServer.layer(createServer, { port: 3000 })),
  ),
)
