// POST /users with plain node:http, trusting the body. One bad body ends the process.
// Run: node src/part-4/plain.ts
import { createServer } from "node:http"

const users = new Map([["1", { id: "1", name: "Ada", email: "ada@example.com" }]])

createServer(async (req, res) => {
  if (req.method !== "POST" || req.url !== "/users") return res.writeHead(404).end()
  let raw = ""
  for await (const chunk of req) raw += chunk
  const body = JSON.parse(raw) as { name: string; email: string }
  const user = { id: String(users.size + 1), name: body.name.trim(), email: body.email }
  users.set(user.id, user)
  res.writeHead(201, { "content-type": "application/json" }).end(JSON.stringify(user))
}).listen(3000)
