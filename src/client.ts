import { Effect } from "effect"
import { FetchHttpClient } from "effect/http"
import { HttpApiClient } from "effect/http-api"
import { Api } from "./Api.ts"
import { UserId } from "./User.ts"

const program = Effect.gen(function* () {
  const client = yield* HttpApiClient.make(Api, { baseUrl: "http://localhost:3000" })
  const created = yield* client.users.create({
    payload: { name: "Grace", email: "grace@example.com" },
  })
  const found = yield* client.users.get({ params: { id: UserId.make(created.id) } })
  console.log({ created, found })
  yield* client.users.create({ payload: { name: "", email: "nobody@example.com" } })
})

program.pipe(Effect.provide(FetchHttpClient.layer), Effect.runPromise).catch(console.error)
