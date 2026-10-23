import { Config, Effect } from "effect"
import { FetchHttpClient, HttpClient, HttpClientRequest } from "effect/http"
import { HttpApiClient } from "effect/http-api"
import { Api } from "./Api.ts"
import { UserId } from "./User.ts"

// TOKEN=$(npm run -s token) node src/client.ts
const program = Effect.gen(function* () {
  const token = yield* Config.Redacted("TOKEN")
  const client = yield* HttpApiClient.make(Api, {
    baseUrl: "http://localhost:3000",
    // Every request carries the token. get doesn't need it, and the server ignores it there.
    transformClient: HttpClient.mapRequest(HttpClientRequest.bearerToken(token)),
  })
  const created = yield* client.users.create({
    payload: { name: "Grace", email: "grace@example.com" },
  })
  const found = yield* client.users.get({ params: { id: UserId.make(created.id) } })
  const missing = yield* client.users
    .get({ params: { id: UserId.make("999") } })
    .pipe(Effect.catchTag("UserNotFound", (error) => Effect.succeed(error.message)))
  console.log({ created, found, missing })
  yield* client.users.create({ payload: { name: "", email: "nobody@example.com" } })
})

program.pipe(Effect.provide(FetchHttpClient.layer), Effect.runPromise).catch(console.error)
