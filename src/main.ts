import { NodeHttpServer, NodeRuntime } from "@effect/platform-node"
import { Effect, Layer, Schema, SchemaIssue } from "effect"
import { HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/http"
import { createServer } from "node:http"
import { getUser } from "./getUser.ts"
import { NewUser, UserParams } from "./User.ts"
import { Users } from "./Users.ts"

const formatIssues = SchemaIssue.makeFormatterStandardSchemaV1()

const invalid = (error: Schema.SchemaError) =>
  HttpServerResponse.json(
    { error: "BadRequest", issues: formatIssues(error.issue).issues },
    { status: 400 },
  )

const notJson = () =>
  HttpServerResponse.json(
    { error: "BadRequest", issues: [{ path: [], message: "Body is not valid JSON" }] },
    { status: 400 },
  )

const Health = HttpRouter.add("GET", "/health", HttpServerResponse.text("ok"))

const GetUser = HttpRouter.add(
  "GET",
  "/users/:id",
  Effect.fn("UsersHttp.get")(
    function* () {
      const { id } = yield* HttpRouter.schemaPathParams(UserParams)
      const user = yield* getUser(id)
      return HttpServerResponse.jsonUnsafe(user)
    },
    Effect.catchTag("SchemaError", invalid),
  ),
)

const CreateUser = HttpRouter.add(
  "POST",
  "/users",
  Effect.fn("UsersHttp.create")(
    function* () {
      const input = yield* HttpServerRequest.schemaBodyJson(NewUser, { errors: "all" })
      const users = yield* Users
      const user = yield* users.create(input)
      return HttpServerResponse.jsonUnsafe(user, { status: 201 })
    },
    Effect.catchTags({ SchemaError: invalid, HttpServerError: notJson }),
  ),
)

const Server = HttpRouter.serve(Layer.mergeAll(Health, GetUser, CreateUser)).pipe(
  Layer.provide(Users.layer),
  Layer.provide(NodeHttpServer.layer(createServer, { port: 3000 })),
)

Layer.launch(Server).pipe(NodeRuntime.runMain)
