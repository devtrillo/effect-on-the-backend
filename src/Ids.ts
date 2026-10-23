import { Context, Effect, Layer } from "effect"

// Hands out user ids for Users.layerMemory. Since part 9, Postgres makes the real ones.
export class Ids extends Context.Service<Ids, { readonly next: Effect.Effect<string> }>()("Ids") {
  static readonly layer = Layer.sync(Ids, () => {
    let last = 0
    return { next: Effect.sync(() => String(++last)) }
  })
}
