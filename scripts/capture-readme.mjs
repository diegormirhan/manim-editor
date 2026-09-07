import { mkdir, writeFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";

// Connect directly to the WebView page; Vite also exposes unsupported worker targets.
const targets = await fetch("http://127.0.0.1:9223/json/list").then(response => response.json());
const target = targets.find(item => item.type === "page" && item.url.startsWith("http://127.0.0.1:1420"));
if (!target) throw new Error("Start the desktop app with WebView2 remote debugging on port 9223.");
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener("open", resolve, { once: true });
  socket.addEventListener("error", reject, { once: true });
});
let sequence = 0;
const pending = new Map();
socket.addEventListener("message", event => {
  const message = JSON.parse(event.data);
  if (message.method === "Page.javascriptDialogOpening") void send("Page.handleJavaScriptDialog", { accept: true });
  const request = pending.get(message.id);
  if (!request) return;
  clearTimeout(request.timer);
  pending.delete(message.id);
  if (message.error) request.reject(new Error(JSON.stringify(message.error)));
  else request.resolve(message.result);
});
function send(method, params = {}) {
  const id = ++sequence;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`${method} timed out`)); }, 30000);
    pending.set(id, { resolve, reject, timer });
    socket.send(JSON.stringify({ id, method, params }));
  });
}
async function evaluate(expression) {
  const result = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
}
async function waitFor(expression, timeout = 30000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await evaluate(expression)) return;
    await delay(250);
  }
  throw new Error(`Condition timed out: ${expression}`);
}
async function capture(name) {
  await evaluate(`new Promise(resolve => {
    const video = document.querySelector('video');
    video.requestVideoFrameCallback(resolve);
    video.currentTime += 0.07;
  })`);
  await delay(300);
  const { data } = await send("Page.captureScreenshot", { format: "png" });
  await writeFile(`docs/screenshots/${name}.png`, Buffer.from(data, "base64"));
}
try {
  await send("Page.enable");
  await mkdir("docs/screenshots", { recursive: true });
  await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  await waitFor(`!!document.querySelector('[aria-label="Open example"]')`);
  for (const [key, time] of [["calculus-area", 9.8], ["shape-motion", 10.7]]) {
    await evaluate(`(() => { const select = document.querySelector('[aria-label="Open example"]'); select.value = '${key}'; select.dispatchEvent(new Event('change', { bubbles: true })); })()`);
    await waitFor('document.querySelector("[role=status]").textContent.includes("Click Render")');
    await evaluate('document.querySelector("button.primary").click()');
    await waitFor('document.querySelector("[role=status]").textContent === "Preview updated."', 400000);
    await waitFor('document.querySelector("video")?.readyState >= 2');
    await evaluate(`document.querySelector('video').currentTime = ${time}`);
    await waitFor('!document.querySelector("video").seeking');
    await evaluate('document.querySelector(".sidebar").scrollTop = 0');
    if (await evaluate('document.documentElement.dataset.theme !== "dark"')) {
      await evaluate(`document.querySelector('[aria-label="Switch to dark mode"]').click()`);
    }
    await capture(`${key}-dark`);
    if (key === "calculus-area") {
      await evaluate(`document.querySelector('[aria-label="Switch to light mode"]').click()`);
      await capture("calculus-area-light");
    }
  }
  console.log("Captured three screenshots from the real Tauri app with freshly rendered Manim videos.");
} finally {
  await send("Emulation.clearDeviceMetricsOverride");
  socket.close();
}
