import { Context, Effect, Layer } from "effect"

// Hands out user ids. In memory for now: part 9's database takes over.
export class Ids extends Context.Service<Ids, { readonly next: Effect.Effect<string> }>()("Ids") {
  static readonly layer = Layer.sync(Ids, () => {
    let last = 0
    return { next: Effect.sync(() => String(++last)) }
  })
}
