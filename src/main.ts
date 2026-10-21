import { NodeHttpServer, NodeRuntime } from "@effect/platform-node"
import { Config, Effect, Layer, SchemaIssue } from "effect"
import { HttpRouter, HttpServerResponse } from "effect/http"
import { HttpApiBuilder, HttpApiMiddleware, HttpApiScalar } from "effect/http-api"
import { createServer } from "node:http"
import { Api, BadRequest, Validation } from "./Api.ts"
import { Users } from "./Users.ts"

const format = SchemaIssue.makeFormatterStandardSchemaV1()

const ValidationLive = HttpApiMiddleware.layerSchemaErrorTransform(Validation, (error) => {
  const issues = format(error.cause.issue).issues.map((issue) => ({
    message: issue.message,
    path: (issue.path ?? []).map(String),
  }))
  return Effect.fail(new BadRequest({ issues }))
})

// Yield Users once, when the layer builds, so it can be provided right here.
const UsersLive = HttpApiBuilder.group(
  Api,
  "users",
  Effect.fn(function* (handlers) {
    const users = yield* Users
    return handlers
      .handle("get", ({ params }) => users.find(params.id))
      .handle("create", ({ payload }) => users.create(payload))
  }),
).pipe(Layer.provide([Users.layer, ValidationLive]))

const ApiRoutes = HttpApiBuilder.layer(Api, { openapiPath: "/openapi.json" }).pipe(
  Layer.provide(UsersLive),
)

const Health = HttpRouter.add("GET", "/health", HttpServerResponse.text("ok"))

const port = Config.Port("PORT").pipe(Config.withDefault(3000))
const databaseUrl = Config.Redacted("DATABASE_URL")

const LogConfig = Layer.effectDiscard(
  Effect.flatMap(Config.all({ port, databaseUrl }), (config) => Effect.log("Config", config)),
)

// Layer.provide builds LogConfig first, so the port opens only after the config check.
const HttpLive = NodeHttpServer.layerConfig(createServer, { port }).pipe(Layer.provide(LogConfig))

const Server = HttpRouter.serve(Layer.mergeAll(Health, ApiRoutes, HttpApiScalar.layer(Api))).pipe(
  Layer.provide(HttpLive),
)

Layer.launch(Server).pipe(NodeRuntime.runMain)
