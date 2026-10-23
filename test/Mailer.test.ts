import { assert, describe, it } from "@effect/vitest"
import { Cause, Clock, Effect, Exit, Fiber, Layer } from "effect"
import { HttpClient, HttpClientError, HttpClientResponse } from "effect/http"
import { TestClock } from "effect/testing"
import { MailError, Mailer } from "../src/Mailer.ts"

const grace = { id: "2", name: "Grace", email: "grace@example.com" }

// A mail service that answers each attempt from a script: a status code, "hang" for no answer at all,
// or "refused" for a connection that fails before any answer.
// It records when each attempt arrived (on the TestClock) and which idempotency key it carried.
const fakeMail = (script: ReadonlyArray<number | "hang" | "refused">) => {
  const attempts: Array<{ at: number; key: string | undefined }> = []
  const client = HttpClient.make((request) =>
    Effect.gen(function* () {
      attempts.push({ at: yield* Clock.currentTimeMillis, key: request.headers["idempotency-key"] })
      const next = script[Math.min(attempts.length, script.length) - 1]
      if (next === "hang") return yield* Effect.never
      if (next === "refused") {
        return yield* new HttpClientError.HttpClientError({ reason: new HttpClientError.TransportError({ request }) })
      }
      return HttpClientResponse.fromWeb(request, new Response(null, { status: next }))
    }),
  )
  return { attempts, layer: Mailer.layer.pipe(Layer.provide(Layer.succeed(HttpClient.HttpClient, client))) }
}

// Start the send, move the clock a minute, and see how it ended.
const send = Effect.gen(function* () {
  const fiber = yield* Effect.forkChild(Mailer.use((mailer) => mailer.welcome(grace)))
  yield* TestClock.adjust("1 minute")
  return yield* Fiber.await(fiber)
})

// The MailError's cause: what went wrong on the last attempt, or the 5 second timeout.
const causeOf = (exit: Exit.Exit<unknown, unknown>) => {
  const error = Exit.isFailure(exit) ? Cause.squash(exit.cause) : undefined
  assert.instanceOf(error, MailError)
  return (error as MailError).cause
}

const statusOf = (cause: unknown) =>
  HttpClientError.isHttpClientError(cause) && cause.reason._tag === "StatusCodeError"
    ? cause.reason.response.status
    : undefined

describe("Mailer.welcome", () => {
  it.effect("two 503s, then 202: sent on the third attempt, with backoff between", () =>
    Effect.gen(function* () {
      const mail = fakeMail([503, 503, 202])
      const exit = yield* send.pipe(Effect.provide(mail.layer))
      assert.isTrue(Exit.isSuccess(exit))
      const [first, second, third] = mail.attempts.map((attempt) => attempt.at)
      assert.strictEqual(mail.attempts.length, 3)
      assert.strictEqual(first, 0)
      // 250 ms, then 500 ms, each jittered by up to 20% either way.
      assert.isTrue(second! >= 200 && second! <= 300, `second attempt at ${second}`)
      assert.isTrue(third! - second! >= 400 && third! - second! <= 600, `third attempt ${third! - second!} ms later`)
    }),
  )

  it.effect("every attempt carries the same idempotency key", () =>
    Effect.gen(function* () {
      const mail = fakeMail([503, 503, 202])
      yield* send.pipe(Effect.provide(mail.layer))
      assert.deepStrictEqual(mail.attempts.map((attempt) => attempt.key), ["welcome-2", "welcome-2", "welcome-2"])
    }),
  )

  it.effect("a 422 isn't retried", () =>
    Effect.gen(function* () {
      const mail = fakeMail([422])
      const cause = causeOf(yield* send.pipe(Effect.provide(mail.layer)))
      assert.strictEqual(mail.attempts.length, 1)
      assert.strictEqual(statusOf(cause), 422)
    }),
  )

  it.effect("a 503 that never ends: one attempt and three retries, then MailError", () =>
    Effect.gen(function* () {
      const mail = fakeMail([503])
      const cause = causeOf(yield* send.pipe(Effect.provide(mail.layer)))
      assert.strictEqual(mail.attempts.length, 4)
      assert.strictEqual(statusOf(cause), 503)
    }),
  )

  it.effect("a refused connection is retried too: four attempts, then MailError", () =>
    Effect.gen(function* () {
      const mail = fakeMail(["refused"])
      const cause = causeOf(yield* send.pipe(Effect.provide(mail.layer)))
      assert.strictEqual(mail.attempts.length, 4)
      assert.isTrue(HttpClientError.isHttpClientError(cause) && cause.reason._tag === "TransportError")
    }),
  )

  it.effect("a mail service that never answers: cut off at 5 seconds, after three attempts", () =>
    Effect.gen(function* () {
      const mail = fakeMail(["hang"])
      const exit = yield* Effect.gen(function* () {
        const fiber = yield* Effect.forkChild(Mailer.use((mailer) => mailer.welcome(grace)))
        yield* TestClock.adjust("4999 millis")
        assert.isUndefined(fiber.pollUnsafe())
        yield* TestClock.adjust("1 millis")
        return yield* Fiber.await(fiber)
      }).pipe(Effect.provide(mail.layer))
      assert.isTrue(Cause.isTimeoutError(causeOf(exit)))
      // At 0, at 2 s + ~250 ms, and at ~4.75 s. The third one is still waiting when the 5 seconds run out.
      assert.strictEqual(mail.attempts.length, 3)
    }),
  )
})
