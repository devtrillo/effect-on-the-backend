// Runnable: node src/part-6/gotchas.ts
// Two ways a typed error doesn't become the response you meant.
import { Effect, Layer, Schema } from "effect"
import { HttpRouter, HttpServer } from "effect/http"
import {
  HttpApi,
  HttpApiBuilder,
  HttpApiEndpoint,
  HttpApiGroup,
  HttpApiMiddleware,
} from "effect/http-api"
import { BadRequest, Validation } from "../Api.ts"

// An error class with no httpApiStatus.
class Locked extends Schema.TaggedError<Locked>()("Locked", { reason: Schema.String }) {}

const Items = HttpApiGroup.make("items").add(
  HttpApiEndpoint.get("locked", "/locked", { error: Locked }),
  HttpApiEndpoint.get("get", "/items/:n", { params: { n: Schema.Int } }),
)

// The same contract, with the middleware added after the group and before it.
const After = HttpApi.make("after").add(Items).middleware(Validation)
const Before = HttpApi.make("before").middleware(Validation).add(Items)

const ValidationLive = HttpApiMiddleware.layerSchemaErrorTransform(Validation, (error) =>
  Effect.fail(new BadRequest({ issues: [{ message: error.cause.message, path: [] }] })),
)

const fail = () => Effect.fail(new Locked({ reason: "row 42 held by job 7 (pg pid 3141)" }))

const AfterRoutes = HttpApiBuilder.layer(After).pipe(
  Layer.provide(
    HttpApiBuilder.group(After, "items", (h) =>
      h.handle("locked", fail).handle("get", () => Effect.void),
    ),
  ),
  Layer.provide([ValidationLive, HttpServer.layerServices]),
)
const BeforeRoutes = HttpApiBuilder.layer(Before).pipe(
  Layer.provide(
    HttpApiBuilder.group(Before, "items", (h) =>
      h.handle("locked", fail).handle("get", () => Effect.void),
    ),
  ),
  Layer.provide([ValidationLive, HttpServer.layerServices]),
)

for (const [name, routes] of [["after", AfterRoutes], ["before", BeforeRoutes]] as const) {
  const { handler, dispose } = HttpRouter.toWebHandler(routes, { disableLogger: true })
  for (const path of ["/locked", "/items/abc"]) {
    const res = await handler(new Request(`http://localhost${path}`))
    console.log(`middleware ${name}: GET ${path}`.padEnd(38), res.status, await res.text())
  }
  await dispose()
}
