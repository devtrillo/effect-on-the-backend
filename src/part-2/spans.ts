// Run with: node src/part-2/spans.ts
// A tracer that collects spans in memory, so we can print them without an exporter.
import { Effect, Tracer } from "effect"
import { getUser } from "../getUser.ts"
import { Users } from "../Users.ts"

const spans: Array<Tracer.NativeSpan> = []
const tracer = Tracer.make({
  span(options) {
    const span = new Tracer.NativeSpan(options)
    spans.push(span)
    return span
  },
})

const run = <A, E>(effect: Effect.Effect<A, E, Users>) =>
  Effect.runPromiseExit(
    effect.pipe(
      Effect.provide(Users.layerMemory),
      Effect.provideService(Tracer.Tracer, tracer),
    ),
  )

const print = (title: string) => {
  console.log(`--- ${title}`)
  for (const span of spans) {
    const indent = span.parent._tag === "Some" ? "  " : ""
    const exit = span.status._tag === "Ended" ? span.status.exit._tag : "open"
    const attrs = JSON.stringify(Object.fromEntries(span.attributes))
    console.log(`${(indent + span.name).padEnd(14)} ${exit.padEnd(8)} ${attrs}`)
  }
  spans.length = 0
}

await run(getUser("1"))
await run(getUser("2"))
print("getUser(\"1\"), then getUser(\"2\")")

// Recover from UserNotFound two ways: passed to Effect.fn, or piped at the call site.
const inside = Effect.fn("inside")(
  function* (id: string) {
    return yield* getUser(id)
  },
  Effect.catchTag("UserNotFound", () => Effect.succeed(null)),
)

const outsideBase = Effect.fn("outside")(function* (id: string) {
  return yield* getUser(id)
})
const outside = (id: string) =>
  outsideBase(id).pipe(
    Effect.catchTag("UserNotFound", () => Effect.succeed(null)),
  )

console.log("inside:", (await run(inside("2")))._tag)
console.log("outside:", (await run(outside("2")))._tag)
print("catchTag inside vs outside")
