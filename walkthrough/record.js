/**
 * Prep Kit walkthrough recorder.
 * Records a headed Chromium session covering the README shot list.
 * Writes scene timestamps for narration sync.
 */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const BASE = "http://localhost:3000";
const EMAIL = "e2e-check@test.dev";
const PASSWORD = "password123";
const KIT_ID = "6ab372d2957468fa03b2fb63"; // Stripe Billing — ready, rich content

const JD = `Senior Full-Stack Engineer — PostHog

About the role
PostHog builds an open-source product analytics platform. As a Senior Full-Stack Engineer you will ship features across our TypeScript/React frontend and Node/ClickHouse backend, own problems end-to-end from design to production, and improve performance of high-traffic query paths.

What you'll do
- Design and ship features across web app and API
- Own data pipelines for events and session replay
- Improve performance of high-traffic query paths
- Pair with design and product on ambiguous problems
- Mentor mid-level engineers through code review and pairing

What we look for
- 5+ years building production web applications
- Strong TypeScript, React, and Node.js
- Experience with Postgres or ClickHouse and data modelling
- Comfort with distributed systems basics (queues, idempotency, retries)
- Clear written communication in a remote-first team
- Experience with feature flags or experimentation is a plus
`;

const scenes = [];
let t0 = 0;

function mark(name) {
  const now = Date.now();
  const at = (now - t0) / 1000;
  scenes.push({ name, at: Number(at.toFixed(2)) });
  console.log(`[scene] ${name} @ ${at.toFixed(1)}s`);
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

(async () => {
  const outDir = path.join(__dirname, "raw");
  fs.mkdirSync(outDir, { recursive: true });

  const browser = await chromium.launch({
    headless: false,
    args: ["--window-size=1440,900", "--start-maximized"],
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    recordVideo: {
      dir: outDir,
      size: { width: 1440, height: 900 },
    },
    locale: "en-US",
    colorScheme: "light",
  });
  const page = await context.newPage();
  page.setDefaultTimeout(30000);

  t0 = Date.now();
  mark("start");

  // ——— Scene 1: Landing + login ———
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  mark("s1_landing");
  await sleep(6000);

  await page.goto(BASE + "/login", { waitUntil: "networkidle" });
  await sleep(1500);
  await page.fill("#auth-email", EMAIL);
  await sleep(600);
  await page.fill("#auth-password", PASSWORD);
  await sleep(500);
  await page.click('button:has-text("Log in")');
  await page.waitForURL("**/dashboard", { timeout: 20000 });
  await page.waitForLoadState("networkidle");
  mark("s1_dashboard");
  await sleep(5000);

  // ——— Scene 2: Create kit (form + generate) ———
  await page.goto(BASE + "/kits/new", { waitUntil: "networkidle" });
  mark("s2_new_kit_form");
  await sleep(3500);

  await page.fill("#kit-url", "https://posthog.com");
  await sleep(1200);
  await page.fill("#kit-days", "5");
  await sleep(900);
  await page.fill("#kit-jd", JD);
  await sleep(2500);
  mark("s2_form_filled");
  await page.click('button:has-text("Generate kit")');

  // Wait for redirect to dashboard, then open generating kit
  await page.waitForURL("**/dashboard", { timeout: 20000 }).catch(() => {});
  await page.waitForLoadState("networkidle");
  mark("s2_generating_dashboard");
  await sleep(4000);

  // Open the newest generating kit (first card)
  const firstKit = page.locator('a[href^="/kits/"]').first();
  await firstKit.click({ timeout: 15000 }).catch(async () => {});
  await page.waitForLoadState("networkidle");
  mark("s2_checklist");
  // Show checklist ticking for a while
  await sleep(12000);

  // If this new kit is still generating for long, jump to ready Stripe kit for deep dive
  // Prefer waiting up to ~35s for ready on this page, else switch
  let switched = false;
  for (let i = 0; i < 12; i++) {
    const generating = await page.locator("h1", { hasText: "Generating your kit" }).count();
    if (!generating) break;
    await sleep(3000);
  }
  // Prefer the rich Stripe kit for the deep-dive scenes (stable content)
  await page.goto(`${BASE}/kits/${KIT_ID}`, { waitUntil: "networkidle" });
  switched = true;
  await page.waitForLoadState("networkidle");
  // Ensure ready UI (coverage meter) is present
  await page
    .locator('[aria-label="Must-have coverage"]')
    .first()
    .waitFor({ timeout: 20000 })
    .catch(() => {});
  await sleep(2500);
  mark("s3_kit_ready");

  // ——— Scene 3: Coverage + research second pass ———
  await page
    .locator('h2:has-text("Coverage")')
    .first()
    .scrollIntoViewIfNeeded()
    .catch(() => {});
  await sleep(2500);
  mark("s3_coverage");
  await page
    .locator('[aria-label="Must-have coverage"]')
    .first()
    .hover()
    .catch(() => {});
  await sleep(2000);

  // Company brief / research notes if present
  const brief = page.locator('h2:has-text("Company brief")').first();
  if (await brief.count()) {
    await brief.scrollIntoViewIfNeeded().catch(() => {});
    await sleep(1800);
    mark("s3_brief");
  }
  const research = page.locator('h2:has-text("Research notes")').first();
  if (await research.count()) {
    await research.scrollIntoViewIfNeeded().catch(() => {});
    await sleep(1800);
    mark("s3_research");
  }

  // ——— Scene 4: Edit / pin / regenerate ———
  // Scroll to first technical question
  const firstQ = page.locator("article.card").filter({ has: page.locator("textarea") }).first();
  await firstQ.scrollIntoViewIfNeeded().catch(() => {});
  await page.mouse.wheel(0, 400);
  await sleep(1200);
  mark("s4_questions");

  // Edit the question prompt
  const prompt = page.locator('textarea[id^="prompt-"]').first();
  if (await prompt.count()) {
    const val = await prompt.inputValue();
    await prompt.fill(val + " (focus on trade-offs)");
    await sleep(2500);
    mark("s4_edited");
  }

  // Pin the question
  const pinBtn = page.locator('button[aria-label="Pin question"]').first();
  if (await pinBtn.count()) {
    await pinBtn.click();
    await sleep(2500);
    mark("s4_pinned");
  }

  // Reorder: move down
  const down = page.locator('button[aria-label="Move question down"]').first();
  if (await down.count()) {
    await down.click();
    await sleep(2500);
    mark("s4_reordered");
  }

  // Save changes
  const save = page.locator('button:has-text("Save changes")').first();
  if (await save.count()) {
    await save.click();
    await sleep(3500);
    mark("s4_saved");
  }

  // Regenerate a category (first Regenerate button in questions area)
  const regen = page.locator('button:has-text("Regenerate")').first();
  if (await regen.count()) {
    await regen.scrollIntoViewIfNeeded().catch(() => {});
    await regen.click().catch(() => {});
    await page
      .locator(".toast")
      .first()
      .waitFor({ timeout: 45000 })
      .catch(() => {});
    await sleep(4000);
    mark("s4_regenerated");
  }

  // Verify pin survived (pinned button visible)
  const stillPinned = page.locator('button[aria-label="Unpin question"]').first();
  if (await stillPinned.count()) {
    await stillPinned.scrollIntoViewIfNeeded().catch(() => {});
    await sleep(5000);
    mark("s4_pin_survived");
  }

  // ——— Scene 5: Practice ———
  await page.goto(`${BASE}/kits/${KIT_ID}/practice`, { waitUntil: "networkidle" });
  await sleep(4500);
  mark("s5_practice");

  // Reveal answer
  const reveal = page.locator('button:has-text("Reveal answer")');
  if (await reveal.count()) {
    await reveal.first().click();
    await sleep(5000);
    mark("s5_revealed");
  }

  // Rate 2 (shaky) so least-confident-first is demonstrated
  const rate2 = page.locator('button[aria-label*="2 ·"]');
  if (await rate2.count()) {
    await rate2.first().click();
    await sleep(4000);
    mark("s5_rated");
  }

  // Reveal next card too for continuity
  const reveal2 = page.locator('button:has-text("Reveal answer")');
  if (await reveal2.count()) {
    await reveal2.first().click();
    await sleep(4000);
    await page.keyboard.press("3");
    await sleep(4000);
    mark("s5_second_card");
  }

  // ——— Scene 6: Schedule ———
  await page.goto(`${BASE}/kits/${KIT_ID}`, { waitUntil: "networkidle" });
  await page
    .locator("h2", { hasText: "Schedule" })
    .first()
    .scrollIntoViewIfNeeded()
    .catch(() => {});
  await sleep(10000);
  mark("s6_schedule");

  // ——— Scene 7: Weak spots + design decision ———
  await page
    .locator("h2", { hasText: "Weak spots" })
    .first()
    .scrollIntoViewIfNeeded()
    .catch(() => {});
  await sleep(10000);
  mark("s7_weak_spots");

  // Coverage again for the design defense
  await page
    .locator("h2", { hasText: "Coverage" })
    .first()
    .scrollIntoViewIfNeeded()
    .catch(() => {});
  await sleep(8000);
  mark("s7_coverage_defense");

  // ——— Outro: back to landing ———
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  await sleep(8000);
  mark("outro");

  const total = (Date.now() - t0) / 1000;
  console.log(`Total recording: ${total.toFixed(1)}s`);
  console.log(JSON.stringify({ total: Number(total.toFixed(2)), switched, scenes }, null, 2));

  fs.writeFileSync(
    path.join(__dirname, "scene-timestamps.json"),
    JSON.stringify({ total: Number(total.toFixed(2)), switched, scenes }, null, 2),
  );

  await context.close();
  await browser.close();

  // Move/rename the video
  const files = fs.readdirSync(outDir).filter((f) => f.endsWith(".webm"));
  if (!files.length) throw new Error("No video produced");
  const src = path.join(outDir, files[0]);
  const dest = path.join(__dirname, "walkthrough-raw.webm");
  fs.renameSync(src, dest);
  console.log("Video:", dest);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
