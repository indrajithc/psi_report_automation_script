const fs = require("fs-extra");
const path = require("path");
const minimist = require("minimist");
const { chromium } = require("playwright");

// Load URLs from a file
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

async function runTest(url, page, resultDir) {
  await page.goto("https://pagespeed.web.dev/", { timeout: 60000 });
  await page.fill('input[placeholder="Enter a web page URL"]', url);
  await page.click('button:has-text("Analyze")');

  await page.waitForSelector(`div[id="performance"]`, { timeout: 120000 });

  const resultData = {
    url,
    timestamp: new Date().toISOString(),
    metrics: {},
  };

  for (const tab of ["mobile", "desktop"]) {
    await page.click(`button[id="${tab}_tab"]`);
    await page.waitForTimeout(1000);

    // Use a locator for further chaining
    const currentTab = page.locator(`div[aria-labelledby="${tab}_tab"]`);
    await currentTab.waitFor({ timeout: 60000 });

    const screenshotPath = path.join(resultDir, `${tab}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });

    const scoreEl = await currentTab.locator(".lh-exp-gauge__percentage");
    const scoreText = (await scoreEl.textContent())?.trim();
    const metricContainer = await currentTab.locator(".lh-metrics-container");
    const metricItems = await metricContainer.locator(".lh-metric").all();

    const metrics = {};
    for (let i = 0; i < metricItems.length; i++) {
      const metricItem = metricItems[i];
      const metricTitle = await metricItem
        .locator(".lh-metric__title")
        .innerText();
      const metricValue = await metricItem
        .locator(".lh-metric__value")
        .innerText();

      metrics[metricTitle] = metricValue;
    }
    resultData.metrics[tab] = {
      performance_score: scoreText,
      details: metrics,
    };

    console.log(JSON.stringify(resultData, null, 2));
  }

  const jsonPath = path.join(resultDir, "result.json");
  await fs.writeJSON(jsonPath, resultData, { spaces: 2 });

  console.log(`✅ Saved results for ${url} in ${resultDir}`);
}

(async () => {
  const args = minimist(process.argv.slice(2));
  const usePersistent = !!args["use-existing-browser"];
  const executablePath = args["executable-path"] || undefined;

  const baseOutputDir = "results";
  await fs.ensureDir(baseOutputDir);

  if (usePersistent) {
    const userDataDir = path.resolve("./user_data");
    const context = await chromium.launchPersistentContext(userDataDir, {
      headless: false,
      viewport: { width: 1280, height: 800 },
      executablePath,
    });

    const page = context.pages()[0] || (await context.newPage());

    for (const url of URLS_TO_TEST) {
      const folderName = `${nowStr()}_${sanitizeFilename(url)}`;
      const resultDir = path.join(baseOutputDir, folderName);
      await fs.ensureDir(resultDir);
      await runTest(url, page, resultDir);
    }

    await context.close();
  } else {
    const browser = await chromium.launch({
      headless: true,
      executablePath,
    });

    for (const url of URLS_TO_TEST) {
      const context = await browser.newContext({
        viewport: { width: 1280, height: 800 },
      });
      const page = await context.newPage();

      const folderName = `${nowStr()}_${sanitizeFilename(url)}`;
      const resultDir = path.join(baseOutputDir, folderName);
      await fs.ensureDir(resultDir);

      await runTest(url, page, resultDir);

      await context.close();
    }

    await browser.close();
  }
})();
