// Runnable: npm test
// What surprises you in @effect/vitest: shared layers, and a clock that doesn't move.
import { assert, describe, it, layer } from "@effect/vitest"
import { Clock, Effect, Fiber } from "effect"
import { TestClock } from "effect/testing"
import { CurrentUser } from "../Auth.ts"
import { Users } from "../Users.ts"

const ada = { id: "1", name: "Ada" }
const createGrace = Users.use((users) => users.create({ name: "Grace", email: "grace@example.com" })).pipe(
  Effect.provideService(CurrentUser, ada),
)

// 1. layer() builds once for the whole block. The second test sees the first one's Grace.
layer(Users.layerMemory)("shared layer", (it) => {
  it.effect("first create gets id 2", () => Effect.map(createGrace, (user) => assert.strictEqual(user.id, "2")))
  it.effect("second create gets id 3", () => Effect.map(createGrace, (user) => assert.strictEqual(user.id, "3")))
})

// Effect.provide in each test builds a new one per test.
describe("layer per test", () => {
  it.effect("first create gets id 2", () =>
    Effect.map(createGrace, (user) => assert.strictEqual(user.id, "2")).pipe(Effect.provide(Users.layerMemory)),
  )
  it.effect("second create gets id 2 too", () =>
    Effect.map(createGrace, (user) => assert.strictEqual(user.id, "2")).pipe(Effect.provide(Users.layerMemory)),
  )
})

// 2. it.effect runs on TestClock. Time starts at 0 and only moves when you move it.
describe("TestClock", () => {
  it.effect("the clock starts at 0", () =>
    Effect.map(Clock.currentTimeMillis, (now) => assert.strictEqual(now, 0)),
  )

  // A sleep never wakes up on its own: this test hits vitest's timeout. .fails expects that.
  it.effect.fails("a plain sleep times out", () => Effect.sleep("1 second"), 200)

  // Fork the sleep, move the clock, and it finishes at once.
  it.effect("TestClock.adjust wakes it", () =>
    Effect.gen(function* () {
      const fiber = yield* Effect.forkChild(Effect.sleep("1 hour"))
      yield* TestClock.adjust("1 hour")
      yield* Fiber.join(fiber)
      assert.strictEqual(yield* Clock.currentTimeMillis, 3_600_000)
    }),
  )

  // it.live uses the real clock.
  it.live("it.live sleeps for real", () =>
    Effect.gen(function* () {
      const start = Date.now()
      yield* Effect.sleep("50 millis")
      assert.isAtLeast(Date.now() - start, 45)
    }),
  )
})
