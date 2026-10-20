// Run with: node src/part-2/plain-node.ts
// The same lookup in plain async Node, for comparison.
class UserNotFound extends Error {
  constructor(id: string) {
    super(`user ${id} not found`)
  }
}

const rows = new Map([["1", { id: "1", name: "Ada" }]])
const db = {
  get: async (id: string) => {
    await new Promise((resolve) => setTimeout(resolve, 1))
    return rows.get(id)
  },
}

async function findUser(id: string) {
  const user = await db.get(id)
  if (!user) throw new UserNotFound(id)
  return user
}

async function getUser(id: string) {
  return await findUser(id)
}

async function getUserNoAwait(id: string) {
  return findUser(id)
}

for (const handler of [getUser, getUserNoAwait]) {
  try {
    await handler("2")
  } catch (error) {
    console.log(`--- ${handler.name}\n${(error as Error).stack}`)
  }
}
