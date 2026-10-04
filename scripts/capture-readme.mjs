import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

// The bundled examples, listed as recent files so the Projects screen can open them without
// a native dialog. Opening them still goes through the real Rust and Python bridge.
const examples = [
  ["calculus-area", "Area under a curve", 9.8],
  ["shape-motion", "Shapes and motion", 10.7],
  ["official-demo", "", 0],
];
const recents = await Promise.all(examples.map(async ([key]) => ({
  path: resolve("examples", `${key}.json`),
  openedAt: Date.now(),
  project: JSON.parse(await readFile(`examples/${key}.json`, "utf8")),
})));
const keptKeys = ["manim-editor-recent", "manim-editor-session", "manim-editor-theme"];

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
async function screenshot(name) {
  await delay(300);
  const { data } = await send("Page.captureScreenshot", { format: "png" });
  await writeFile(`docs/screenshots/${name}.png`, Buffer.from(data, "base64"));
}
async function capture(name) {
  await evaluate(`new Promise(resolve => {
    const video = document.querySelector('video');
    video.requestVideoFrameCallback(resolve);
    video.currentTime += 0.07;
  })`);
  await screenshot(name);
}
const click = selector => evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
// A real click at an element's centre: Radix tabs switch on pointer down, which click() never sends.
async function clickOn(expression) {
  const { x, y } = await evaluate(`(() => { const box = (${expression}).getBoundingClientRect();
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 }; })()`);
  for (const type of ["mousePressed", "mouseReleased"]) await send("Input.dispatchMouseEvent", { type, x, y, button: "left", clickCount: 1 });
}
// Real key presses through the debugging protocol, so the app's own shortcuts handle them.
const press = (key, code, keyCode, modifiers = 0) => send("Input.dispatchKeyEvent", { type: "keyDown", key, code, windowsVirtualKeyCode: keyCode, modifiers })
  .then(() => send("Input.dispatchKeyEvent", { type: "keyUp", key, code, windowsVirtualKeyCode: keyCode, modifiers }));
const status = 'document.querySelector("[role=status]").textContent';
const kept = await evaluate(`JSON.stringify(Object.fromEntries(${JSON.stringify(keptKeys)}.map(key => [key, localStorage.getItem(key)])))`);
try {
  await send("Page.enable");
  await mkdir("docs/screenshots", { recursive: true });
  await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  // A fresh start: no recovered session, the examples as recent files, the dark theme.
  await evaluate(`localStorage.removeItem("manim-editor-session");
    localStorage.setItem("manim-editor-theme", "dark");
    localStorage.setItem("manim-editor-recent", ${JSON.stringify(JSON.stringify(recents))});
    location.reload();`);
  await delay(500);
  await waitFor('!!document.querySelector(".projects-screen") && !document.querySelector(".splash")');
  for (const [key, name, time] of examples.filter(([, name]) => name)) {
    if (await evaluate('!document.querySelector(".projects-screen")')) await click('[aria-label="All projects"]');
    await waitFor('!!document.querySelector(".projects-screen")');
    await click(`[aria-label="Open ${name}"]`);
    await waitFor(`!!document.querySelector(".workspace") && ${status} === "Opened ${key}.json."`);
    await evaluate(`[...document.querySelectorAll("button")].find(button => button.textContent.trim() === "Render").click()`);
    await waitFor(`${status} === "Preview updated."`, 400000);
    await waitFor('document.querySelector("video")?.readyState >= 2');
    await evaluate(`document.querySelector('video').currentTime = ${time}`);
    await waitFor('!document.querySelector("video").seeking');
    await evaluate('document.querySelector(".library").scrollTop = 0');
    await capture(`${key}-dark`);
    if (key === "calculus-area") {
      await press(",", "Comma", 188, 2);
      await waitFor('!!document.querySelector("[role=dialog]")');
      await clickOn(`[...document.querySelectorAll("[role=tab]")].find(tab => tab.textContent.trim() === "Export")`);
      await waitFor(`[...document.querySelectorAll("[role=tab]")].find(tab => tab.textContent.trim() === "Export").getAttribute("aria-selected") === "true"`);
      await screenshot("settings-dark");
      await press("Escape", "Escape", 27);
      await waitFor('!document.querySelector("[role=dialog]")');
      await click('[aria-label="Switch to light mode"]');
      await capture("calculus-area-light");
      await click('[aria-label="Switch to dark mode"]');
    }
  }
  await click('[aria-label="All projects"]');
  await waitFor('!!document.querySelector(".projects-screen")');
  await screenshot("projects-dark");
  console.log("Captured five screenshots from the real Tauri app with freshly rendered Manim videos.");
} finally {
  await evaluate(`Object.entries(${kept}).forEach(([key, value]) =>
    value === null ? localStorage.removeItem(key) : localStorage.setItem(key, value))`).catch(() => {});
  await send("Emulation.clearDeviceMetricsOverride");
  socket.close();
}
