// Renders docs/media/banner.html to docs/media/banner.png at 2x: the README header and the
// GitHub social preview (upload it in the repository's Settings → General → Social preview).
//
//   node scripts/render-banner.mjs
import { chromium } from "@playwright/test";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

const browser = await chromium.launch({ channel: "msedge" });
const page = await browser.newPage({ viewport: { width: 1280, height: 640 }, deviceScaleFactor: 2 });
await page.goto(pathToFileURL(resolve("docs/media/banner.html")).href);
await page.evaluate(() => Promise.all([document.fonts.ready, ...[...document.images].map(image => image.decode())]));
await page.screenshot({ path: "docs/media/banner.png" });
await browser.close();
console.log("docs/media/banner.png");
