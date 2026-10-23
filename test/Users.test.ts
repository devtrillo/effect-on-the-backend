import { assert, describe, it, layer } from "@effect/vitest"
import { Effect, Layer, Redacted } from "effect"
import { HttpClientRequest, HttpRouter, HttpServer } from "effect/http"
import { HttpApiBuilder, HttpApiMiddleware, HttpApiTest } from "effect/http-api"
import { Api } from "../src/Api.ts"
import { Authorization, Unauthorized } from "../src/Auth.ts"
import { AuthorizationLive, UsersHttp, ValidationLive } from "../src/Http.ts"
import { Mailer } from "../src/Mailer.ts"
import { Tokens } from "../src/Tokens.ts"
import { UserId } from "../src/User.ts"
import { Users } from "../src/Users.ts"

const ada = { id: "1", name: "Ada", email: "ada@example.com" }

// One valid token, for Ada. No hashing and no table: this fake stands in for Postgres.
const TokensTest = Layer.succeed(
  Tokens,
  Tokens.of({
    issue: () => Effect.die("not used in tests"),
    verify: (token) =>
      Redacted.value(token) === "ada-token" ? Effect.succeed(ada) : Effect.fail(new Unauthorized()),
  }),
)

// Every welcome mail "sends" at once. test/Mailer.test.ts covers the real one.
const MailerTest = Layer.succeed(Mailer, Mailer.of({ welcome: () => Effect.void }))

// The real handlers and middleware, with in-memory Users and fake Tokens and Mailer.
// provideMerge, not provide: HttpApiTest.groups asks for the middleware services in its type.
const UsersTest = UsersHttp.pipe(
  Layer.provideMerge([ValidationLive, AuthorizationLive]),
  Layer.provide([Users.layerMemory, TokensTest, MailerTest]),
)

// A typed client wired straight to the handlers. No server, no port.
const makeClient = HttpApiTest.groups(Api, ["users"])

// The client half of Authorization: send Ada's token on every request.
const asAda = HttpApiMiddleware.layerClient(Authorization, ({ next, request }) =>
  next(HttpClientRequest.bearerToken(request, "ada-token")),
)

layer(Layer.mergeAll(UsersTest, HttpServer.layerServices))("users", (it) => {
  it.effect("GET /users/1 is Ada", () =>
    Effect.gen(function* () {
      const client = yield* makeClient
      const user = yield* client.users.get({ params: { id: UserId.make("1") } })
      assert.deepStrictEqual(user, { id: "1", name: "Ada" })
    }),
  )

  it.effect("GET /users/999 is UserNotFound", () =>
    Effect.gen(function* () {
      const client = yield* makeClient
      const error = yield* client.users.get({ params: { id: UserId.make("999") } }).pipe(Effect.flip)
      assert.strictEqual(error._tag, "UserNotFound")
    }),
  )

  it.effect("POST /users without a token is Unauthorized", () =>
    Effect.gen(function* () {
      const client = yield* makeClient
      const error = yield* client.users
        .create({ payload: { name: "Grace", email: "grace@example.com" } })
        .pipe(Effect.flip)
      assert.strictEqual(error._tag, "Unauthorized")
    }),
  )

  it.effect("POST /users with Ada's token creates the user", () =>
    Effect.gen(function* () {
      const client = yield* makeClient
      const user = yield* client.users.create({ payload: { name: "Grace", email: "grace@example.com" } })
      assert.strictEqual(user.name, "Grace")
    }).pipe(Effect.provide(asAda)),
  )
})

// The typed client validates the payload before it sends it, so it can't send a bad one.
// These two go through a web handler instead: a Request in, a Response out, still no port.
const call = Effect.fn(function* (headers: Record<string, string>, body: string) {
  const { handler, dispose } = HttpRouter.toWebHandler(
    HttpApiBuilder.layer(Api).pipe(Layer.provide(UsersTest), Layer.provide(HttpServer.layerServices)),
    { disableLogger: true },
  )
  yield* Effect.addFinalizer(() => Effect.promise(dispose))
  const response = yield* Effect.promise(() =>
    handler(new Request("http://test/users", {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body,
    })),
  )
  return { status: response.status, body: yield* Effect.promise(() => response.json()) }
})

describe("raw requests", () => {
  it.effect("a blank name without a token is a 401, not a 400", () =>
    Effect.gen(function* () {
      const response = yield* call({}, `{"name":"","email":"nope"}`)
      assert.deepStrictEqual(response, { status: 401, body: { _tag: "Unauthorized" } })
    }),
  )

  it.effect("a blank name with a token is a 400 with both issues", () =>
    Effect.gen(function* () {
      const response = yield* call({ authorization: "Bearer ada-token" }, `{"name":"","email":"nope"}`)
      assert.deepStrictEqual(response, {
        status: 400,
        body: {
          _tag: "BadRequest",
          issues: [
            { message: "Expected a value with a length of at least 1", path: ["name"] },
            { message: "Expected an email address", path: ["email"] },
          ],
        },
      })
    }),
  )
})
