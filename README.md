# PageSpeed Insights Automation (Playwright + Node.js)

This tool automates Google PageSpeed Insights testing for a list of URLs.  
It captures screenshots for both **mobile** and **desktop** tabs, extracts key metrics, and saves results in structured folders.

---

## ✅ Features

- Run multiple URLs from a text file
- Test both mobile & desktop tabs
- Take full-page screenshots
- Extract performance score and metrics
- Save as JSON in timestamped folders
- Support for system Chromium (`--executable-path`)
- Optional persistent session with login/data (`--use-existing-browser`)

---

## 📦 Install

```bash
git clone git@github.com:indrajithc/psi_report_automation_script.git
cd <psi_report_automation_script>
npm install
npx playwright install
```

---

## 📄 Usage

### 1. Add URLs to `urls.txt`

```
https://example.com
https://your-second-url.com
https://www.teleflora.com/bouquet/telefloras-best-wishes-bouquet
```

---

### 2. Run the Script

```bash
node pagespeed_auto.js
```

#### ▶️ With custom Chromium path

```bash
node pagespeed_auto.js --executable-path /usr/bin/chromium
```

#### ▶️ With persistent browser session

```bash
node pagespeed_auto.js --use-existing-browser --executable-path /usr/bin/chromium
```

#### ▶️ With a different URL file

```bash
node pagespeed_auto.js --input-file my-urls.txt
```

---

## 📁 Output Structure

Each URL gets a folder like:

```
results/
  └── 2025-07-08T12-15-00_example-com/
        ├── mobile.png
        ├── desktop.png
        └── result.json
```

---

## 📘 Example result.json

```json
{
  "url": "https://example.com",
  "timestamp": "2025-07-08T12:15:00.000Z",
  "metrics": {
    "mobile": {
      "performance_score": "95",
      "details": {
        "First Contentful Paint": "1.2 s",
        "Largest Contentful Paint": "2.1 s"
      }
    },
    "desktop": {
      "performance_score": "98",
      "details": {
        "First Contentful Paint": "0.9 s",
        "Largest Contentful Paint": "1.4 s"
      }
    }
  }
}
```

---

## 📌 Notes

- You can reuse `user_data/` for login or cookies
- Results are stored in the `results/` directory (auto-created)
- Make sure Chromium or Chrome is installed if using `--executable-path`

---

## 🧪 Tested with

- Node.js 18+
- Playwright 1.44+
- Chromium (system or bundled)

---

## 📜 License

MIT
