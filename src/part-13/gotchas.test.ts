// Runnable: npm test
// What surprises you in retryTransient and Schedule. Every test runs on TestClock.
import { assert, describe, it } from "@effect/vitest"
import { Cause, Clock, Duration, Effect, Exit, Fiber, Layer, Schedule } from "effect"
import { HttpClient, HttpClientResponse } from "effect/http"
import { TestClock } from "effect/testing"
import { MailError, Mailer } from "../Mailer.ts"

// A fake upstream: answers attempt n with script(n), and records when each attempt arrived.
const upstream = (script: (attempt: number) => { status: number; headers?: Record<string, string> } | "hang") => {
  const attempts: Array<number> = []
  const client = HttpClient.make((request) =>
    Effect.gen(function* () {
      attempts.push(yield* Clock.currentTimeMillis)
      const answer = script(attempts.length)
      if (answer === "hang") return yield* Effect.never
      return HttpClientResponse.fromWeb(request, new Response(null, answer))
    }),
  )
  return { attempts, client }
}

const get = <E>(client: HttpClient.HttpClient.With<E>) => client.get("http://upstream/thing")

const runFor = <A, E, R>(effect: Effect.Effect<A, E, R>, time: Duration.Input) =>
  Effect.gen(function* () {
    const fiber = yield* Effect.forkChild(effect)
    yield* TestClock.adjust(time)
    return yield* Fiber.await(fiber)
  })

describe("retryTransient", () => {
  // 1. No schedule means Schedule.forever: no delay. No times means no limit.
  it.effect("with no options, it retries immediately and without end", () =>
    Effect.gen(function* () {
      const up = upstream((n) => ({ status: n <= 1000 ? 503 : 200 }))
      const client = up.client.pipe(HttpClient.filterStatusOk, HttpClient.retryTransient({}))
      yield* get(client)
      assert.strictEqual(up.attempts.length, 1001)
      assert.strictEqual(yield* Clock.currentTimeMillis, 0)
    }),
  )

  // 2. Retry-After is a floor on the delay. Here 30 seconds beats a 250 ms backoff.
  it.effect("Retry-After: 30 on a 429 waits 30 seconds", () =>
    Effect.gen(function* () {
      const up = upstream((n) => (n === 1 ? { status: 429, headers: { "retry-after": "30" } } : { status: 200 }))
      const client = up.client.pipe(
        HttpClient.filterStatusOk,
        HttpClient.retryTransient({ schedule: Schedule.exponential("250 millis"), times: 3 }),
      )
      yield* runFor(get(client), "1 minute")
      assert.deepStrictEqual(up.attempts, [0, 30_000])
    }),
  )

  // 3. The timeout's position decides what it limits. After retryTransient, it's one deadline for everything,
  // and the TimeoutError happens outside the retry, so nothing retries it.
  it.effect("a timeout piped after retryTransient covers all attempts, and isn't retried", () =>
    Effect.gen(function* () {
      const up = upstream(() => "hang")
      const client = up.client.pipe(
        HttpClient.filterStatusOk,
        HttpClient.retryTransient({ schedule: Schedule.exponential("250 millis"), times: 3 }),
        HttpClient.transformResponse(Effect.timeout("2 seconds")),
      )
      yield* runFor(get(client), "1 minute")
      assert.strictEqual(up.attempts.length, 1)
    }),
  )

  // 4. 501 Not Implemented isn't in the transient list (408, 429, 500, 502, 503, 504).
  it.effect("a 501 isn't retried", () =>
    Effect.gen(function* () {
      const up = upstream(() => ({ status: 501 }))
      const client = up.client.pipe(HttpClient.filterStatusOk, HttpClient.retryTransient({ times: 3 }))
      yield* runFor(Effect.exit(get(client)), "1 minute")
      assert.strictEqual(up.attempts.length, 1)
    }),
  )
})

describe("the Mailer", () => {
  const mailer = (script: Parameters<typeof upstream>[0]) => {
    const up = upstream(script)
    return { up, layer: Mailer.layer.pipe(Layer.provide(Layer.succeed(HttpClient.HttpClient, up.client))) }
  }
  const welcome = Mailer.use((m) => m.welcome({ id: "2", name: "Grace", email: "grace@example.com" }))

  // 5. Retry-After: 30 meets the 5 second deadline. The deadline wins.
  it.effect("Retry-After longer than the deadline: one attempt, then MailError at 5 seconds", () =>
    Effect.gen(function* () {
      const { up, layer } = mailer(() => ({ status: 429, headers: { "retry-after": "30" } }))
      const exit = yield* runFor(Effect.exit(welcome), "1 minute").pipe(Effect.provide(layer))
      assert.strictEqual(up.attempts.length, 1)
      const error = Exit.isSuccess(exit) && Exit.isFailure(exit.value) ? Cause.squash(exit.value.cause) : undefined
      assert.instanceOf(error, MailError)
      assert.isTrue(Cause.isTimeoutError((error as MailError).cause))
    }),
  )

  // 6. Retries multiply. Three more retries around a client that already retries three times: 4 × 4 attempts.
  it.effect("Effect.retry({ times: 3 }) around welcome sends 16 requests to a dead upstream", () =>
    Effect.gen(function* () {
      const { up, layer } = mailer(() => ({ status: 503 }))
      yield* runFor(Effect.exit(welcome.pipe(Effect.retry({ times: 3 }))), "1 minute").pipe(Effect.provide(layer))
      assert.strictEqual(up.attempts.length, 16)
    }),
  )
})

describe("Schedule.jittered", () => {
  // 7. Effect's jitter scales each delay by 0.8 to 1.2. It isn't "full jitter" (0 to the full delay).
  it.effect("keeps every delay within 20% of the original", () =>
    Effect.gen(function* () {
      const step = yield* Schedule.toStep(Schedule.spaced("1 second").pipe(Schedule.jittered))
      const delays: Array<number> = []
      for (let i = 0; i < 1000; i++) {
        const [, delay] = yield* step(0, undefined)
        delays.push(Duration.toMillis(delay))
      }
      assert.isAtLeast(Math.min(...delays), 800)
      assert.isAtMost(Math.max(...delays), 1200)
    }),
  )
})
