// Runnable: node src/part-7/gotchas.ts
// Where config and secrets surprise you. Every config here is read from a
// provider built in this file, except the handler one, which reads process.env.
import { Config, ConfigProvider, Effect, Redacted, Schema } from "effect"
import { HttpRouter, HttpServerResponse } from "effect/http"

const read = <A>(config: Config.Config<A>, env: Record<string, string>) =>
  Effect.runPromiseExit(config.parse(ConfigProvider.fromEnv({ env }))).then((exit) =>
    exit._tag === "Success" ? exit.value : exit.cause.reasons.map((r) => (r._tag === "Fail" ? r.error.message : r._tag)).join(),
  )

const port = Config.Port("PORT").pipe(Config.withDefault(3000))
const databaseUrl = Config.Redacted("DATABASE_URL")

// 1. withDefault covers a missing value, and an empty one. Not a wrong one.
console.log("PORT unset      ", await read(port, {}))
console.log('PORT=""         ', await read(port, { PORT: "" }))
console.log("PORT=eighty     ", await read(port, { PORT: "eighty" }))

// 2. Config.all stops at the first missing value.
const both = Config.all({ apiKey: Config.Redacted("API_KEY"), databaseUrl })
console.log("both missing    ", await read(both, {}))

// 3. The error never prints the value, even for a plain string.
const postgres = Config.schema(Schema.String.check(Schema.isStartingWith("postgres://")), "DATABASE_URL")
console.log("not postgres    ", await read(postgres, { DATABASE_URL: "mysql://app:hunter2@db/app" }))
const mode = Config.Literals(["development", "production"], "NODE_ENV")
console.log("literal         ", await read(mode, { NODE_ENV: "hunter2" }))
console.log("int             ", await read(Config.Int("N"), { N: "hunter2" }))

// 4. Redacted hides the value until you take it out.
const secret = await Effect.runPromise(databaseUrl.parse(ConfigProvider.fromEnv({ env: { DATABASE_URL: "postgres://app:hunter2@db/app" } })))
console.log("String(secret)  ", String(secret), JSON.stringify({ secret }))
console.log("template        ", `connecting to ${Redacted.value(secret)}`)

// 5. Config read inside a handler: the server starts, and every request fails.
//    The default provider copies process.env once, so setting it later does not help.
const Route = HttpRouter.add(
  "GET",
  "/ping",
  Effect.gen(function* () {
    const url = yield* databaseUrl
    return HttpServerResponse.text(`have ${url}`)
  }),
)
const { handler, dispose } = HttpRouter.toWebHandler(Route, { disableLogger: true })
delete process.env.DATABASE_URL
const first = await handler(new Request("http://localhost/ping"))
console.log("handler, unset  ", first.status, JSON.stringify(await first.text()))
process.env.DATABASE_URL = "postgres://app:hunter2@db/app"
const second = await handler(new Request("http://localhost/ping"))
console.log("handler, set    ", second.status, JSON.stringify(await second.text()))
await dispose()

// 6. Tests swap the provider. No process.env needed.
const config = await Effect.runPromise(
  Config.all({ port, databaseUrl }).pipe(
    Effect.provide(ConfigProvider.layer(ConfigProvider.fromUnknown({ PORT: "8080", DATABASE_URL: "postgres://test" }))),
  ),
)
console.log("fromUnknown     ", config)
