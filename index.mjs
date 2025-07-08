import fs from "fs-extra";
import path from "path";
import minimist from "minimist";
import { chromium } from "playwright";
import { sendResultsEmail } from "./sendResultsEmail.mjs";

// Helper: Read URLs from text file
function loadUrlsFromFile(filepath) {
  const content = fs.readFileSync(filepath, "utf-8");
  return content
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

const args = minimist(process.argv.slice(2));
const urlFile = args["input-file"] || "urls.txt";
const URLS_TO_TEST = loadUrlsFromFile(urlFile);

function sanitizeFilename(url) {
  const domain = new URL(url).hostname.replace(/\./g, "-");
  return domain.replace(/[^a-zA-Z0-9_-]/g, "_");
}

function nowStr() {
  const d = new Date();
  return d.toISOString().replace(/[:.]/g, "-").slice(0, 19);
}

async function runTest(url, page, resultDir, label) {
  console.log(`🔍 Starting test for: ${url}`);
  await page.goto("https://pagespeed.web.dev/", { timeout: 60000 });
  console.log("🌐 Loaded PageSpeed Insights homepage");

  await page.fill('input[placeholder="Enter a web page URL"]', url);
  console.log(`📝 Entered URL: ${url}`);

  await page.click('button:has-text("Analyze")');
  console.log("🚀 Clicked Analyze button");

  console.log("⏳ Waiting for performance results to load...");
  await page.waitForSelector(`div[id="performance"]`, { timeout: 240000 });
  console.log("✅ Performance result loaded");

  const resultData = {
    label,
    url,
    resultUrl: page.url(),
    timestamp: new Date().toISOString(),
    metrics: {},
  };

  for (const tab of ["mobile", "desktop"]) {
    console.log(`➡️ Switching to ${tab} tab...`);
    await page.click(`button[id="${tab}_tab"]`);
    await page.waitForTimeout(13000); // Wait for tab content to load

    const currentTab = page.locator(`div[aria-labelledby="${tab}_tab"]`);
    await currentTab.waitFor({ timeout: 60000 });
    console.log(`✅ ${tab} tab is visible`);

    console.log(`⏳ Waiting for performance section in ${tab} tab...`);
    await currentTab
      .locator(`div[id="performance"]`)
      .waitFor({ timeout: 120000 });
    console.log(`📈 Performance section ready in ${tab} tab`);

    const screenshotPath = path.join(resultDir, `${tab}.png`);
    console.log(`📸 Taking screenshot for ${tab}...`);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(1000);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`✅ Screenshot saved: ${screenshotPath}`);

    console.log(`📊 Extracting metrics for ${tab}...`);
    const scoreEl = await currentTab.locator(".lh-exp-gauge__percentage");
    const scoreText = (await scoreEl.textContent())?.trim();

    const metricContainer = await currentTab.locator(".lh-metrics-container");
    const metricItems = await metricContainer.locator(".lh-metric").all();

    const metrics = {};
    for (let i = 0; i < metricItems.length; i++) {
      const metricItem = metricItems[i];
      const title = await metricItem.locator(".lh-metric__title").innerText();
      const value = await metricItem.locator(".lh-metric__value").innerText();
      metrics[title] = value;
    }

    console.log(`🏅 ${tab.toUpperCase()} Performance Score: ${scoreText}`);
    console.table(metrics);

    resultData.metrics[tab] = {
      performance_score: scoreText,
      details: metrics,
    };
  }

  const jsonPath = path.join(resultDir, "result.json");
  console.log(`💾 Writing result to: ${jsonPath}`);
  await fs.writeJSON(jsonPath, resultData, { spaces: 2 });

  console.log(`✅ Result saved for: ${url}`);
  console.log(`📧 Sending email for: ${url}`);
  await sendResultsEmail(resultDir);
  console.log(`✅ Email sent successfully\n`);
}

(async () => {
  const usePersistent = !!args["use-existing-browser"];
  const executablePath = args["executable-path"] || undefined;

  const baseOutputDir = "results";
  await fs.ensureDir(baseOutputDir);

  const label = "PageSpeed Insights " + new Date().toISOString();

  console.log("📦 Starting PageSpeed batch...");
  console.log(`📄 URLs loaded from: ${urlFile}`);
  console.log(`🔢 Total URLs: ${URLS_TO_TEST.length}\n`);

  if (usePersistent) {
    const userDataDir = path.resolve("./user_data");
    const context = await chromium.launchPersistentContext(userDataDir, {
      headless: true,
      viewport: { width: 1280, height: 800 },
      executablePath,
    });

    const page = context.pages()[0] || (await context.newPage());

    for (const url of URLS_TO_TEST) {
      console.log("--------------------------------------------------");
      const folderName = `${nowStr()}_${sanitizeFilename(url)}`;
      const resultDir = path.join(baseOutputDir, folderName);
      await fs.ensureDir(resultDir);
      await runTest(url, page, resultDir, label);
    }

    await context.close();
  } else {
    const browser = await chromium.launch({
      headless: true,
      executablePath,
    });

    for (const url of URLS_TO_TEST) {
      console.log("--------------------------------------------------");
      const context = await browser.newContext({
        viewport: { width: 1280, height: 800 },
      });
      const page = await context.newPage();

      const folderName = `${nowStr()}_${sanitizeFilename(url)}`;
      const resultDir = path.join(baseOutputDir, folderName);
      await fs.ensureDir(resultDir);

      await runTest(url, page, resultDir, label);

      await context.close();
    }

    await browser.close();
  }

  console.log("🎉 All tests completed successfully!");
})();
