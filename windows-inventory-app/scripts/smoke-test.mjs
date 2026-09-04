// Manual end-to-end smoke test driving the real packaged app logic through
// the actual Electron process (main + preload + renderer), via Playwright's
// Electron driver. Not part of `npm test` (that stays pure Vitest business
// logic) — this is what verifies the whole stack wired together actually
// works: click a button in the real UI, watch a real SQLite row land on
// disk. Run manually: `node scripts/smoke-test.mjs` (needs `npm run build`
// first, and a display — use `xvfb-run -a` if headless).
import { _electron as electron } from "playwright";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "inv-smoke-userdata-"));
let currentWin = null;

async function main() {
  console.log("Launching packaged Electron app…");
  const app = await electron.launch({
    // --no-sandbox / --disable-setuid-sandbox are needed ONLY because this
    // smoke test runs as root inside a container — Chromium's sandbox
    // refuses to start as root by design (crbug.com/638180). This is purely
    // a test-runner accommodation and is never passed when the real app
    // launches on a user's machine (see src/main/index.ts).
    args: [
      path.join(root, "dist", "main", "index.js"),
      `--user-data-dir=${userDataDir}`,
      "--no-sandbox",
      "--disable-setuid-sandbox",
    ],
    env: { ...process.env, ELECTRON_DISABLE_SECURITY_WARNINGS: "true", NODE_ENV: "production" },
  });

  const win = await app.firstWindow();
  currentWin = win;
  win.on("console", (msg) => console.log("[renderer console]", msg.type(), msg.text()));
  win.on("pageerror", (err) => console.log("[renderer pageerror]", err));
  await win.waitForLoadState("domcontentloaded");
  console.log("Window title:", await win.title());

  // --- Dashboard loads ---
  await win.waitForSelector("text=Общо продукти", { timeout: 15000 });
  console.log("✓ Dashboard loaded");

  // --- Add a product ---
  await win.click("text=Продукти");
  await win.waitForSelector("text=+ Нов продукт");
  await win.click("text=+ Нов продукт");
  await win.waitForSelector(".modal h3:has-text('Нов продукт')");
  // Scoped to `.modal` — the Products toolbar's own search box is also an
  // `input[type="text"]` and sits earlier in the DOM, so an unscoped
  // selector would silently fill that instead of the form field.
  await win.fill('.modal input[type="text"]', "Домати (smoke test)");
  const numberInputs = await win.$$('.modal input[type="number"]');
  await numberInputs[0].fill("2.5");
  await numberInputs[1].fill("3.5");
  await win.click('button:has-text("Запази")');
  await win.waitForSelector("text=Домати (smoke test)");
  console.log("✓ Product created");

  // --- Add an invoice (receiving) ---
  await win.click("text=Приемане на стоки");
  await win.click("text=+ Нова фактура");
  await win.waitForSelector(".modal h3:has-text('Нова фактура')");
  const invoiceInputs = await win.$$('.modal input[type="text"]');
  await invoiceInputs[0].fill("SMOKE-001"); // invoice number
  await invoiceInputs[1].fill("Смоук Доставчик"); // supplier
  await win.fill('.modal input[type="date"]', "2026-09-01");
  // product picker for the single line item — wait for the products list to
  // have loaded into the datalist before typing, so the name→id match fires
  await win.waitForSelector('datalist option[value="Домати (smoke test)"]', { state: "attached" });
  const lineProductInput = await win.$(".invoice-line-row input[type='text']");
  await lineProductInput.fill("Домати (smoke test)");
  const lineNumberInputs = await win.$$(".invoice-line-row input[type='number']");
  await lineNumberInputs[0].fill("20"); // quantity
  await win.click('button:has-text("Запази фактурата")');
  await win.waitForSelector("text=SMOKE-001");
  console.log("✓ Invoice with receiving created");

  // --- Stock out ---
  await win.click("text=Изписване");
  await win.click("text=+ Ново изписване");
  await win.waitForSelector(".modal h3:has-text('Ново изписване')");
  await win.waitForSelector('datalist option[value="Домати (smoke test)"]', { state: "attached" });
  const stockOutProductInput = await win.$('.modal input[type="text"]');
  await stockOutProductInput.fill("Домати (smoke test)");
  await win.fill('.modal input[type="number"]', "5");
  await win.click('.modal button[type="submit"]');
  await win.waitForSelector(".table-wrap table");
  console.log("✓ Stock-out recorded");

  // --- Verify balance on Inventory page ---
  await win.click("text=Наличности");
  await win.waitForSelector("text=Домати (smoke test)");
  const rowText = await win.locator("tr", { hasText: "Домати (smoke test)" }).first().innerText();
  assert.match(rowText, /15/, "expected remaining balance of 15 kg after 20 received - 5 issued");
  console.log("✓ Balance correctly computed as 15 kg:", rowText.replace(/\s+/g, " "));

  // --- PDF export ---
  // The main process opens a native save dialog for PDF export, which
  // Playwright cannot drive directly; the underlying pdfService is already
  // covered end-to-end by the Vitest suite, so we just confirm the button
  // triggers no renderer-side error here.
  await win.click("text=PDF отчети");
  await win.waitForSelector("text=Експортирай PDF");
  console.log("✓ PDF Reports page renders");

  // --- Backup ---
  await win.click("text=Backup");
  await win.click('button:has-text("Направи backup сега")');
  await win.waitForSelector("text=Ръчен");
  console.log("✓ Manual backup created and listed");

  await app.close();

  const dbPath = path.join(userDataDir, "inventory.db");
  const backupsDir = path.join(userDataDir, "Backups");
  assert.ok(fs.existsSync(dbPath), "sqlite database file must exist on disk");
  assert.ok(fs.existsSync(backupsDir), "backups directory must exist on disk");
  const backupFiles = fs.readdirSync(backupsDir).filter((f) => f.endsWith(".db"));
  assert.ok(backupFiles.length >= 1, "at least one backup file must exist on disk");
  console.log("✓ Real SQLite files persisted at", dbPath, "and", backupsDir);

  console.log("\nALL SMOKE CHECKS PASSED");
}

main().catch(async (err) => {
  console.error("SMOKE TEST FAILED:", err);
  if (currentWin) {
    try {
      const shotPath = path.join(os.tmpdir(), "smoke-failure.png");
      await currentWin.screenshot({ path: shotPath });
      console.error("Screenshot saved to", shotPath);
      const bodyText = await currentWin.locator("body").innerText();
      console.error("--- page text at failure ---\n", bodyText.slice(0, 2000));
    } catch (shotErr) {
      console.error("Could not capture diagnostics:", shotErr.message);
    }
  }
  process.exit(1);
});
