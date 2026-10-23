import { Config, Context, Effect, Layer, Schedule, Schema } from "effect"
import { HttpClient, HttpClientRequest } from "effect/http"

export class MailError extends Schema.TaggedError<MailError>()("MailError", {
  cause: Schema.Defect(),
}) {
  // The last attempt's error, or the 5 second timeout.
  override get message() {
    return this.cause instanceof Error ? this.cause.message : String(this.cause)
  }
}

const make = Effect.gen(function* () {
  const url = yield* Config.String("MAIL_URL").pipe(Config.withDefault("http://localhost:3001"))

  // Read bottom up: retry the attempt, time each attempt out, fail on a non-2xx status.
  const client = (yield* HttpClient.HttpClient).pipe(
    HttpClient.mapRequest(HttpClientRequest.prependUrl(url)),
    HttpClient.filterStatusOk,
    // Each attempt gets 2 seconds. A timeout counts as transient, so it's retried like a 503.
    HttpClient.transformResponse(Effect.timeout("2 seconds")),
    // Timeouts, network errors, 408, 429 and 5xx (not 501), with backoff: ~250 ms, ~500 ms, ~1 s.
    HttpClient.retryTransient({
      schedule: Schedule.exponential("250 millis").pipe(Schedule.jittered),
      times: 3,
    }),
  )

  return {
    welcome: Effect.fn("Mailer.welcome")(
      function* (user: { readonly id: string; readonly name: string; readonly email: string }) {
        yield* Effect.annotateCurrentSpan("user.id", user.id)
        yield* HttpClientRequest.post("/send").pipe(
          // Same key on every attempt, and on any later resend: the mail service sends it once.
          HttpClientRequest.setHeader("idempotency-key", `welcome-${user.id}`),
          HttpClientRequest.bodyJsonUnsafe({ to: user.email, subject: "Welcome", text: `Hi ${user.name}!` }),
          client.execute,
        )
      },
      // The whole send, retries and waits included, gets 5 seconds.
      Effect.timeout("5 seconds"),
      Effect.mapError((cause) => new MailError({ cause })),
    ),
  }
})

export class Mailer extends Context.Service<Mailer>()("Mailer", { make }) {
  // Needs an HttpClient. main.ts provides the fetch one, the tests a fake.
  static readonly layer = Layer.effect(this, this.make)
}
