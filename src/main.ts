import { NodeHttpServer, NodeRuntime } from "@effect/platform-node"
import { Effect, Layer } from "effect"
import { HttpRouter, HttpServerResponse } from "effect/http"
import { createServer } from "node:http"
import { getUser } from "./getUser.ts"
import { Users } from "./Users.ts"

const Health = HttpRouter.add("GET", "/health", HttpServerResponse.text("ok"))

const GetUser = HttpRouter.add(
  "GET",
  "/users/:id",
  Effect.fn("UsersHttp.get")(function* () {
    const { id = "" } = yield* HttpRouter.params
    const user = yield* getUser(id)
    return HttpServerResponse.jsonUnsafe(user)
  }),
)

const Server = HttpRouter.serve(Layer.mergeAll(Health, GetUser)).pipe(
  Layer.provide(Users.layer),
  Layer.provide(NodeHttpServer.layer(createServer, { port: 3000 })),
)

Layer.launch(Server).pipe(NodeRuntime.runMain)
