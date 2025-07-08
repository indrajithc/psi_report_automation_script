import fs from "fs-extra";
import path from "path";
import nodemailer from "nodemailer";
import "dotenv/config";

function buildHtmlTable(resultJson) {
  const rows = Object.entries(resultJson.metrics)
    .map(([tab, data]) => {
      const score = data.performance_score;
      const metrics = Object.entries(data.details)
        .map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`)
        .join("");
      return `
        <h3>${tab.toUpperCase()} - Score: ${score}</h3>
        <table border="1" cellspacing="0" cellpadding="4">
          <thead><tr><th>Metric</th><th>Value</th></tr></thead>
          <tbody>${metrics}</tbody>
        </table>
      `;
    })
    .join("<br/>");

  return `
    <h2>PageSpeed Insights Results</h2>
    <p><strong>URL:</strong> ${resultJson.url}</p>
    <p><strong>Tested at:</strong> ${resultJson.timestamp}</p>
    ${rows}
  `;
}

export async function sendResultsEmail(resultDir) {
  const resultPath = path.join(resultDir, "result.json");
  const resultJson = await fs.readJson(resultPath);

  const htmlBody = buildHtmlTable(resultJson);

  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT || "587"),
    secure: false,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  const mailOptions = {
    from: `"PageSpeed Bot" <${process.env.EMAIL_FROM}>`,
    to: process.env.EMAIL_TO,
    subject: `📊 PageSpeed Report: ${new URL(resultJson.url).hostname}`,
    html: htmlBody,
    attachments: [
      {
        filename: "mobile.png",
        path: path.join(resultDir, "mobile.png"),
      },
      {
        filename: "desktop.png",
        path: path.join(resultDir, "desktop.png"),
      },
    ],
  };

  await transporter.sendMail(mailOptions);
  console.log(`📧 Email sent for ${resultJson.url}`);
}
