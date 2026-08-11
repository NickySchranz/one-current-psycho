/* Headless smoke test for the practice app: example clients, the share
   timeline, the day-by-day record, and a round-trip import of a real file
   exported by one-current-app (written by its scripts/share-export.mjs). */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { extname, join } from "node:path";
import { chromium } from "playwright-core";

const DIST = new URL("../dist", import.meta.url).pathname;
const MIME = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".ico": "image/x-icon",
};
const server = createServer(async (req, res) => {
  const path = req.url === "/" ? "/index.html" : req.url.split("?")[0];
  try {
    const body = await readFile(join(DIST, path));
    res.writeHead(200, { "content-type": MIME[extname(path)] ?? "application/octet-stream" });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end();
  }
});
await new Promise((r) => server.listen(4180, r));

const browser = await chromium.launch({
  executablePath: `${process.env.HOME}/.cache/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-linux64/chrome-headless-shell`,
  args: ["--no-sandbox"],
});
const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
const errors = [];
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
await page.goto("http://localhost:4180/");
await page.waitForTimeout(1800);

let failed = false;
const check = (name, ok, detail = "") => {
  console.log(`${name}: ${detail}${detail ? " " : ""}${ok ? "OK" : "FAIL"}`);
  if (!ok) failed = true;
};

// 0. dummy login with the seeded demo account
await page.getByLabel("Email").fill("demo@onecurrent.app");
await page.getByLabel("Password", { exact: true }).fill("demo1234");
await page.getByRole("button", { name: "Sign in" }).click();
await page.waitForTimeout(600);
check(
  "demo login",
  (await page.getByRole("button", { name: "Load example clients" }).count()) > 0,
);

// 1. load example clients
await page.getByRole("button", { name: "Load example clients" }).click();
await page.waitForTimeout(600);
check(
  "example clients",
  (await page.getByText("Maya R.").count()) > 0 &&
    (await page.getByText("Jonas K.").count()) > 0,
);

// 2. open Maya, see her shared files
await page.getByRole("button", { name: "Open Maya R." }).click();
await page.waitForTimeout(500);
const viewButtons = page.getByRole("button", { name: "View", exact: true });
check("share rows", (await viewButtons.count()) === 2, `n=${await viewButtons.count()}`);

// 3. open the latest share: timeline with markers, overview spread below
await viewButtons.first().click();
await page.waitForTimeout(700);
const circles = await page.locator("svg circle").count();
check("timeline markers", circles > 0, `circles=${circles}`);
check(
  "overview spread",
  (await page.getByText("The threads").count()) > 0 &&
    (await page.getByText("Steps taken").count()) > 0,
);
await page.screenshot({ path: "/tmp/psycho-timeline-desktop.png", fullPage: true });

// 4. tap a marker: content below switches to the focused thread's spread
//    with the event spelled out; the back button returns to the overview
await page.locator("svg circle").first().click();
await page.waitForTimeout(400);
check("event detail card", (await page.getByText(/^on “/).count()) > 0);
check("thread spread", (await page.getByText("What happened").count()) > 0);
await page.screenshot({ path: "/tmp/psycho-thread-detail.png", fullPage: true });
await page.getByRole("button", { name: "← All shared threads" }).click();
await page.waitForTimeout(400);
check("back to overview", (await page.getByText("The threads").count()) > 0);

// 5. day-by-day tab: every day stacked under each other, each recorded day
//    opening with its animated mini timeline; quiet runs folded into a line
await page.getByRole("button", { name: "Day by day" }).click();
await page.waitForTimeout(600);
const daySvgs = await page.locator("svg").count();
check("day strips render", daySvgs > 3, `svgs=${daySvgs}`);
check("day by day", (await page.getByText(/loudness moved to/).count()) > 0);
check("quiet days folded", (await page.getByText(/nothing recorded/).count()) > 0);
await page.screenshot({ path: "/tmp/psycho-daybyday.png", fullPage: true });

// 6. phone-sized rendering — the timeline always stays above the tabs
await page.setViewportSize({ width: 390, height: 844 });
await page.getByRole("button", { name: "Overview", exact: true }).click();
await page.waitForTimeout(500);
await page.screenshot({ path: "/tmp/psycho-timeline-phone.png", fullPage: true });
check("phone render markers", (await page.locator("svg circle").count()) > 0);
await page.setViewportSize({ width: 1200, height: 900 });

// 7. round-trip: import the file exported by one-current-app, if present
const ROUNDTRIP = "/tmp/one-current-share-roundtrip.json";
if (existsSync(ROUNDTRIP)) {
  const shared = JSON.parse(await readFile(ROUNDTRIP, "utf8"));
  await page.getByRole("button", { name: "← Back" }).click();
  await page.waitForTimeout(400);
  const chooserPromise = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Import a share file" }).click();
  const chooser = await chooserPromise;
  await chooser.setFiles(ROUNDTRIP);
  await page.waitForTimeout(600);
  const count = await page.getByRole("button", { name: "View", exact: true }).count();
  check("round-trip import stored", count === 3, `rows=${count}`);
  // The newest import sorts first — open it and expect the exported titles.
  await page.getByRole("button", { name: "View", exact: true }).first().click();
  await page.waitForTimeout(700);
  let titlesOk = true;
  for (const th of shared.threads) {
    if ((await page.getByText(th.title).count()) === 0) titlesOk = false;
  }
  check("round-trip titles render", titlesOk, shared.threads.map((t) => t.title).join(" · "));
} else {
  check("round-trip file present", false, `${ROUNDTRIP} missing — run one-current-app/scripts/share-export.mjs first`);
}

await browser.close();
server.close();
// With no API running, the demo login's API-first attempt logs a connection
// refusal before falling back to the local account — that is expected.
const relevant = errors.filter((e) => !e.includes("ERR_CONNECTION_REFUSED"));
console.log(relevant.length ? "ERRORS:\n" + relevant.slice(0, 5).join("\n") : "no console errors");
if (failed || relevant.length) process.exit(1);
