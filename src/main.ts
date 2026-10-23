import { NodeHttpServer, NodeRuntime } from "@effect/platform-node"
import { Config, Effect, Layer } from "effect"
import { HttpRouter, HttpServerResponse } from "effect/http"
import { HttpApiBuilder, HttpApiScalar } from "effect/http-api"
import { createServer } from "node:http"
import { Api } from "./Api.ts"
import { AuthorizationLive, UsersHttp, ValidationLive } from "./Http.ts"
import { SqlLive } from "./Sql.ts"
import { Tokens } from "./Tokens.ts"
import { Users } from "./Users.ts"

// The handlers, their middleware, and the Postgres services behind both.
const UsersLive = UsersHttp.pipe(
  Layer.provide([ValidationLive, AuthorizationLive]),
  Layer.provide([Users.layer, Tokens.layer]),
)

const ApiRoutes = HttpApiBuilder.layer(Api, { openapiPath: "/openapi.json" }).pipe(
  Layer.provide(UsersLive),
)

const Health = HttpRouter.add("GET", "/health", HttpServerResponse.text("ok"))

const port = Config.Port("PORT").pipe(Config.withDefault(3000))
const databaseUrl = Config.Redacted("DATABASE_URL")

const LogConfig = Layer.effectDiscard(
  Effect.flatMap(Config.all({ port, databaseUrl }), (config) => Effect.log("Config", config)),
)

// Bottom up: the config check, then the database and its migrations, then the port.
// provideMerge passes SqlClient on to everything inside HttpRouter.serve.
const HttpLive = NodeHttpServer.layerConfig(createServer, { port }).pipe(
  Layer.provideMerge(SqlLive),
  Layer.provide(LogConfig),
)

const Server = HttpRouter.serve(Layer.mergeAll(Health, ApiRoutes, HttpApiScalar.layer(Api))).pipe(
  Layer.provide(HttpLive),
)

Layer.launch(Server).pipe(NodeRuntime.runMain)
