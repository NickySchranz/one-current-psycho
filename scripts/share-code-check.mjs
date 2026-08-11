/* Cross-app share code: the patient app uploads a share and shows a code,
   the practice app redeems that code for a client, and the shared threads
   render. Codes are one-time — a second redeem is refused. */
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { chromium } from "playwright-core";

const API_DIR = "/home/nicky/one-current-api";
const API = "http://localhost:4000";
const PATIENT_DIST = "/home/nicky/one-current-app/dist";
const PSYCHO_DIST = new URL("../dist", import.meta.url).pathname;
const MIME = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".ico": "image/x-icon",
};
function serveDist(dist, port) {
  const server = createServer(async (req, res) => {
    const path = req.url === "/" ? "/index.html" : req.url.split("?")[0];
    try {
      const body = await readFile(join(dist, path));
      res.writeHead(200, { "content-type": MIME[extname(path)] ?? "application/octet-stream" });
      res.end(body);
    } catch {
      res.writeHead(404);
      res.end();
    }
  });
  return new Promise((r) => server.listen(port, () => r(server)));
}
const patientServer = await serveDist(PATIENT_DIST, 4186);
const psychoServer = await serveDist(PSYCHO_DIST, 4187);

try {
  await fetch(`${API}/v1/health`);
  throw new Error("something already answers on :4000 — stop it first");
} catch (e) {
  if (!(e instanceof TypeError)) throw e;
}
const api = spawn("npx", ["tsx", "src/node.ts"], {
  cwd: API_DIR,
  stdio: "ignore",
  detached: true,
});
process.on("exit", () => {
  try {
    process.kill(-api.pid, "SIGKILL");
  } catch {}
});
for (let i = 0; ; i++) {
  try {
    if ((await fetch(`${API}/v1/health`)).ok) break;
  } catch {}
  if (i > 80) throw new Error("the API never came up on :4000");
  await new Promise((r) => setTimeout(r, 250));
}

// Sharing is Pro: flip the patient seed user through the stub checkout first.
const login = await (
  await fetch(`${API}/v1/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "nikischranz@gmail.com", password: "test" }),
  })
).json();
const auth = { authorization: `Bearer ${login.accessToken}` };
const checkout = await (
  await fetch(`${API}/v1/billing/checkout`, {
    method: "POST",
    headers: { ...auth, "content-type": "application/json" },
    body: JSON.stringify({ app: "one-current" }),
  })
).json();
await fetch(`${API}/v1/billing/dev/complete`, {
  method: "POST",
  headers: { ...auth, "content-type": "application/json" },
  body: JSON.stringify({ sessionId: checkout.sessionId }),
});

const browser = await chromium.launch({
  executablePath: `${process.env.HOME}/.cache/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-linux64/chrome-headless-shell`,
  args: ["--no-sandbox"],
});
const errors = [];
let failed = false;
const check = (name, ok, detail = "") => {
  console.log(`${name}: ${detail}${detail ? " " : ""}${ok ? "OK" : "FAIL"}`);
  if (!ok) failed = true;
};
const trackErrors = (page) => {
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`${m.text()} @${m.location()?.url ?? ""}`);
  });
  page.on("pageerror", (e) => errors.push(e.message));
};

// ---- Patient side: upload a share and read the code ----
const patient = await browser.newPage({ viewport: { width: 1200, height: 900 } });
trackErrors(patient);
await patient.goto("http://localhost:4186/");
await patient.waitForTimeout(1800);
await patient.getByLabel("Email").fill("nikischranz@gmail.com");
await patient.getByLabel("Password").fill("test");
await patient.getByRole("button", { name: "Sign in", exact: true }).click();
await patient.waitForTimeout(2000);
check("patient login", (await patient.getByLabel("New thread").count()) > 0);

await patient.getByRole("button", { name: "More" }).first().click();
await patient.waitForTimeout(600);
await patient.getByRole("button", { name: "Load example threads" }).click();
await patient.waitForTimeout(900);
await patient.getByRole("button", { name: "More" }).first().click();
await patient.waitForTimeout(600);
const shared = await patient.evaluate(() =>
  JSON.parse(localStorage.getItem("one-current/table/branches") ?? "[]")
    .slice(0, 2)
    .map((b) => b.title),
);
for (const title of shared) {
  await patient.getByLabel("Which threads").getByText(title, { exact: true }).click();
  await patient.waitForTimeout(200);
}
await patient.getByRole("button", { name: "Upload and get a code" }).click();
await patient
  .getByText("Give this code to your psychologist. It works once and expires in 14 days.")
  .waitFor({ timeout: 8000 });
const code = await patient.evaluate(() => {
  const line = document.body.innerText
    .split("\n")
    .map((l) => l.trim())
    .find((l) => /^[23456789ABCDEFGHJKMNPQRSTVWXYZ]{8}$/.test(l));
  return line ?? "";
});
check("share code shown", code.length === 8, code);

// ---- Practice side: redeem the code for a client ----
const psycho = await browser.newPage({ viewport: { width: 1200, height: 900 } });
trackErrors(psycho);
await psycho.goto("http://localhost:4187/");
await psycho.waitForTimeout(1800);
await psycho.getByLabel("Email").fill("johannapoveda.28@gmail.com");
await psycho.getByLabel("Password", { exact: true }).fill("test");
await psycho.getByRole("button", { name: "Sign in" }).click();
await psycho.waitForTimeout(2000);
check(
  "practitioner login",
  (await psycho.getByRole("button", { name: "+ Add" }).count()) > 0,
);

// The wide layout keeps clients in a sidebar; + Add reveals the form.
await psycho.getByRole("button", { name: "+ Add" }).click();
await psycho.waitForTimeout(300);
await psycho.getByLabel("Client name").fill("Nicky S.");
await psycho.getByRole("button", { name: "Add client" }).click();
await psycho.waitForTimeout(600);
await psycho.getByRole("button", { name: "Open Nicky S." }).click();
await psycho.waitForTimeout(600);

await psycho.getByLabel("Share code").fill(code);
await psycho.getByRole("button", { name: "Redeem" }).click();
await psycho.waitForTimeout(2500);
check(
  "code redeemed",
  await psycho
    .getByText("The share arrived — it is listed above with the other shared files.")
    .isVisible(),
);

// the shared threads render in the stored share
await psycho.getByRole("button", { name: "View", exact: true }).first().click();
await psycho.waitForTimeout(800);
let titlesOk = true;
for (const title of shared) {
  if ((await psycho.getByText(title).count()) === 0) titlesOk = false;
}
check("shared threads render", titlesOk, shared.join(" · "));

// ---- one-time: the same code is refused a second time ----
await psycho.getByRole("button", { name: "← Back" }).click();
await psycho.waitForTimeout(600);
await psycho.getByLabel("Share code").fill(code);
await psycho.getByRole("button", { name: "Redeem" }).click();
await psycho.waitForTimeout(2000);
check(
  "second redeem refused",
  await psycho
    .getByText("That code doesn't work — it may have expired or been used already.")
    .isVisible(),
);

// The second redeem is answered 404 on purpose — that log line is expected.
const relevant = errors.filter(
  (e) => !e.includes("useNativeDriver") && !(e.includes("404") && e.includes("/v1/shares/redeem")),
);
check("no console errors", relevant.length === 0, relevant.join(" | "));

await browser.close();
patientServer.close();
psychoServer.close();
process.exit(failed ? 1 : 0);
