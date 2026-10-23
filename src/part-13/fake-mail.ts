// Runnable: npm run mail
// A flaky stand-in for an email API, in plain node:http. POST /send fails on purpose, then sends.
// MAIL_FAILS sets what the first attempts for each idempotency key get: a status code, "hang" (no
// answer at all) or "slow" (sends the mail, answers 3 seconds later). The default, "503,hang", means:
// 503, then no answer, then 202 on the third try.
import { createServer } from "node:http"

const port = Number(process.env.MAIL_PORT ?? 3001)
const fails = (process.env.MAIL_FAILS ?? "503,hang").split(",").filter(Boolean)
const attempts = new Map<string, number>()
const sent = new Set<string>()

createServer((req, res) => {
  const key = String(req.headers["idempotency-key"] ?? "")
  const attempt = (attempts.get(key) ?? 0) + 1
  attempts.set(key, attempt)
  const log = (what: string) => console.log(`POST /send key=${key} attempt ${attempt}: ${what}`)

  if (sent.has(key)) {
    log("200, already sent, not sending again")
    return res.writeHead(200).end()
  }
  const fail = fails[attempt - 1]
  if (fail === "hang") {
    log("no answer")
    return res.on("close", () => log("client gave up"))
  }
  if (fail === "slow") {
    sent.add(key)
    log("sent, answering in 3 s")
    return setTimeout(() => res.writeHead(202).end(), 3000)
  }
  if (fail) {
    log(fail)
    return res.writeHead(Number(fail), fail === "429" ? { "retry-after": "1" } : {}).end()
  }
  sent.add(key)
  log("202, sent")
  res.writeHead(202).end()
}).listen(port, () => console.log(`fake mail on ${port}, failing with: ${fails.join(", ") || "nothing"}`))
