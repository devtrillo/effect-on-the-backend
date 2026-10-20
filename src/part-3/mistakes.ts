// Type-check only: `npm run check` covers it. Each @ts-expect-error marks a
// program that runMain refuses because something is still required.
import { NodeHttpServer, NodeRuntime } from "@effect/platform-node"
import { Effect, Layer } from "effect"
import { HttpRouter, HttpServerResponse } from "effect/http"
import { createServer } from "node:http"
import { getUser } from "../getUser.ts"
import { Users } from "../Users.ts"

const GetUser = HttpRouter.add(
  "GET",
  "/users/:id",
  Effect.fn("UsersHttp.get")(function* () {
    const { id = "" } = yield* HttpRouter.params
    const user = yield* getUser(id)
    return HttpServerResponse.jsonUnsafe(user)
  }),
)

const NodeServer = NodeHttpServer.layer(createServer, { port: 3000 })

// Forgot the Node server.
const noServer = HttpRouter.serve(GetUser).pipe(Layer.provide(Users.layer))

// Forgot the Users service.
const noUsers = HttpRouter.serve(GetUser).pipe(Layer.provide(NodeServer))

// Wrapped in a function so importing this file never starts a server.
export const programs = () => [
  // @ts-expect-error TS2684: Type 'HttpServer' is not assignable to type 'never'.
  Layer.launch(noServer).pipe(NodeRuntime.runMain),
  // @ts-expect-error TS2684: Type 'Users' is not assignable to type 'never'.
  Layer.launch(noUsers).pipe(NodeRuntime.runMain),
]
