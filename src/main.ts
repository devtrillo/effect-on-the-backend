import { NodeHttpServer, NodeRuntime } from "@effect/platform-node"
import { Effect, Layer } from "effect"
import { HttpRouter, HttpServerResponse } from "effect/http"
import { HttpApiBuilder, HttpApiScalar } from "effect/http-api"
import { createServer } from "node:http"
import { Api } from "./Api.ts"
import { getUser } from "./getUser.ts"
import { Users } from "./Users.ts"

const UsersLive = HttpApiBuilder.group(Api, "users", (handlers) =>
  handlers
    .handle("get", ({ params }) => getUser(params.id).pipe(Effect.orDie))
    .handle("create", ({ payload }) => Users.use((users) => users.create(payload))),
)

const Health = HttpRouter.add("GET", "/health", HttpServerResponse.text("ok"))

const ApiRoutes = HttpApiBuilder.layer(Api, { openapiPath: "/openapi.json" }).pipe(
  Layer.provide(UsersLive),
)

const Server = HttpRouter.serve(Layer.mergeAll(Health, ApiRoutes, HttpApiScalar.layer(Api))).pipe(
  Layer.provide(Users.layer),
  Layer.provide(NodeHttpServer.layer(createServer, { port: 3000 })),
)

Layer.launch(Server).pipe(NodeRuntime.runMain)
