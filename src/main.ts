import { NodeHttpServer, NodeRuntime } from "@effect/platform-node"
import { Config, Effect, Layer, SchemaIssue } from "effect"
import { HttpRouter, HttpServerResponse } from "effect/http"
import { HttpApiBuilder, HttpApiMiddleware, HttpApiScalar } from "effect/http-api"
import { createServer } from "node:http"
import { Api, BadRequest, Validation } from "./Api.ts"
import { getUser } from "./getUser.ts"
import { Users } from "./Users.ts"

const UsersLive = HttpApiBuilder.group(Api, "users", (handlers) =>
  handlers
    .handle("get", ({ params }) => getUser(params.id))
    .handle("create", ({ payload }) => Users.use((users) => users.create(payload))),
)

const format = SchemaIssue.makeFormatterStandardSchemaV1()

const ValidationLive = HttpApiMiddleware.layerSchemaErrorTransform(Validation, (error) => {
  const issues = format(error.cause.issue).issues.map((issue) => ({
    message: issue.message,
    path: (issue.path ?? []).map(String),
  }))
  return Effect.fail(new BadRequest({ issues }))
})

const Health = HttpRouter.add("GET", "/health", HttpServerResponse.text("ok"))

const ApiRoutes = HttpApiBuilder.layer(Api, { openapiPath: "/openapi.json" }).pipe(
  Layer.provide(UsersLive),
  Layer.provide(ValidationLive),
)

const port = Config.Port("PORT").pipe(Config.withDefault(3000))
const databaseUrl = Config.Redacted("DATABASE_URL")

const LogConfig = Layer.effectDiscard(
  Effect.flatMap(Config.all({ port, databaseUrl }), (config) => Effect.log("Config", config)),
)

const Server = HttpRouter.serve(Layer.mergeAll(Health, ApiRoutes, HttpApiScalar.layer(Api))).pipe(
  Layer.provide(Users.layer),
  Layer.provide(NodeHttpServer.layerConfig(createServer, { port })),
  Layer.provide(LogConfig),
)

Layer.launch(Server).pipe(NodeRuntime.runMain)
