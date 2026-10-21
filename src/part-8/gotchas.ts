// Runnable: node src/part-8/gotchas.ts
// Where layer wiring surprises you: build order, how many times a layer builds,
// and what Layer.provide hides.
import { Effect, Layer } from "effect"
import { HttpRouter, HttpServerResponse } from "effect/http"
import { Ids } from "../Ids.ts"
import { UserId } from "../User.ts"
import { Users } from "../Users.ts"

const log: Array<string> = []
const build = (layer: Layer.Layer<never, unknown, never>) =>
  Effect.runPromiseExit(Layer.build(layer).pipe(Effect.scoped)).then(() => log.splice(0).join(", "))

// 1. Layer.provide builds the dependency first. mergeAll, and provide([...]), build at the same time.
//    The check takes 50 ms and fails, like a database that isn't there.
const Check = Layer.effectDiscard(
  Effect.sleep(50).pipe(Effect.andThen(Effect.sync(() => log.push("check failed"))), Effect.andThen(Effect.fail("no db"))),
)
const Listen = Layer.effectDiscard(Effect.sync(() => log.push("port open")))
const App = Layer.effectDiscard(Effect.sync(() => log.push("app")))
console.log("chain           ", await build(App.pipe(Layer.provide(Listen), Layer.provide(Check))))
console.log("array           ", await build(App.pipe(Layer.provide([Listen, Check]))))

// 2. One build shares a layer by reference. A function that returns a layer
//    returns a new reference each call, so each call builds its own.
const counted = () =>
  Layer.effect(Users, Effect.andThen(Effect.sync(() => log.push("Users built")), Users.make)).pipe(
    Layer.provide(Ids.layer),
  )
const once = counted()
console.log("same reference  ", await build(Layer.mergeAll(once, once)))
console.log("two calls       ", await build(Layer.mergeAll(counted(), counted())))

// 3. Effect.provide inside a handler builds the layer per request: a new map every time.
const perRequest = <A, E>(effect: Effect.Effect<A, E, Users>) => effect.pipe(Effect.provide(Users.layer))
const Create = HttpRouter.add(
  "POST",
  "/users",
  perRequest(Users.use((users) => users.create({ name: "Grace", email: "grace@example.com" }))).pipe(
    Effect.map((user) => HttpServerResponse.text(user.id, { status: 201 })),
  ),
)
const Get = HttpRouter.add(
  "GET",
  "/users/2",
  perRequest(Users.use((users) => users.find(UserId.make("2")))).pipe(
    Effect.map((user) => HttpServerResponse.text(user.name)),
    Effect.catchTag("UserNotFound", (e) => Effect.succeed(HttpServerResponse.text(e.message, { status: 404 }))),
  ),
)
const call = async (handler: (request: Request) => Promise<Response>, method: string, path: string) => {
  const response = await handler(new Request(`http://localhost${path}`, { method }))
  return `${response.status} ${JSON.stringify(await response.text())}`
}
const inner = HttpRouter.toWebHandler(Layer.mergeAll(Create, Get), { disableLogger: true })
console.log("provide inside  ", await call(inner.handler, "POST", "/users"), "then", await call(inner.handler, "GET", "/users/2"))
await inner.dispose()

// 4. Layer.provide hides Ids from the type. provideMerge hands back the Ids that Users used.
//    Providing Ids.layer again is the same reference, so it's the same counter too.
//    Only Layer.fresh (or a new layer value) builds a second one.
const nextAfterCreate = Effect.gen(function* () {
  yield* Users.use((users) => users.create({ name: "Grace", email: "grace@example.com" }))
  return yield* Ids.use((ids) => ids.next)
})
const merged = Layer.effect(Users, Users.make).pipe(Layer.provideMerge(Ids.layer))
console.log("provideMerge    ", await Effect.runPromise(nextAfterCreate.pipe(Effect.provide(merged))))
console.log("provide twice   ", await Effect.runPromise(nextAfterCreate.pipe(Effect.provide(Users.layer), Effect.provide(Ids.layer))))
console.log("fresh Ids       ", await Effect.runPromise(nextAfterCreate.pipe(Effect.provide(Users.layer), Effect.provide(Layer.fresh(Ids.layer)))))
